-- Server-authoritative 10-draw real DB test: all mutations roll back.
DO $qa$
DECLARE v_user uuid; v_draw text:='qa-10draw-rollback-20261121-001';
DECLARE v_before bigint; v_after bigint; v_repeat bigint;
DECLARE v_first jsonb; v_second jsonb; v_count integer; v_error text;
BEGIN
  BEGIN
    SELECT id INTO v_user FROM auth.users ORDER BY created_at LIMIT 1;
    IF v_user IS NULL OR EXISTS(SELECT 1 FROM public.gacha_paid_draws WHERE draw_id=v_draw)
      THEN RAISE EXCEPTION 'qa_setup_failed'; END IF;
    SELECT COALESCE((SELECT balance FROM public.gacha_coin_wallets WHERE user_id=v_user),0) INTO v_before;
    INSERT INTO public.gacha_coin_wallets(user_id,balance) VALUES(v_user,500)
      ON CONFLICT(user_id) DO UPDATE SET balance=public.gacha_coin_wallets.balance+500;
    v_first:=public.draw_with_purchased_gacha_coins_and_lr(v_draw,v_user,10);
    IF v_first->>'ok'<>'true' OR v_first->>'replayed'<>'false'
       OR pg_catalog.jsonb_array_length(v_first->'results')<>10
      THEN RAISE EXCEPTION 'ten_draw_failed'; END IF;
    SELECT balance INTO v_after FROM public.gacha_coin_wallets WHERE user_id=v_user;
    IF v_after<>v_before+50 THEN RAISE EXCEPTION 'ten_draw_cost_invalid'; END IF;
    v_second:=public.draw_with_purchased_gacha_coins_and_lr(v_draw,v_user,10);
    SELECT balance INTO v_repeat FROM public.gacha_coin_wallets WHERE user_id=v_user;
    SELECT count(*) INTO v_count FROM public.gacha_paid_draws
      WHERE draw_id=v_draw AND draw_count=10 AND coins_spent=450;
    IF v_count<>1 OR v_repeat<>v_after OR v_first->'results'<>v_second->'results'
       OR v_second->>'replayed'<>'true' THEN RAISE EXCEPTION 'ten_draw_replay_invalid'; END IF;
    RAISE EXCEPTION '__rollback_success__';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
    IF v_error<>'__rollback_success__' THEN RAISE EXCEPTION 'ten_draw_qa_failed: %',v_error; END IF;
  END;
END $qa$;
SELECT count(*) AS residual_draws FROM public.gacha_paid_draws
  WHERE draw_id='qa-10draw-rollback-20261121-001';
