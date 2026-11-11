-- Atomic, idempotent crediting of an already server-verified Apple coin transaction.
-- This function does NOT verify JWS; only a trusted verifier may insert apple_iap_events.
CREATE OR REPLACE FUNCTION public.credit_verified_apple_coin_transaction(p_transaction_id text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_user uuid;
  v_product text;
  v_coins integer;
  v_rows integer;
BEGIN
  IF p_transaction_id IS NULL OR length(p_transaction_id) < 6 THEN
    RAISE EXCEPTION 'invalid_transaction_id';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('apple-credit:' || p_transaction_id,0));

  SELECT e.user_id,e.product_id,c.coins
    INTO v_user,v_product,v_coins
  FROM public.apple_iap_events e
  JOIN public.apple_coin_pack_catalog c ON c.product_id=e.product_id
  WHERE e.transaction_id=p_transaction_id
    AND e.verified_at IS NOT NULL
    AND e.revocation_date IS NULL
    AND e.purchase_date IS NOT NULL;

  IF v_user IS NULL OR v_coins IS NULL OR v_coins <= 0 THEN
    RAISE EXCEPTION 'verified_apple_coin_transaction_required';
  END IF;

  INSERT INTO public.gacha_coin_purchase_credits(transaction_id,user_id,product_id,coins,verified_at)
  VALUES(p_transaction_id,v_user,v_product,v_coins,now())
  ON CONFLICT (transaction_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN false; END IF;

  INSERT INTO public.gacha_coin_wallets(user_id,balance)
  VALUES(v_user,v_coins)
  ON CONFLICT (user_id) DO UPDATE
  SET balance=public.gacha_coin_wallets.balance+EXCLUDED.balance;
  RETURN true;
END
$fn$;
REVOKE ALL ON FUNCTION public.credit_verified_apple_coin_transaction(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_verified_apple_coin_transaction(text) TO service_role;
