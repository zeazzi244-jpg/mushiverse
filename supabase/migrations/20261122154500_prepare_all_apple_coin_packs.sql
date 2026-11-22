BEGIN;
-- Support every staged pack while retaining the existing approval trigger.
-- Server-only atomic Production coin settlement. This remains unusable
-- until the separate billing, Apple proof and catalog gates are all enabled.
-- Only a server that has cryptographically verified Apple's JWS may invoke it.
CREATE OR REPLACE FUNCTION public.settle_verified_apple_coin_production(
  p_transaction_id text,
  p_original_transaction_id text,
  p_user_id uuid,
  p_product_id text,
  p_purchase_date timestamptz
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $body$
DECLARE v_claim public.apple_purchase_claims%ROWTYPE;
DECLARE v_event public.apple_iap_events%ROWTYPE;
DECLARE v_coins integer := CASE p_product_id
  WHEN 'mushiverse.coins.100' THEN 100
  WHEN 'mushiverse.coins.500' THEN 500
  WHEN 'mushiverse.coins.1200' THEN 1200
  WHEN 'mushiverse.coins.300' THEN 300
  WHEN 'mushiverse.coins.2500' THEN 2500
  WHEN 'mushiverse.coins.5500' THEN 5500
  WHEN 'mushiverse.coins.12000' THEN 12000
END;
BEGIN
  IF p_transaction_id !~ '^[0-9]{6,30}$'
    OR p_original_transaction_id IS DISTINCT FROM p_transaction_id
    OR p_user_id IS NULL
    OR v_coins IS NULL
    OR p_purchase_date IS NULL
    OR p_purchase_date > pg_catalog.now() + interval '5 minutes'
  THEN RAISE EXCEPTION 'invalid_verified_apple_coin_input'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.billing_settings b WHERE b.singleton = true
     AND b.billing_mode = 'live' AND b.checkout_enabled AND b.ios_iap_ready)
    OR NOT EXISTS (SELECT 1 FROM public.apple_iap_verification_gate g
     WHERE g.singleton = true AND g.server_jws_verified AND g.sandbox_purchase_proven)
    OR NOT EXISTS (SELECT 1 FROM public.apple_coin_pack_catalog c
     WHERE c.product_id = p_product_id AND c.coins = v_coins AND c.is_sale_enabled)
  THEN RAISE EXCEPTION 'apple_iap_production_billing_disabled'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('apple-credit:' || p_transaction_id, 0));
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('apple-original:' || p_original_transaction_id, 0));

  SELECT * INTO v_claim FROM public.apple_purchase_claims
   WHERE transaction_id = p_transaction_id FOR UPDATE;
  IF NOT FOUND OR v_claim.user_id IS DISTINCT FROM p_user_id
    OR v_claim.product_id IS DISTINCT FROM p_product_id
    OR v_claim.original_transaction_id IS DISTINCT FROM p_original_transaction_id
    OR v_claim.status = 'rejected'
    OR v_claim.environment NOT IN ('Production')
  THEN RAISE EXCEPTION 'apple_verified_claim_mismatch'; END IF;

  IF EXISTS (SELECT 1 FROM public.apple_purchase_claims
    WHERE original_transaction_id = p_original_transaction_id
      AND (user_id IS DISTINCT FROM p_user_id OR transaction_id <> p_transaction_id
       OR product_id <> p_product_id))
  THEN RAISE EXCEPTION 'apple_original_transaction_conflict'; END IF;

  SELECT * INTO v_event FROM public.apple_iap_events
   WHERE transaction_id = p_transaction_id FOR UPDATE;
  IF FOUND AND (v_event.user_id IS DISTINCT FROM p_user_id
    OR v_event.original_transaction_id IS DISTINCT FROM p_original_transaction_id
    OR v_event.product_id IS DISTINCT FROM p_product_id
    OR v_event.environment <> 'Production'
    OR v_event.revocation_date IS NOT NULL
    OR v_event.purchase_date IS DISTINCT FROM p_purchase_date)
  THEN RAISE EXCEPTION 'apple_verified_event_conflict'; END IF;

  IF NOT FOUND THEN
    INSERT INTO public.apple_iap_events
      (transaction_id,original_transaction_id,user_id,product_id,
       environment,purchase_date,verified_at)
    VALUES (p_transaction_id,p_original_transaction_id,p_user_id,p_product_id,
       'Production',p_purchase_date,pg_catalog.now());
  END IF;

  UPDATE public.apple_purchase_claims
    SET environment = 'Production', status = 'verified',
        verified_at = COALESCE(verified_at, pg_catalog.now())
    WHERE transaction_id = p_transaction_id;

  -- This DB RPC performs ledger insert and wallet update inside the same
  -- transaction. Unique transaction IDs prevent concurrent double credit.
  PERFORM public.credit_verified_apple_coin_transaction(p_transaction_id);
  IF NOT EXISTS (SELECT 1 FROM public.gacha_coin_purchase_credits
    WHERE transaction_id = p_transaction_id
      AND user_id = p_user_id AND product_id = p_product_id AND coins = v_coins)
  THEN RAISE EXCEPTION 'apple_coin_ledger_acknowledgment_missing'; END IF;
  RETURN true;
