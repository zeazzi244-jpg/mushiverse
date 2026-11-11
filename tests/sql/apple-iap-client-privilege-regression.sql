-- MUSHIVERSE IAP security regression: server-only mutation paths.
-- Read-only assertions; safe to run against production.
DO $audit$
DECLARE
  table_name text;
  role_name text;
  privilege text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'apple_iap_events',
    'apple_purchase_claims',
    'gacha_coin_purchase_credits',
    'gacha_coin_wallets',
    'premium_entitlements'
  ] LOOP
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH privilege IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF has_table_privilege(role_name, format('public.%I',table_name), privilege) THEN
          RAISE EXCEPTION 'Unexpected IAP mutation privilege: %.% %',role_name,table_name,privilege;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  IF has_table_privilege('anon','public.premium_entitlements','SELECT') THEN
    RAISE EXCEPTION 'Anonymous premium entitlement read is not allowed';
  END IF;
  IF NOT has_table_privilege('authenticated','public.premium_entitlements','SELECT') THEN
    RAISE EXCEPTION 'Authenticated premium entitlement read missing';
  END IF;
  IF has_function_privilege('authenticated','public.assert_verified_apple_coin_credit()','EXECUTE')
    OR has_function_privilege('anon','public.assert_verified_apple_coin_credit()','EXECUTE') THEN
    RAISE EXCEPTION 'IAP verification guard exposed to client roles';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.gacha_coin_purchase_credits'::regclass
      AND tgname='enforce_verified_apple_coin_credit'
      AND tgenabled='O'
  ) THEN
    RAISE EXCEPTION 'Verified Apple coin credit trigger is not enabled';
  END IF;
  RAISE NOTICE 'IAP privilege and guard regression audit passed';
END
$audit$;
