-- Refund quarantine rollback-only integration test. All mutations are reverted.
-- Synthetic Apple transaction IDs never become real credits or charges.
DO $test$
DECLARE u uuid; tx text := '999999999999990002'; reason text;
DECLARE b0 bigint; b1 bigint; first_draw jsonb; replay jsonb; ok boolean;
BEGIN
 BEGIN
  SELECT id INTO u FROM auth.users ORDER BY created_at LIMIT 1;
  IF u IS NULL THEN RAISE EXCEPTION 'no_test_account'; END IF;
  IF EXISTS(SELECT 1 FROM public.apple_purchase_claims WHERE transaction_id=tx)
   OR EXISTS(SELECT 1 FROM public.gacha_paid_draws
    WHERE draw_id IN ('mushi-refund-rollback-1','mushi-refund-rollback-2'))
  THEN RAISE EXCEPTION 'synthetic_test_data_conflict'; END IF;
  SELECT COALESCE((SELECT balance FROM public.gacha_coin_wallets WHERE user_id=u),0) INTO b0;
  UPDATE public.billing_settings SET billing_mode='live',checkout_enabled=true,ios_iap_ready=true WHERE singleton=true;
  UPDATE public.apple_iap_verification_gate SET server_jws_verified=true,sandbox_purchase_proven=true WHERE singleton=true;
  UPDATE public.apple_coin_pack_catalog SET is_sale_enabled=true WHERE product_id='mushiverse.coins.100';
  INSERT INTO public.apple_purchase_claims
   (user_id,transaction_id,original_transaction_id,product_id,environment,status)
   VALUES(u,tx,tx,'mushiverse.coins.100',NULL,'pending');
  ok := public.settle_verified_apple_coin_production(
   tx,tx,u,'mushiverse.coins.100','2026-11-21T09:00:00Z'::timestamptz);
  IF ok IS NOT TRUE THEN RAISE EXCEPTION 'synthetic_credit_failed'; END IF;
  first_draw := public.draw_with_purchased_gacha_coins_and_lr('mushi-refund-rollback-1',u,1);
  IF first_draw->>'ok'<>'true' THEN RAISE EXCEPTION 'prior_draw_failed'; END IF;
  SELECT balance INTO b1 FROM public.gacha_coin_wallets WHERE user_id=u;
  IF b1<>b0+50 THEN RAISE EXCEPTION 'prior_draw_cost_mismatch'; END IF;
  BEGIN
   PERFORM public.record_apple_refund_after_verified_jws(tx,
    '123e4567-e89b-42d3-a456-426614174000'::uuid,
    '2026-11-22T03:39:00Z'::timestamptz);
   RAISE EXCEPTION 'foreign_refund_owner_accepted';
  EXCEPTION WHEN raise_exception THEN
   GET STACKED DIAGNOSTICS reason=MESSAGE_TEXT;
   IF reason<>'refund_credit_owner_mismatch' THEN RAISE EXCEPTION '%',reason; END IF;
  END;
  ok := public.record_apple_refund_after_verified_jws(tx,u,'2026-11-22T03:39:00Z'::timestamptz);
  IF NOT ok THEN RAISE EXCEPTION 'refund_hold_failed'; END IF;
  ok := public.record_apple_refund_after_verified_jws(tx,u,'2026-11-22T03:39:00Z'::timestamptz);
  IF NOT ok THEN RAISE EXCEPTION 'idempotent_refund_failed'; END IF;
  IF (SELECT count(*) FROM public.apple_coin_refund_holds WHERE transaction_id=tx)<>1
   OR NOT EXISTS(SELECT 1 FROM public.apple_iap_events
     WHERE transaction_id=tx AND revocation_date='2026-11-22T03:39:00Z'::timestamptz)
  THEN RAISE EXCEPTION 'refund_audit_inconsistent'; END IF;
  replay := public.draw_with_purchased_gacha_coins_and_lr('mushi-refund-rollback-1',u,1);
  IF replay->>'replayed'<>'true' OR replay->'results'<>first_draw->'results'
  THEN RAISE EXCEPTION 'prior_draw_receipt_lost'; END IF;
  BEGIN
   PERFORM public.draw_with_purchased_gacha_coins_and_lr('mushi-refund-rollback-2',u,1);
   RAISE EXCEPTION 'new_draw_after_refund_allowed';
  EXCEPTION WHEN raise_exception THEN
   GET STACKED DIAGNOSTICS reason=MESSAGE_TEXT;
   IF reason<>'apple_refund_reconciliation_required' THEN RAISE EXCEPTION '%',reason; END IF;
  END;
  IF (SELECT balance FROM public.gacha_coin_wallets WHERE user_id=u)<>b1
  THEN RAISE EXCEPTION 'refund_changed_spendable_wallet'; END IF;
  RAISE EXCEPTION '__refund_rollback_success__';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS reason=MESSAGE_TEXT;
  IF reason<>'__refund_rollback_success__' THEN
    RAISE EXCEPTION 'refund_rollback_test_failed: %',reason; END IF;
 END;
END
$test$;
SELECT (SELECT count(*) FROM public.apple_coin_refund_holds WHERE transaction_id='999999999999990002') refund_holds_remaining,
(SELECT count(*) FROM public.gacha_coin_purchase_credits WHERE transaction_id='999999999999990002') synthetic_credits_remaining,
(SELECT count(*) FROM public.gacha_paid_draws WHERE draw_id IN ('mushi-refund-rollback-1','mushi-refund-rollback-2')) synthetic_draws_remaining;
