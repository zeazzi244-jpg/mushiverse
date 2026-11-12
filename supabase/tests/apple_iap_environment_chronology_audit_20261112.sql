-- Read-only Apple IAP environment and chronology audit.
-- Zero findings do not establish that Apple signatures were validated.
WITH findings AS (
 SELECT 'verified_event_invalid_environment' AS issue, e.transaction_id AS record_id
 FROM public.apple_iap_events e
 WHERE e.verified_at IS NOT NULL AND (e.environment IS NULL OR lower(e.environment) NOT IN ('sandbox','production'))
 UNION ALL
 SELECT 'verified_event_before_purchase', e.transaction_id
 FROM public.apple_iap_events e
 WHERE e.verified_at IS NOT NULL AND e.purchase_date IS NOT NULL AND e.verified_at < e.purchase_date
 UNION ALL
 SELECT 'claim_event_environment_mismatch', c.transaction_id
 FROM public.apple_purchase_claims c JOIN public.apple_iap_events e USING (transaction_id)
 WHERE c.verified_at IS NOT NULL AND e.verified_at IS NOT NULL
 AND c.environment IS DISTINCT FROM e.environment
 UNION ALL
 SELECT 'claim_event_original_transaction_mismatch', c.transaction_id
 FROM public.apple_purchase_claims c JOIN public.apple_iap_events e USING (transaction_id)
 WHERE c.verified_at IS NOT NULL AND e.verified_at IS NOT NULL
 AND c.original_transaction_id IS DISTINCT FROM e.original_transaction_id
 UNION ALL
 SELECT 'credit_from_nonproduction_event', cr.transaction_id
 FROM public.gacha_coin_purchase_credits cr JOIN public.apple_iap_events e USING (transaction_id)
 WHERE lower(coalesce(e.environment,'')) <> 'production'
 UNION ALL
 SELECT 'credit_verified_timestamp_mismatch', cr.transaction_id
 FROM public.gacha_coin_purchase_credits cr JOIN public.apple_iap_events e USING (transaction_id)
 WHERE cr.verified_at IS DISTINCT FROM e.verified_at
)
SELECT issue,record_id FROM findings ORDER BY issue,record_id;