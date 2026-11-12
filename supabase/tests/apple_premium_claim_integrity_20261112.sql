-- Read-only premium / claim integrity audit. Empty results are NOT proof of Apple signature verification.
-- Execute against mushi-log with read-only permissions before enabling IAP.
WITH problems AS (
 SELECT 'active_apple_premium_without_verified_purchase' AS issue, p.user_id::text AS record_id
 FROM public.premium_entitlements p
 WHERE lower(p.source) LIKE '%apple%' AND lower(p.status) IN ('active','trialing')
 AND NOT EXISTS (
  SELECT 1 FROM public.apple_iap_events e
  WHERE e.user_id=p.user_id AND e.verified_at IS NOT NULL AND e.revocation_date IS NULL
   AND (e.expires_date IS NULL OR e.expires_date>now())
   AND (p.provider_subscription_id IS NULL OR e.original_transaction_id=p.provider_subscription_id)
 )
 UNION ALL
 SELECT 'verified_claim_without_matching_event', c.transaction_id
 FROM public.apple_purchase_claims c
 WHERE c.verified_at IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.apple_iap_events e
  WHERE e.transaction_id=c.transaction_id AND e.user_id=c.user_id
   AND e.product_id=c.product_id AND e.verified_at IS NOT NULL
 )
 UNION ALL
 SELECT 'original_transaction_shared_between_users', e.original_transaction_id
 FROM public.apple_iap_events e
 WHERE e.original_transaction_id IS NOT NULL
 GROUP BY e.original_transaction_id HAVING count(DISTINCT e.user_id)>1
)
SELECT issue,record_id FROM problems ORDER BY issue,record_id;
