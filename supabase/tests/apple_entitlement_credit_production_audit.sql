-- Read-only audit: fail when Apple-linked premium access or coin credits lack a verified production event.
-- This does not establish Apple JWS authenticity; that must be checked server-side first.
DO $audit$
DECLARE
  bad_premium bigint;
  bad_credits bigint;
BEGIN
  SELECT count(*) INTO bad_premium
  FROM public.premium_entitlements pe
  WHERE lower(coalesce(pe.source, '')) LIKE '%apple%'
    AND lower(coalesce(pe.status, '')) IN ('active', 'trialing')
    AND NOT EXISTS (
      SELECT 1 FROM public.apple_iap_events e
      WHERE e.user_id = pe.user_id
        AND e.verified_at IS NOT NULL
        AND e.revocation_date IS NULL
        AND e.environment = 'Production'
        AND (e.expires_date IS NULL OR e.expires_date > now())
    );

  SELECT count(*) INTO bad_credits
  FROM public.gacha_coin_purchase_credits c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.apple_iap_events e
    WHERE e.transaction_id = c.transaction_id
      AND e.user_id = c.user_id
      AND e.product_id = c.product_id
      AND e.verified_at IS NOT NULL
      AND e.revocation_date IS NULL
      AND e.environment = 'Production'
  );

  IF bad_premium > 0 OR bad_credits > 0 THEN
    RAISE EXCEPTION 'Apple billing audit failed: premium=%, credits=%', bad_premium, bad_credits;
  END IF;
  RAISE NOTICE 'Apple billing audit passed: premium=0, credits=0';
END
$audit$;
