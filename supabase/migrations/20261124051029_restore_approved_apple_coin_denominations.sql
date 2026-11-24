-- Apple App Store Connect confirmed all seven consumables approved on 2026-11-24.
-- Restore the exact denominations in both settlement functions without changing
-- the billing, verification, or per-product sale gates, grants or existing rows.
DO $migration$
DECLARE
  settlement text;
  credit text;
  old_case text := E'  WHEN ''mushiverse.coins.1200'' THEN 1200\nEND;';
  new_case text := E'  WHEN ''mushiverse.coins.1200'' THEN 1200\n  WHEN ''mushiverse.coins.300'' THEN 300\n  WHEN ''mushiverse.coins.2500'' THEN 2500\n  WHEN ''mushiverse.coins.5500'' THEN 5500\n  WHEN ''mushiverse.coins.12000'' THEN 12000\nEND;';
  old_pairs text := '(''mushiverse.coins.1200'',1200))';
  new_pairs text := '(''mushiverse.coins.1200'',1200),(''mushiverse.coins.300'',300),(''mushiverse.coins.2500'',2500),(''mushiverse.coins.5500'',5500),(''mushiverse.coins.12000'',12000))';
BEGIN
  settlement := pg_catalog.pg_get_functiondef('public.settle_verified_apple_coin_production(text,text,uuid,text,timestamp with time zone)'::regprocedure);
  credit := pg_catalog.pg_get_functiondef('public.credit_verified_apple_coin_transaction(text)'::regprocedure);
  IF position(new_case in settlement) = 0 THEN
    IF position(old_case in settlement) = 0 THEN RAISE EXCEPTION 'unexpected Apple settlement definition'; END IF;
    EXECUTE replace(settlement, old_case, new_case);
  END IF;
  IF position(new_pairs in credit) = 0 THEN
    IF position(old_pairs in credit) = 0 THEN RAISE EXCEPTION 'unexpected Apple credit definition'; END IF;
    EXECUTE replace(credit, old_pairs, new_pairs);
  END IF;
END;
$migration$;
