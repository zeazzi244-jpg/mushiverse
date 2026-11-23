-- Restrict production Apple coin settlement to the three approved catalog products.
-- Safe to re-run: replaces legacy branches in both existing SECURITY DEFINER RPCs.
DO $migration$
DECLARE
  fn text;
  definition text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['settle_verified_apple_coin_production', 'credit_verified_apple_coin_transaction'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=fn;
    IF definition IS NULL THEN RAISE EXCEPTION 'missing Apple RPC: %', fn; END IF;
    definition := regexp_replace(definition, E'\\n  WHEN ''mushiverse\\.coins\\.(300|2500|5500|12000)'' THEN [0-9]+', '', 'g');
    definition := regexp_replace(definition, ',\\(''mushiverse\\.coins\\.(300|2500|5500|12000)'',[0-9]+\\)', '', 'g');
    IF definition ~ 'mushiverse\\.coins\\.(300|2500|5500|12000)' THEN
      RAISE EXCEPTION 'legacy product remains in %', fn;
    END IF;
    EXECUTE definition;
  END LOOP;
END;
$migration$;
