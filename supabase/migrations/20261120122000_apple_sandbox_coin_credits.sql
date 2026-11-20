-- Sandbox balances are derived from this ledger and never enter spendable wallets.
CREATE TABLE public.apple_sandbox_coin_credits (
  transaction_id text PRIMARY KEY CHECK (transaction_id ~ '^[0-9]{6,30}$'),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coins integer NOT NULL DEFAULT 100 CHECK (coins = 100),
  credited_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.apple_sandbox_coin_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apple_sandbox_coin_credits FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.record_apple_sandbox_coin_credit(p_transaction_id text, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
BEGIN
  -- Lock the pending claim against changes while inserting its verified credit.
  PERFORM 1 FROM public.apple_purchase_claims
  WHERE transaction_id = p_transaction_id
    AND original_transaction_id = p_transaction_id
    AND user_id = p_user_id
    AND product_id = 'mushiverse.coins.100'
    AND status = 'pending'
    AND (environment IS NULL OR environment = 'Sandbox')
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.apple_sandbox_coin_credits(transaction_id, user_id)
  VALUES (p_transaction_id, p_user_id)
  ON CONFLICT (transaction_id) DO NOTHING;

  RETURN EXISTS (
    SELECT 1 FROM public.apple_sandbox_coin_credits
    WHERE transaction_id = p_transaction_id AND user_id = p_user_id
  );
END
$fn$;
REVOKE ALL ON FUNCTION public.record_apple_sandbox_coin_credit(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_apple_sandbox_coin_credit(text, uuid) TO service_role;
