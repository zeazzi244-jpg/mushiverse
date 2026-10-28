-- Reviewed upgrade candidate for the inspected live schema, NOT an automatic migration.
-- Apply in staging and reconcile legacy credits before production. No purchase gate is enabled here.
BEGIN;
ALTER TABLE public.gacha_coin_purchase_credits ADD COLUMN IF NOT EXISTS environment text
 CHECK (environment IN ('Sandbox','Production'));
ALTER TABLE public.gacha_coin_wallets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.credit_verified_gacha_purchase_v2(
 p_transaction_id text,p_user_id uuid,p_product_id text,p_environment text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_coins integer; v_rows integer;
BEGIN
 IF p_user_id IS NULL OR p_transaction_id IS NULL OR p_transaction_id !~ '^[0-9]{6,64}$'
 OR p_environment IS NULL OR p_environment NOT IN ('Sandbox','Production') THEN RAISE EXCEPTION 'invalid_purchase'; END IF;
 v_coins:=CASE p_product_id WHEN 'mushiverse.coins.100' THEN 100 WHEN 'mushiverse.coins.550' THEN 550 WHEN 'mushiverse.coins.1200' THEN 1200 ELSE NULL END;
 IF v_coins IS NULL THEN RAISE EXCEPTION 'unknown_product'; END IF;
 INSERT INTO public.gacha_coin_purchase_credits(transaction_id,user_id,product_id,coins,environment)
 VALUES(p_transaction_id,p_user_id,p_product_id,v_coins,p_environment) ON CONFLICT(transaction_id) DO NOTHING;
 GET DIAGNOSTICS v_rows=ROW_COUNT;
 IF v_rows=0 THEN
  IF NOT EXISTS (SELECT 1 FROM public.gacha_coin_purchase_credits WHERE transaction_id=p_transaction_id
   AND user_id=p_user_id AND product_id=p_product_id AND environment=p_environment AND coins=v_coins)
  THEN RAISE EXCEPTION 'transaction_conflict'; END IF;
  RETURN true; -- Same verified purchase: success acknowledgment, never a second credit.
 END IF;
 INSERT INTO public.gacha_coin_wallets(user_id,balance,updated_at) VALUES(p_user_id,v_coins,now())
 ON CONFLICT(user_id) DO UPDATE SET balance=public.gacha_coin_wallets.balance+excluded.balance,updated_at=now();
 RETURN true;
END;$$;
REVOKE ALL ON FUNCTION public.credit_verified_gacha_purchase_v2(text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.credit_verified_gacha_purchase_v2(text,uuid,text,text) TO service_role;

-- Atomic debit and result persist. Never call the standalone spend RPC for a paid draw.
CREATE OR REPLACE FUNCTION public.draw_with_purchased_gacha_coins_v2(p_draw_id text,p_user_id uuid,p_count integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_cost integer; v_balance bigint; v_previous public.gacha_paid_draws%ROWTYPE;
 v_results jsonb:='[]'::jsonb; v_roll numeric; v_pick numeric; v_rarity text; v_card integer;
BEGIN
 IF p_user_id IS NULL OR p_draw_id IS NULL OR length(p_draw_id)<8 OR length(p_draw_id)>120
 OR p_count IS NULL OR p_count NOT IN (1,10) THEN RAISE EXCEPTION 'invalid_draw'; END IF;
 v_cost:=CASE p_count WHEN 1 THEN 50 ELSE 450 END;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 SELECT * INTO v_previous FROM public.gacha_paid_draws WHERE draw_id=p_draw_id;
 IF FOUND THEN
  IF v_previous.user_id<>p_user_id OR v_previous.draw_count<>p_count OR v_previous.coins_spent<>v_cost
  THEN RAISE EXCEPTION 'draw_conflict'; END IF;
  SELECT balance INTO v_balance FROM public.gacha_coin_wallets WHERE user_id=p_user_id;
  RETURN pg_catalog.jsonb_build_object('ok',true,'replayed',true,'results',v_previous.results,'balance',v_balance);
 END IF;
 SELECT balance INTO v_balance FROM public.gacha_coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF coalesce(v_balance,0)<v_cost THEN RETURN pg_catalog.jsonb_build_object('ok',false,'reason','insufficient_balance'); END IF;
 FOR i IN 1..p_count LOOP
  -- First 32 UUID-v4 bits are random; no version/variant bits in this segment.
  v_roll:=(('x'||substr(pg_catalog.gen_random_uuid()::text,1,8))::bit(32)::bigint)::numeric/4294967296;
  v_pick:=(('x'||substr(pg_catalog.gen_random_uuid()::text,1,8))::bit(32)::bigint)::numeric/4294967296;
  IF v_roll<0.001 THEN v_rarity:='SSR';v_card:=91+floor(v_pick*10)::integer;
  ELSIF v_roll<0.02 THEN v_rarity:='SR';v_card:=71+floor(v_pick*20)::integer;
  ELSIF v_roll<0.20 THEN v_rarity:='R';v_card:=41+floor(v_pick*30)::integer;
  ELSE v_rarity:='N';v_card:=1+floor(v_pick*40)::integer; END IF;
  v_results:=v_results||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('card_id',v_card,'rarity',v_rarity,'catalog_version',1));
 END LOOP;
 UPDATE public.gacha_coin_wallets SET balance=balance-v_cost,updated_at=now() WHERE user_id=p_user_id;
 INSERT INTO public.gacha_paid_draws(draw_id,user_id,draw_count,coins_spent,results) VALUES(p_draw_id,p_user_id,p_count,v_cost,v_results);
 RETURN pg_catalog.jsonb_build_object('ok',true,'replayed',false,'results',v_results,'balance',v_balance-v_cost);
END;$$;
REVOKE ALL ON FUNCTION public.draw_with_purchased_gacha_coins_v2(text,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.draw_with_purchased_gacha_coins_v2(text,uuid,integer) TO service_role;
GRANT SELECT,INSERT ON public.gacha_coin_purchase_credits,public.gacha_paid_draws TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.gacha_coin_wallets TO service_role;
COMMIT;
