-- Account-access policy account_active_v21 was permissive FOR ALL, which
-- includes SELECT. Combined with owner-read SELECT policies (OR semantics),
-- it could expose any paid wallet, paid draw or purchase-credit row to another
-- active account. Keep narrow owner-read policies; disallow the broad policy.
-- No client INSERT/UPDATE/DELETE privileges exist on these ledger tables.
DROP POLICY IF EXISTS account_active_v21 ON public.gacha_coin_wallets;
DROP POLICY IF EXISTS account_active_v21 ON public.gacha_paid_draws;
DROP POLICY IF EXISTS account_active_v21 ON public.gacha_coin_purchase_credits;

-- Defense in depth: block client mutation regardless of future policy changes.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.gacha_coin_wallets,
  public.gacha_paid_draws,
  public.gacha_coin_purchase_credits
  FROM PUBLIC, anon, authenticated;
