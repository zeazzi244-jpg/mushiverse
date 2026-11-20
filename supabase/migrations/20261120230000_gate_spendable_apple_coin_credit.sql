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
 ('mushiverse.coins.100',100),('mushiverse.coins.500',500),('mushiverse.coins.1200',1200))
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
