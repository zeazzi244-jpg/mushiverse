-- Fail-closed Apple IAP release gate (read-only; no grants or mutations).
-- Run against Supabase mushi-log before considering a production release.
-- This does NOT replace Apple-signed transaction verification or Sandbox tests.
DO $$
DECLARE problems text;
BEGIN
 SELECT string_agg(problem, '; ') INTO problems FROM (
   SELECT 'ios_iap_ready or checkout_enabled is true' AS problem
   FROM public.billing_settings
   WHERE ios_iap_ready IS TRUE OR checkout_enabled IS TRUE
   UNION ALL
   SELECT 'coin pack enabled: ' || product_id
   FROM public.apple_coin_pack_catalog WHERE is_sale_enabled IS TRUE
   UNION ALL
   SELECT 'unverified/revoked/non-production coin credit: ' || c.transaction_id
   FROM public.gacha_coin_purchase_credits c
   LEFT JOIN public.apple_iap_events e ON e.transaction_id=c.transaction_id
   WHERE e.transaction_id IS NULL OR e.verified_at IS NULL
      OR e.revocation_date IS NOT NULL OR e.environment IS DISTINCT FROM 'Production'
      OR e.user_id IS DISTINCT FROM c.user_id OR e.product_id IS DISTINCT FROM c.product_id
   UNION ALL
   SELECT 'unexpected pack catalog: ' || product_id
   FROM public.apple_coin_pack_catalog
   WHERE (product_id, coins, planned_price_jpy) NOT IN (
     VALUES ('mushiverse.coins.100',100,160),
            ('mushiverse.coins.300',300,320),
            ('mushiverse.coins.500',500,480),
            ('mushiverse.coins.1200',1200,980),
            ('mushiverse.coins.2500',2500,1800),
            ('mushiverse.coins.5500',5500,3600),
            ('mushiverse.coins.12000',12000,7800))
   UNION ALL
   SELECT 'pack catalog must contain exactly seven entries'
   WHERE (SELECT count(*) FROM public.apple_coin_pack_catalog) <> 7
 ) checks;
 IF problems IS NOT NULL THEN RAISE EXCEPTION 'IAP readiness guard failed: %',problems; END IF;
END $$;