END;
$body$;
REVOKE ALL ON FUNCTION public.settle_verified_apple_coin_production(text,text,uuid,text,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_verified_apple_coin_production(text,text,uuid,text,timestamptz)
  TO service_role;

CREATE OR REPLACE FUNCTION public.record_apple_refund_after_verified_jws(
 p_transaction_id text, p_user_id uuid, p_revocation_date timestamptz
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $refund$
DECLARE v_event public.apple_iap_events%ROWTYPE;
DECLARE v_credit public.gacha_coin_purchase_credits%ROWTYPE;
DECLARE v_hold public.apple_coin_refund_holds%ROWTYPE;
BEGIN
 IF p_transaction_id IS NULL OR p_transaction_id !~ '^[0-9]{6,30}$'
   OR p_user_id IS NULL OR p_revocation_date IS NULL
   OR p_revocation_date > pg_catalog.now() + interval '5 minutes'
 THEN RAISE EXCEPTION 'invalid_refund_evidence'; END IF;
 -- Serialize refunds with paid draws; they take this same account lock.
 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(p_user_id::text, 0));
 SELECT * INTO v_credit FROM public.gacha_coin_purchase_credits
   WHERE transaction_id=p_transaction_id FOR UPDATE;
 IF NOT FOUND OR v_credit.user_id IS DISTINCT FROM p_user_id
    OR v_credit.coins IS DISTINCT FROM (CASE v_credit.product_id
      WHEN 'mushiverse.coins.100' THEN 100
      WHEN 'mushiverse.coins.500' THEN 500
      WHEN 'mushiverse.coins.1200' THEN 1200
      WHEN 'mushiverse.coins.300' THEN 300
      WHEN 'mushiverse.coins.2500' THEN 2500
      WHEN 'mushiverse.coins.5500' THEN 5500
      WHEN 'mushiverse.coins.12000' THEN 12000
    END)
 THEN RAISE EXCEPTION 'refund_credit_owner_mismatch'; END IF;
 SELECT * INTO v_event FROM public.apple_iap_events
   WHERE transaction_id=p_transaction_id FOR UPDATE;
 IF NOT FOUND OR v_event.user_id IS DISTINCT FROM p_user_id
    OR v_event.product_id IS DISTINCT FROM v_credit.product_id
    OR v_event.environment IS DISTINCT FROM 'Production'
    OR v_event.verified_at IS NULL
    OR v_event.purchase_date IS NULL
    OR p_revocation_date < v_event.purchase_date
    OR (v_event.revocation_date IS NOT NULL AND
        v_event.revocation_date IS DISTINCT FROM p_revocation_date)
 THEN RAISE EXCEPTION 'refund_verified_event_mismatch'; END IF;
 SELECT * INTO v_hold FROM public.apple_coin_refund_holds
   WHERE transaction_id=p_transaction_id FOR UPDATE;
 IF FOUND AND (v_hold.user_id IS DISTINCT FROM p_user_id
   OR v_hold.revocation_date IS DISTINCT FROM p_revocation_date)
 THEN RAISE EXCEPTION 'refund_replay_conflict'; END IF;
 INSERT INTO public.apple_coin_refund_holds
   (transaction_id,user_id,revocation_date)
 VALUES (p_transaction_id,p_user_id,p_revocation_date)
 ON CONFLICT (transaction_id) DO NOTHING;
 UPDATE public.apple_iap_events SET revocation_date=p_revocation_date
   WHERE transaction_id=p_transaction_id
     AND (revocation_date IS NULL OR revocation_date=p_revocation_date);
 IF NOT FOUND THEN RAISE EXCEPTION 'refund_event_changed'; END IF;
 RETURN true;
END;
$refund$;
REVOKE ALL ON FUNCTION public.record_apple_refund_after_verified_jws(text,uuid,timestamptz)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_apple_refund_after_verified_jws(text,uuid,timestamptz)
 TO service_role;

-- Keep the spendable wallet restricted to explicitly enabled Production purchases.
CREATE OR REPLACE FUNCTION public.credit_verified_apple_coin_transaction(p_transaction_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_user uuid; v_product text; v_original text; v_coins integer; v_rows integer;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.billing_settings
   WHERE singleton IS TRUE AND billing_mode = 'live'
     AND checkout_enabled IS TRUE AND ios_iap_ready IS TRUE)
 THEN RAISE EXCEPTION 'apple_iap_production_billing_disabled'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.apple_iap_verification_gate
   WHERE singleton = true AND server_jws_verified = true AND sandbox_purchase_proven = true)
 THEN RAISE EXCEPTION 'apple_iap_verification_gate_closed'; END IF;
 IF p_transaction_id IS NULL OR p_transaction_id !~ '^[0-9]{6,30}$'
 THEN RAISE EXCEPTION 'invalid_transaction_id'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('apple-credit:' || p_transaction_id, 0));
 SELECT e.user_id,e.product_id,e.original_transaction_id,c.coins
 INTO v_user,v_product,v_original,v_coins
 FROM public.apple_iap_events e JOIN public.apple_coin_pack_catalog c ON c.product_id=e.product_id
 WHERE e.transaction_id=p_transaction_id AND e.verified_at IS NOT NULL
 AND c.is_sale_enabled IS TRUE AND e.revocation_date IS NULL AND e.purchase_date IS NOT NULL AND e.environment='Production';
 IF v_user IS NULL OR v_original IS NULL OR v_original !~ '^[0-9]{6,30}$'
 OR v_original <> p_transaction_id OR (v_product,v_coins) NOT IN (
 ('mushiverse.coins.100',100),('mushiverse.coins.500',500),('mushiverse.coins.1200',1200),('mushiverse.coins.300',300),('mushiverse.coins.2500',2500),('mushiverse.coins.5500',5500),('mushiverse.coins.12000',12000))
 THEN RAISE EXCEPTION 'verified_apple_coin_transaction_required'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('apple-original:' || v_original, 0));
 IF NOT EXISTS (
 SELECT 1 FROM public.apple_purchase_claims c WHERE c.transaction_id=p_transaction_id
 AND c.original_transaction_id=v_original AND c.user_id=v_user
 AND c.product_id=v_product AND c.environment='Production' AND c.verified_at IS NOT NULL
 ) OR EXISTS (SELECT 1 FROM public.apple_purchase_claims c WHERE c.original_transaction_id=v_original AND c.user_id<>v_user)
 OR EXISTS (SELECT 1 FROM public.apple_iap_events e WHERE e.original_transaction_id=v_original AND e.user_id<>v_user)
 THEN RAISE EXCEPTION 'apple_original_transaction_ownership_mismatch'; END IF;
 INSERT INTO public.gacha_coin_purchase_credits(transaction_id,user_id,product_id,coins,verified_at)
 VALUES(p_transaction_id,v_user,v_product,v_coins,now()) ON CONFLICT(transaction_id) DO NOTHING;
 GET DIAGNOSTICS v_rows=ROW_COUNT;
 IF v_rows=0 THEN RETURN false; END IF;
 INSERT INTO public.gacha_coin_wallets(user_id,balance) VALUES(v_user,v_coins)
 ON CONFLICT(user_id) DO UPDATE SET balance=public.gacha_coin_wallets.balance+EXCLUDED.balance;
 RETURN true;
END
$function$;
REVOKE ALL ON FUNCTION public.credit_verified_apple_coin_transaction(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_verified_apple_coin_transaction(text) TO service_role;

COMMIT;
