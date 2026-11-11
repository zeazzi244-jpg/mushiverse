-- Regression: no unverified Apple event may create a coin credit.
-- The inner INSERT is expected to fail, and its subtransaction is rolled back.
DO $test$
BEGIN
  BEGIN
    INSERT INTO public.gacha_coin_purchase_credits
      (transaction_id,user_id,product_id,coins,verified_at)
    VALUES
      ('iap_guard_probe_unverified_20261112',
       '00000000-0000-0000-0000-000000000000',
       'mushiverse.coins.100',100,now());
    RAISE EXCEPTION 'GUARD FAILED: unverified coin credit accepted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'apple_coin_credit_requires_verified_transaction' THEN
      RAISE;
    END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.gacha_coin_purchase_credits
             WHERE transaction_id='iap_guard_probe_unverified_20261112') THEN
    RAISE EXCEPTION 'GUARD FAILED: test credit persisted';
  END IF;
END
$test$;
