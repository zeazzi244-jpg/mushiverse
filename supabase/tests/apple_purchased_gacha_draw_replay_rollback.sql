-- Safe real-database regression: both draw and replay run in one nested
-- transaction and every balance/card mutation is intentionally rolled back.
DO $qa$
DECLARE v_user uuid; v_draw text:='qa-paid-draw-rollback-20261121-001';
DECLARE v_before bigint; v_after bigint; v_repeat bigint;
DECLARE v_first jsonb; v_second jsonb; v_count integer; v_error text;
BEGIN
 BEGIN
   SELECT id INTO v_user FROM auth.users ORDER BY created_at LIMIT 1;
   IF v_user IS NULL THEN RAISE EXCEPTION 'test_user_missing'; END IF;
   IF EXISTS(SELECT 1 FROM public.gacha_paid_draws WHERE draw_id=v_draw) THEN RAISE EXCEPTION 'qa_draw_id_already_exists'; END IF;
   SELECT COALESCE((SELECT balance FROM public.gacha_coin_wallets WHERE user_id=v_user),0) INTO v_before;
   INSERT INTO public.gacha_coin_wallets(user_id,balance) VALUES(v_user,500)
   ON CONFLICT(user_id) DO UPDATE SET balance=public.gacha_coin_wallets.balance+500;
   v_first:=public.draw_with_purchased_gacha_coins_and_lr(v_draw,v_user,1);
   IF v_first->>'ok' <> 'true' OR v_first->>'replayed' <> 'false'
     OR jsonb_array_length(v_first->'results')<>1 THEN RAISE EXCEPTION 'first_paid_draw_failed'; END IF;
   SELECT balance INTO v_after FROM public.gacha_coin_wallets WHERE user_id=v_user;
   IF v_after <> v_before+450 THEN RAISE EXCEPTION 'draw_wrong_coin_delta'; END IF;
   v_second:=public.draw_with_purchased_gacha_coins_and_lr(v_draw,v_user,1);
   SELECT balance INTO v_repeat FROM public.gacha_coin_wallets WHERE user_id=v_user;
   SELECT count(*) INTO v_count FROM public.gacha_paid_draws WHERE draw_id=v_draw;
   IF v_second->>'replayed' <> 'true' OR v_repeat<>v_after OR v_count<>1
      OR v_first->'results'<>v_second->'results' THEN
      RAISE EXCEPTION 'paid_draw_replay_not_idempotent';
   END IF;
   RAISE EXCEPTION '__paid_draw_qa_rollback_success__';
 EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
   IF v_error<>'__paid_draw_qa_rollback_success__' THEN
     RAISE EXCEPTION 'qa_failed:%',v_error;
   END IF;
 END;
END $qa$;
SELECT (SELECT count(*) FROM public.gacha_paid_draws
 WHERE draw_id='qa-paid-draw-rollback-20261121-001') AS residual_draws,
 (SELECT billing_mode FROM public.billing_settings WHERE singleton=true) AS billing_mode;
