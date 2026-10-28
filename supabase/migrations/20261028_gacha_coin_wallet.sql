-- MUSHIVERSE: server-authoritative coin wallet foundation.
-- Apply only after review. Apple verified transactions must be checked by a trusted backend.
BEGIN;
CREATE TABLE IF NOT EXISTS public.gacha_coin_wallets (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gacha_coin_purchase_credits (
 transaction_id text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 product_id text NOT NULL,
 coins integer NOT NULL CHECK (coins > 0),
 environment text NOT NULL CHECK (environment IN ('Sandbox','Production')),
 verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gacha_coin_purchase_credits_user_idx ON public.gacha_coin_purchase_credits(user_id);
ALTER TABLE public.gacha_coin_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_coin_purchase_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gacha_coin_wallets, public.gacha_coin_purchase_credits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.gacha_coin_wallets, public.gacha_coin_purchase_credits TO authenticated;
DROP POLICY IF EXISTS gacha_wallet_select_own ON public.gacha_coin_wallets;
CREATE POLICY gacha_wallet_select_own ON public.gacha_coin_wallets FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
DROP POLICY IF EXISTS gacha_credit_select_own ON public.gacha_coin_purchase_credits;
CREATE POLICY gacha_credit_select_own ON public.gacha_coin_purchase_credits FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
-- Only the backend service role may execute the credit function.
-- Call ONLY after independently verifying the Apple signed transaction and matching user/product.
CREATE OR REPLACE FUNCTION public.credit_verified_gacha_purchase(
 p_transaction_id text,p_user_id uuid,p_product_id text,p_environment text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_coins integer; v_inserted integer;
BEGIN
 IF p_transaction_id IS NULL OR length(p_transaction_id)<1 OR p_user_id IS NULL THEN RAISE EXCEPTION 'invalid purchase'; END IF;
 v_coins := CASE p_product_id WHEN 'mushiverse.coins.100' THEN 100 WHEN 'mushiverse.coins.550' THEN 550 WHEN 'mushiverse.coins.1200' THEN 1200 ELSE NULL END;
 IF v_coins IS NULL OR p_environment NOT IN ('Sandbox','Production') THEN RAISE EXCEPTION 'unknown product or environment'; END IF;
 INSERT INTO public.gacha_coin_purchase_credits(transaction_id,user_id,product_id,coins,environment)
 VALUES(p_transaction_id,p_user_id,p_product_id,v_coins,p_environment)
 ON CONFLICT(transaction_id) DO NOTHING;
 GET DIAGNOSTICS v_inserted = ROW_COUNT;
 IF v_inserted=0 THEN
  IF NOT EXISTS (SELECT 1 FROM public.gacha_coin_purchase_credits WHERE transaction_id=p_transaction_id AND user_id=p_user_id AND product_id=p_product_id)
  THEN RAISE EXCEPTION 'transaction already claimed by different purchase'; END IF;
  RETURN false;
 END IF;
 INSERT INTO public.gacha_coin_wallets(user_id,balance,updated_at)
 VALUES(p_user_id,v_coins,now())
 ON CONFLICT(user_id) DO UPDATE SET balance=public.gacha_coin_wallets.balance+excluded.balance,updated_at=now();
 RETURN true;
END;$$;
REVOKE ALL ON FUNCTION public.credit_verified_gacha_purchase(text,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_verified_gacha_purchase(text,uuid,text,text) TO service_role;
COMMIT;
