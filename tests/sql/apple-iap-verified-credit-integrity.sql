-- Apple IAP integrity audit (read-only). Run after any Sandbox verification.
-- Fail if credits are not backed by an Apple-verified, non-revoked transaction.
DO $audit$
DECLARE violations bigint;
BEGIN
  SELECT count(*) INTO violations
  FROM public.gacha_coin_purchase_credits credit
  LEFT JOIN public.apple_iap_events event
    ON event.transaction_id = credit.transaction_id
   AND event.user_id = credit.user_id
   AND event.product_id = credit.product_id
  WHERE event.transaction_id IS NULL
     OR event.verified_at IS NULL
     OR event.revocation_date IS NOT NULL
     OR credit.coins <> CASE credit.product_id
       WHEN 'mushiverse.coins.100' THEN 100
       WHEN 'mushiverse.coins.500' THEN 500
       WHEN 'mushiverse.coins.1200' THEN 1200
       ELSE -1 END;
  IF violations > 0 THEN
    RAISE EXCEPTION 'iap_credit_integrity_failed: % unsupported credits', violations;
  END IF;

  SELECT count(*) INTO violations
  FROM public.apple_iap_events event
  JOIN public.apple_purchase_claims claim
    ON claim.transaction_id = event.transaction_id
  WHERE event.user_id IS DISTINCT FROM claim.user_id
     OR event.product_id IS DISTINCT FROM claim.product_id
     OR (claim.original_transaction_id IS NOT NULL
         AND event.original_transaction_id IS DISTINCT FROM claim.original_transaction_id);
  IF violations > 0 THEN
    RAISE EXCEPTION 'iap_claim_verified_event_mismatch: % rows', violations;
  END IF;

  IF EXISTS (SELECT 1 FROM public.billing_settings
             WHERE checkout_enabled OR ios_iap_ready OR billing_mode <> 'off') THEN
    RAISE EXCEPTION 'iap_sales_enabled_before_apple_sandbox_certification';
  END IF;
END
$audit$;
