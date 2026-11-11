-- Run against mushi-log before enabling Apple IAP.
-- Guard against accidental client-side writes to trusted purchase state.
DO $guard$
DECLARE
  t text;
  n integer;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'apple_iap_events',
    'premium_entitlements',
    'gacha_coin_purchase_credits',
    'gacha_coin_wallets'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
      WHERE ns.nspname='public' AND c.relname=t AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'IAP table missing RLS: %',t;
    END IF;
    SELECT count(*) INTO n FROM pg_policy p
      JOIN pg_class c ON c.oid=p.polrelid
      JOIN pg_namespace ns ON ns.oid=c.relnamespace
      WHERE ns.nspname='public' AND c.relname=t
      AND p.polcmd IN ('a','w','d','*')
      AND (p.polroles @> ARRAY['anon'::regrole::oid]::oid[]
        OR p.polroles @> ARRAY['authenticated'::regrole::oid]::oid[]
        OR p.polroles @> ARRAY[0::oid]::oid[]);
    IF n>0 THEN RAISE EXCEPTION 'Client write policy on %',t; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.billing_settings
             WHERE billing_mode <> 'off' OR checkout_enabled OR ios_iap_ready) THEN
    RAISE EXCEPTION 'Billing enabled before Apple Sandbox verification';
  END IF;
END $guard$;
