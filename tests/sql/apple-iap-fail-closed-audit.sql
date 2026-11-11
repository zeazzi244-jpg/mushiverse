-- MUSHIVERSE Apple IAP production fail-closed audit.
-- Read-only assertions. Run with a privileged SQL test connection.
-- These checks MUST pass before any Sandbox purchase test; passing does NOT authorize production billing.
DO $audit$
DECLARE
  settings_count integer;
  unsafe_settings integer;
  duplicate_claims integer;
  orphan_credits integer;
  client_claim_grants integer;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE billing_mode <> 'off' OR checkout_enabled IS DISTINCT FROM false OR ios_iap_ready IS DISTINCT FROM false)
    INTO settings_count, unsafe_settings FROM public.billing_settings;
  IF settings_count <> 1 OR unsafe_settings <> 0 THEN
    RAISE EXCEPTION 'IAP FAIL CLOSED: billing settings must be a single disabled row';
  END IF;
  SELECT count(*) INTO duplicate_claims FROM (
    SELECT transaction_id FROM public.apple_purchase_claims GROUP BY transaction_id HAVING count(*) > 1
  ) duplicates;
  IF duplicate_claims <> 0 THEN
    RAISE EXCEPTION 'IAP: duplicate Apple transaction claims detected';
  END IF;
  SELECT count(*) INTO orphan_credits
    FROM public.gacha_coin_purchase_credits c
    LEFT JOIN public.apple_iap_events e ON e.transaction_id = c.transaction_id
    WHERE e.transaction_id IS NULL OR e.user_id IS DISTINCT FROM c.user_id
      OR e.product_id IS DISTINCT FROM c.product_id OR e.revocation_date IS NOT NULL
      OR e.verified_at IS NULL;
  IF orphan_credits <> 0 THEN
    RAISE EXCEPTION 'IAP: coin credits without matching verified, non-revoked Apple events';
  END IF;
  SELECT count(*) INTO client_claim_grants FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'apple_purchase_claims'
      AND grantee IN ('anon', 'authenticated')
      AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE');
  IF client_claim_grants <> 0 THEN
    RAISE EXCEPTION 'IAP: client direct grants on purchase claims';
  END IF;
  RAISE NOTICE 'IAP fail-closed audit passed; production billing remains OFF';
END
$audit$;
