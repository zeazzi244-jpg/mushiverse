-- Fail-closed schema guard for Apple IAP replay protection.
-- This checks database constraints only; it does not validate Apple signatures.
DO $$
DECLARE
  target text;
  col text;
BEGIN
  FOR target,col IN
    SELECT * FROM (VALUES
      ('apple_iap_events','transaction_id'),
      ('apple_purchase_claims','transaction_id'),
      ('gacha_coin_purchase_credits','transaction_id'),
      ('premium_entitlements','user_id')
    ) AS required(tablename,columnname)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_index i
      JOIN pg_class t ON t.oid=i.indrelid
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_attribute a ON a.attrelid=t.oid
      WHERE n.nspname='public' AND t.relname=target
        AND i.indisunique AND i.indisvalid AND i.indisready
        AND i.indnkeyatts=1 AND i.indkey[0]=a.attnum
        AND a.attname=col AND i.indpred IS NULL
    ) THEN
      RAISE EXCEPTION 'IAP replay protection missing: %.%',target,col;
    END IF;
  END LOOP;
END $$;
