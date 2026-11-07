-- Staging candidate only. Isolated v2 ledger: never migrate unverified legacy balances.
-- Sandbox coins can NEVER fund Production draws. Deploy no gates from this file.
BEGIN;
CREATE SCHEMA IF NOT EXISTS mushiverse_billing_private;
REVOKE ALL ON SCHEMA mushiverse_billing_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA mushiverse_billing_private TO service_role;

-- Minimal privileged lookup in an unexposed schema; callers are trusted service code only.
-- Row locks serialize session revocation/user deletion with the financial transaction.
CREATE OR REPLACE FUNCTION mushiverse_billing_private.require_coin_session(p_user_id uuid,p_session_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_user_id IS NULL OR p_session_id IS NULL THEN RAISE EXCEPTION 'inactive_session'; END IF;
 PERFORM 1 FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id
 WHERE s.id=p_session_id AND s.user_id=p_user_id AND u.deleted_at IS NULL
 AND (u.banned_until IS NULL OR u.banned_until<=now())
 AND (s.not_after IS NULL OR s.not_after>now()) FOR SHARE OF s,u;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_session'; END IF;
END;$$;
REVOKE ALL ON FUNCTION mushiverse_billing_private.require_coin_session(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mushiverse_billing_private.require_coin_session(uuid,uuid) TO service_role;

CREATE TABLE IF NOT EXISTS public.gacha_coin_wallets_v2 (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 environment text NOT NULL CHECK(environment IN ('Sandbox','Production')),
 balance bigint NOT NULL DEFAULT 0 CHECK(balance>=0),debt bigint NOT NULL DEFAULT 0 CHECK(debt>=0),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,environment)
);
ALTER TABLE public.gacha_coin_wallets_v2 ADD COLUMN IF NOT EXISTS debt bigint NOT NULL DEFAULT 0 CHECK(debt>=0);
-- Keep transaction tombstones after account deletion, so purchase proof can never be reassigned.
CREATE TABLE IF NOT EXISTS public.gacha_coin_purchase_credits_v2 (
 environment text NOT NULL CHECK(environment IN ('Sandbox','Production')),transaction_id text NOT NULL,
 user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,product_id text NOT NULL,
 coins integer NOT NULL CHECK(coins>0),verified_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(environment,transaction_id)
);
CREATE TABLE IF NOT EXISTS public.gacha_paid_draws_v2 (
 environment text NOT NULL CHECK(environment IN ('Sandbox','Production')),draw_id text NOT NULL,
 user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,draw_count integer NOT NULL CHECK(draw_count IN (1,10)),
 coins_spent integer NOT NULL CHECK(coins_spent IN (50,450)),results jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(environment,draw_id)
);
CREATE INDEX IF NOT EXISTS coin_credits_v2_user_idx ON public.gacha_coin_purchase_credits_v2(user_id);
CREATE INDEX IF NOT EXISTS paid_draws_v2_user_idx ON public.gacha_paid_draws_v2(user_id);
ALTER TABLE public.gacha_coin_wallets_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_coin_purchase_credits_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_paid_draws_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gacha_coin_wallets_v2,public.gacha_coin_purchase_credits_v2,public.gacha_paid_draws_v2 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.gacha_coin_wallets_v2,public.gacha_coin_purchase_credits_v2,public.gacha_paid_draws_v2 TO authenticated;
DROP POLICY IF EXISTS wallet_v2_own ON public.gacha_coin_wallets_v2;
CREATE POLICY wallet_v2_own ON public.gacha_coin_wallets_v2 FOR SELECT TO authenticated USING((select auth.uid())=user_id);
DROP POLICY IF EXISTS credit_v2_own ON public.gacha_coin_purchase_credits_v2;
CREATE POLICY credit_v2_own ON public.gacha_coin_purchase_credits_v2 FOR SELECT TO authenticated USING((select auth.uid())=user_id);
DROP POLICY IF EXISTS draw_v2_own ON public.gacha_paid_draws_v2;
CREATE POLICY draw_v2_own ON public.gacha_paid_draws_v2 FOR SELECT TO authenticated USING((select auth.uid())=user_id);
GRANT SELECT,INSERT ON public.gacha_coin_purchase_credits_v2,public.gacha_paid_draws_v2 TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.gacha_coin_wallets_v2 TO service_role;

-- Apple status/notification deduplication contain no user-supplied coin amounts or raw JWS.
CREATE TABLE IF NOT EXISTS public.gacha_coin_apple_status_v2(
 environment text NOT NULL CHECK(environment IN ('Sandbox','Production')),transaction_id text NOT NULL,
 product_id text NOT NULL,refunded boolean NOT NULL,status_ms bigint NOT NULL CHECK(status_ms>0),
 PRIMARY KEY(environment,transaction_id)
);
CREATE TABLE IF NOT EXISTS public.gacha_coin_apple_events_v2(
 environment text NOT NULL CHECK(environment IN ('Sandbox','Production')),notification_id uuid NOT NULL,
 transaction_id text NOT NULL,product_id text NOT NULL,processed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(environment,notification_id)
);
ALTER TABLE public.gacha_coin_apple_status_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_coin_apple_events_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gacha_coin_apple_status_v2,public.gacha_coin_apple_events_v2 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.gacha_coin_apple_status_v2 TO service_role;
GRANT SELECT,INSERT ON public.gacha_coin_apple_events_v2 TO service_role;

-- All wallet mutations normalize balance/debt from the same net position under a row lock.
CREATE OR REPLACE FUNCTION mushiverse_billing_private.change_coin_net(p_user_id uuid,p_environment text,p_delta bigint)
 RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_net bigint;
BEGIN
 INSERT INTO public.gacha_coin_wallets_v2(user_id,environment,balance,debt) VALUES(p_user_id,p_environment,0,0)
 ON CONFLICT(user_id,environment) DO NOTHING;
 SELECT balance-debt INTO v_net FROM public.gacha_coin_wallets_v2 WHERE user_id=p_user_id AND environment=p_environment FOR UPDATE;
 v_net:=v_net+p_delta;
 UPDATE public.gacha_coin_wallets_v2 SET balance=greatest(0,v_net),debt=greatest(0,-v_net),updated_at=now()
 WHERE user_id=p_user_id AND environment=p_environment;
END;$$;
REVOKE ALL ON FUNCTION mushiverse_billing_private.change_coin_net(uuid,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mushiverse_billing_private.change_coin_net(uuid,text,bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_verified_apple_coin_status_v2(
 p_notification_id uuid,p_transaction_id text,p_product_id text,p_environment text,p_refunded boolean,p_status_ms bigint
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_status public.gacha_coin_apple_status_v2%ROWTYPE;v_credit public.gacha_coin_purchase_credits_v2%ROWTYPE;
BEGIN
 IF p_notification_id IS NULL OR p_transaction_id IS NULL OR p_transaction_id !~ '^[0-9]{6,64}$'
 OR p_product_id IS NULL OR p_product_id NOT IN ('mushiverse.coins.100','mushiverse.coins.550','mushiverse.coins.1200')
 OR p_environment IS NULL OR p_environment NOT IN ('Sandbox','Production') OR p_refunded IS NULL
 OR p_status_ms IS NULL OR p_status_ms<=0 OR p_status_ms>extract(epoch FROM now())*1000+60000 THEN RAISE EXCEPTION 'invalid_apple_status'; END IF;
 -- Same purchase lock and ordering in credit/status: purchase -> credit/status rows -> wallet.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('apple:'||p_environment||':'||p_transaction_id,0));
 IF EXISTS(SELECT 1 FROM public.gacha_coin_apple_events_v2 WHERE environment=p_environment AND notification_id=p_notification_id) THEN
  IF NOT EXISTS(SELECT 1 FROM public.gacha_coin_apple_events_v2 WHERE environment=p_environment AND notification_id=p_notification_id AND transaction_id=p_transaction_id AND product_id=p_product_id) THEN RAISE EXCEPTION 'notification_conflict';END IF;
  RETURN true;
 END IF;
 SELECT * INTO v_status FROM public.gacha_coin_apple_status_v2 WHERE environment=p_environment AND transaction_id=p_transaction_id;
 IF FOUND THEN
  IF v_status.product_id<>p_product_id THEN RAISE EXCEPTION 'product_conflict';END IF;
  IF p_status_ms<v_status.status_ms THEN
   INSERT INTO public.gacha_coin_apple_events_v2(environment,notification_id,transaction_id,product_id) VALUES(p_environment,p_notification_id,p_transaction_id,p_product_id);RETURN true;
  END IF;
  IF p_status_ms=v_status.status_ms AND p_refunded<>v_status.refunded THEN RAISE EXCEPTION 'ambiguous_apple_status';END IF;
 END IF;
 SELECT * INTO v_credit FROM public.gacha_coin_purchase_credits_v2 WHERE environment=p_environment AND transaction_id=p_transaction_id;
 IF FOUND THEN
  IF v_credit.product_id<>p_product_id THEN RAISE EXCEPTION 'product_conflict';END IF;
  IF v_credit.user_id IS NOT NULL AND p_refunded IS DISTINCT FROM coalesce(v_status.refunded,false) THEN
   PERFORM mushiverse_billing_private.change_coin_net(v_credit.user_id,p_environment,CASE WHEN p_refunded THEN -v_credit.coins ELSE v_credit.coins END);
  END IF;
 END IF;
 INSERT INTO public.gacha_coin_apple_status_v2(environment,transaction_id,product_id,refunded,status_ms)
 VALUES(p_environment,p_transaction_id,p_product_id,p_refunded,p_status_ms)
 ON CONFLICT(environment,transaction_id) DO UPDATE SET refunded=excluded.refunded,status_ms=excluded.status_ms;
 INSERT INTO public.gacha_coin_apple_events_v2(environment,notification_id,transaction_id,product_id) VALUES(p_environment,p_notification_id,p_transaction_id,p_product_id);
 RETURN true;
END;$$;
REVOKE ALL ON FUNCTION public.apply_verified_apple_coin_status_v2(uuid,text,text,text,boolean,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_apple_coin_status_v2(uuid,text,text,text,boolean,bigint) TO service_role;

-- Retire earlier candidate overloads if a staging DB already contains them.
-- These names are not the legacy live production credit/spend/draw functions.
DROP FUNCTION IF EXISTS public.credit_verified_gacha_purchase_v2(text,uuid,text,text);
DROP FUNCTION IF EXISTS public.draw_with_purchased_gacha_coins_v2(text,uuid,integer);
CREATE OR REPLACE FUNCTION public.credit_verified_gacha_purchase_v2(
 p_transaction_id text,p_user_id uuid,p_product_id text,p_environment text,p_session_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_coins integer;v_rows integer;
BEGIN
 PERFORM mushiverse_billing_private.require_coin_session(p_user_id,p_session_id);
 IF p_transaction_id IS NULL OR p_transaction_id !~ '^[0-9]{6,64}$' OR p_environment IS NULL
 OR p_environment NOT IN ('Sandbox','Production') THEN RAISE EXCEPTION 'invalid_purchase'; END IF;
 v_coins:=CASE p_product_id WHEN 'mushiverse.coins.100' THEN 100 WHEN 'mushiverse.coins.550' THEN 550 WHEN 'mushiverse.coins.1200' THEN 1200 ELSE NULL END;
 IF v_coins IS NULL THEN RAISE EXCEPTION 'unknown_product'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('apple:'||p_environment||':'||p_transaction_id,0));
 IF EXISTS(SELECT 1 FROM public.gacha_coin_apple_status_v2 WHERE environment=p_environment AND transaction_id=p_transaction_id AND (refunded OR product_id<>p_product_id)) THEN RAISE EXCEPTION 'refunded_or_conflicting_purchase';END IF;
 INSERT INTO public.gacha_coin_purchase_credits_v2(environment,transaction_id,user_id,product_id,coins)
 VALUES(p_environment,p_transaction_id,p_user_id,p_product_id,v_coins) ON CONFLICT(environment,transaction_id) DO NOTHING;
 GET DIAGNOSTICS v_rows=ROW_COUNT;
 IF v_rows=0 THEN
  IF NOT EXISTS(SELECT 1 FROM public.gacha_coin_purchase_credits_v2 WHERE environment=p_environment
   AND transaction_id=p_transaction_id AND user_id=p_user_id AND product_id=p_product_id AND coins=v_coins)
  THEN RAISE EXCEPTION 'transaction_conflict'; END IF;
  RETURN true;
 END IF;
 PERFORM mushiverse_billing_private.change_coin_net(p_user_id,p_environment,v_coins);
 RETURN true;
END;$$;
REVOKE ALL ON FUNCTION public.credit_verified_gacha_purchase_v2(text,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.credit_verified_gacha_purchase_v2(text,uuid,text,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.draw_with_purchased_gacha_coins_v2(
 p_draw_id text,p_user_id uuid,p_count integer,p_environment text,p_session_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_cost integer;v_balance bigint;v_debt bigint;v_previous public.gacha_paid_draws_v2%ROWTYPE;
 v_results jsonb:='[]'::jsonb;v_roll numeric;v_pick numeric;v_rarity text;v_card integer;
BEGIN
 PERFORM mushiverse_billing_private.require_coin_session(p_user_id,p_session_id);
 IF p_draw_id IS NULL OR length(p_draw_id)<8 OR length(p_draw_id)>120 OR p_count IS NULL
 OR p_count NOT IN (1,10) OR p_environment IS NULL OR p_environment NOT IN ('Sandbox','Production') THEN RAISE EXCEPTION 'invalid_draw'; END IF;
 v_cost:=CASE p_count WHEN 1 THEN 50 ELSE 450 END;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text||p_environment,0));
 SELECT * INTO v_previous FROM public.gacha_paid_draws_v2 WHERE environment=p_environment AND draw_id=p_draw_id;
 IF FOUND THEN
  IF v_previous.user_id IS DISTINCT FROM p_user_id OR v_previous.draw_count<>p_count OR v_previous.coins_spent<>v_cost THEN RAISE EXCEPTION 'draw_conflict'; END IF;
  SELECT balance,debt INTO v_balance,v_debt FROM public.gacha_coin_wallets_v2 WHERE user_id=p_user_id AND environment=p_environment;
  RETURN pg_catalog.jsonb_build_object('ok',true,'replayed',true,'results',v_previous.results,'balance',v_balance);
 END IF;
 SELECT balance,debt INTO v_balance,v_debt FROM public.gacha_coin_wallets_v2 WHERE user_id=p_user_id AND environment=p_environment FOR UPDATE;
 IF coalesce(v_debt,0)>0 THEN RETURN pg_catalog.jsonb_build_object('ok',false,'reason','refund_review_required');END IF;
 IF coalesce(v_balance,0)<v_cost THEN RETURN pg_catalog.jsonb_build_object('ok',false,'reason','insufficient_balance'); END IF;
 FOR i IN 1..p_count LOOP
  v_roll:=(('x'||substr(pg_catalog.gen_random_uuid()::text,1,8))::bit(32)::bigint)::numeric/4294967296;
  v_pick:=(('x'||substr(pg_catalog.gen_random_uuid()::text,1,8))::bit(32)::bigint)::numeric/4294967296;
  IF v_roll<0.001 THEN v_rarity:='SSR';v_card:=91+floor(v_pick*10)::integer;
  ELSIF v_roll<0.02 THEN v_rarity:='SR';v_card:=71+floor(v_pick*20)::integer;
  ELSIF v_roll<0.20 THEN v_rarity:='R';v_card:=41+floor(v_pick*30)::integer;
  ELSE v_rarity:='N';v_card:=1+floor(v_pick*40)::integer;END IF;
  v_results:=v_results||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('card_id',v_card,'rarity',v_rarity,'catalog_version',1));
 END LOOP;
 UPDATE public.gacha_coin_wallets_v2 SET balance=balance-v_cost,updated_at=now() WHERE user_id=p_user_id AND environment=p_environment;
 INSERT INTO public.gacha_paid_draws_v2(environment,draw_id,user_id,draw_count,coins_spent,results) VALUES(p_environment,p_draw_id,p_user_id,p_count,v_cost,v_results);
 RETURN pg_catalog.jsonb_build_object('ok',true,'replayed',false,'results',v_results,'balance',v_balance-v_cost);
END;$$;
REVOKE ALL ON FUNCTION public.draw_with_purchased_gacha_coins_v2(text,uuid,integer,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.draw_with_purchased_gacha_coins_v2(text,uuid,integer,text,uuid) TO service_role;
COMMIT;
