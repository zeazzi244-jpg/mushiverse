-- Test paid-gacha coins, replay protection, ten-draw charge and rollback.
-- All changes are reverted by the deliberate inner exception.
DO $test$
DECLARE u uuid; b0 bigint; b1 bigint; b2 bigint;
DECLARE d1 jsonb; d1again jsonb; d10 jsonb; reason text;
BEGIN
  BEGIN
    SELECT id INTO u FROM auth.users ORDER BY created_at LIMIT 1;
    IF u IS NULL THEN RAISE EXCEPTION 'no_test_user'; END IF;
    IF EXISTS(SELECT 1 FROM public.gacha_paid_draws WHERE
      draw_id IN ('mushi-paid-rollback-1','mushi-paid-rollback-10'))
    THEN RAISE EXCEPTION 'synthetic_draw_id_in_use'; END IF;
    SELECT COALESCE((SELECT balance FROM public.gacha_coin_wallets WHERE user_id=u),0) INTO b0;
    INSERT INTO public.gacha_coin_wallets(user_id,balance) VALUES(u,500)
      ON CONFLICT(user_id) DO UPDATE SET balance=public.gacha_coin_wallets.balance+500;

    d1 := public.draw_with_purchased_gacha_coins_and_lr('mushi-paid-rollback-1',u,1);
    IF d1->>'ok'<>'true' OR pg_catalog.jsonb_array_length(d1->'results')<>1
    THEN RAISE EXCEPTION 'first_draw_failed'; END IF;
    SELECT balance INTO b1 FROM public.gacha_coin_wallets WHERE user_id=u;
    IF b1<>b0+450 THEN RAISE EXCEPTION 'one_draw_charge_wrong'; END IF;

    d1again := public.draw_with_purchased_gacha_coins_and_lr('mushi-paid-rollback-1',u,1);
    IF d1again->>'replayed'<>'true' OR d1again->'results'<>d1->'results'
    THEN RAISE EXCEPTION 'replay_mismatch'; END IF;
    SELECT balance INTO b2 FROM public.gacha_coin_wallets WHERE user_id=u;
    IF b2<>b1 THEN RAISE EXCEPTION 'double_charge'; END IF;

    d10 := public.draw_with_purchased_gacha_coins_and_lr('mushi-paid-rollback-10',u,10);
    IF d10->>'ok'<>'true' OR pg_catalog.jsonb_array_length(d10->'results')<>10
    THEN RAISE EXCEPTION 'ten_draw_failed'; END IF;
    SELECT balance INTO b2 FROM public.gacha_coin_wallets WHERE user_id=u;
    IF b2<>b0 THEN RAISE EXCEPTION 'ten_draw_charge_wrong'; END IF;
    RAISE EXCEPTION '__rollback_paid_gacha_success__';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS reason = MESSAGE_TEXT;
    IF reason<>'__rollback_paid_gacha_success__'
      THEN RAISE EXCEPTION 'paid_draw_rollback_test_failed: %',reason; END IF;
  END;
END
$test$;
SELECT count(*) AS synthetic_draws_remaining FROM public.gacha_paid_draws
WHERE draw_id IN ('mushi-paid-rollback-1','mushi-paid-rollback-10');
