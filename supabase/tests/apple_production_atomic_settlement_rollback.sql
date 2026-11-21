-- Production Apple settlement integration test.
-- Runs inside a nested PL/pgSQL subtransaction and intentionally rolls back.
-- Requires an existing auth user; never leaves credits or changes billing state.
DO $test$
DECLARE v_user uuid; v_transaction text := '999999999999990001';
DECLARE v_before bigint; v_after bigint; v_replay bigint;
DECLARE v_count integer; v_ok boolean; v_reason text;
BEGIN
  BEGIN
    SELECT id INTO v_user FROM auth.users ORDER BY created_at LIMIT 1;
    IF v_user IS NULL THEN RAISE EXCEPTION 'no_test_account_exists'; END IF;
    IF EXISTS(SELECT 1 FROM public.apple_purchase_claims WHERE transaction_id=v_transaction)
       OR EXISTS(SELECT 1 FROM public.apple_iap_events WHERE transaction_id=v_transaction)
    THEN RAISE EXCEPTION 'synthetic_transaction_conflict'; END IF;
    SELECT COALESCE((SELECT balance FROM public.gacha_coin_wallets WHERE user_id=v_user),0)
       INTO v_before;
    UPDATE public.billing_settings
      SET billing_mode='live', checkout_enabled=true, ios_iap_ready=true
      WHERE singleton=true;
    UPDATE public.apple_iap_verification_gate
      SET server_jws_verified=true, sandbox_purchase_proven=true
      WHERE singleton=true;
    UPDATE public.apple_coin_pack_catalog SET is_sale_enabled=true
      WHERE product_id='mushiverse.coins.100';
    INSERT INTO public.apple_purchase_claims
      (user_id,transaction_id,original_transaction_id,product_id,environment,status)
      VALUES(v_user,v_transaction,v_transaction,'mushiverse.coins.100',NULL,'pending');

    -- Wrong-account replay must never touch the original owner's wallet.
    BEGIN
      PERFORM public.settle_verified_apple_coin_production(
        v_transaction,v_transaction,
        '123e4567-e89b-42d3-a456-426614174000'::uuid,
        'mushiverse.coins.100','2026-11-21T09:00:00+00'::timestamptz);
      RAISE EXCEPTION 'foreign_owner_accepted';
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS v_reason = MESSAGE_TEXT;
      IF v_reason <> 'apple_verified_claim_mismatch' THEN RAISE EXCEPTION '%', v_reason; END IF;
    END;

    v_ok := public.settle_verified_apple_coin_production(
      v_transaction,v_transaction,v_user,'mushiverse.coins.100',
      '2026-11-21T09:00:00+00'::timestamptz);
    IF NOT v_ok THEN RAISE EXCEPTION 'first_settlement_failed'; END IF;
    SELECT balance INTO v_after FROM public.gacha_coin_wallets WHERE user_id=v_user;
    IF v_after <> v_before+100 THEN RAISE EXCEPTION 'wallet_delta_incorrect'; END IF;

    v_ok := public.settle_verified_apple_coin_production(
      v_transaction,v_transaction,v_user,'mushiverse.coins.100',
      '2026-11-21T09:00:00+00'::timestamptz);
    IF NOT v_ok THEN RAISE EXCEPTION 'replay_failed'; END IF;
    SELECT balance INTO v_replay FROM public.gacha_coin_wallets WHERE user_id=v_user;
    SELECT count(*) INTO v_count FROM public.gacha_coin_purchase_credits
      WHERE transaction_id=v_transaction;
    IF v_replay <> v_after OR v_count <> 1 THEN
      RAISE EXCEPTION 'double_credit_detected';
    END IF;
    -- All changes above are undone by this intentional exception.
    RAISE EXCEPTION '__safe_rollback_success__';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_reason = MESSAGE_TEXT;
    IF v_reason <> '__safe_rollback_success__' THEN
      RAISE EXCEPTION 'atomic_settlement_test_failed: %', v_reason;
    END IF;
  END;
END
$test$;

-- These must still show OFF, zero sale-enabled and no synthetic credit.
SELECT billing_mode,checkout_enabled,ios_iap_ready FROM public.billing_settings;
SELECT count(*) AS enabled_products FROM public.apple_coin_pack_catalog
  WHERE is_sale_enabled;
SELECT count(*) AS synthetic_credit_rows FROM public.gacha_coin_purchase_credits
  WHERE transaction_id='999999999999990001';
