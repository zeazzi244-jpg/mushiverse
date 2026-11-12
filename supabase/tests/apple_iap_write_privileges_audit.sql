-- Read-only Apple IAP privilege guard. Run against Supabase mushi-log.
-- A zero-row result means no detected privilege/RLS violation, not that Apple verification works.
WITH protected_tables(table_name) AS (
  VALUES ('apple_iap_events'), ('apple_purchase_claims'),
         ('gacha_coin_purchase_credits'), ('gacha_coin_wallets'),
         ('premium_entitlements'), ('apple_coin_pack_catalog')
), inspected AS (
  SELECT p.table_name, c.oid, c.relrowsecurity
  FROM protected_tables p
  LEFT JOIN pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = p.table_name AND c.relkind IN ('r','p')
)
SELECT table_name, 'missing_table' AS violation FROM inspected WHERE oid IS NULL
UNION ALL
SELECT table_name, 'rls_disabled' FROM inspected WHERE oid IS NOT NULL AND NOT relrowsecurity
UNION ALL
SELECT table_name, 'anon_can_write' FROM inspected
WHERE oid IS NOT NULL AND (
  has_table_privilege('anon',oid,'INSERT') OR
  has_table_privilege('anon',oid,'UPDATE') OR
  has_table_privilege('anon',oid,'DELETE'))
UNION ALL
SELECT table_name, 'authenticated_can_write' FROM inspected
WHERE oid IS NOT NULL AND (
  has_table_privilege('authenticated',oid,'INSERT') OR
  has_table_privilege('authenticated',oid,'UPDATE') OR
  has_table_privilege('authenticated',oid,'DELETE'))
ORDER BY table_name, violation;
