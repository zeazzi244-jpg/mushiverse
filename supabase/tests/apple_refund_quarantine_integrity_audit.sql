-- Read-only refund reconciliation audit for Apple Production paid coins.
-- Rejects a revoked Production purchase without a corresponding account hold.
DO $audit$
DECLARE missing_holds bigint; invalid_holds bigint; inconsistent_holds bigint;
BEGIN
 SELECT count(*) INTO missing_holds
 FROM public.apple_iap_events e
 JOIN public.gacha_coin_purchase_credits c ON c.transaction_id=e.transaction_id
 WHERE e.environment='Production' AND e.revocation_date IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.apple_coin_refund_holds h
     WHERE h.transaction_id=e.transaction_id AND h.user_id=c.user_id
       AND h.revocation_date=e.revocation_date);
 SELECT count(*) INTO invalid_holds
 FROM public.apple_coin_refund_holds h
 LEFT JOIN public.gacha_coin_purchase_credits c ON c.transaction_id=h.transaction_id
 LEFT JOIN public.apple_iap_events e ON e.transaction_id=h.transaction_id
 WHERE c.transaction_id IS NULL OR e.transaction_id IS NULL
   OR c.user_id IS DISTINCT FROM h.user_id
   OR e.user_id IS DISTINCT FROM h.user_id
   OR e.environment IS DISTINCT FROM 'Production'
   OR e.revocation_date IS DISTINCT FROM h.revocation_date;
 SELECT count(*) INTO inconsistent_holds
 FROM public.apple_coin_refund_holds h
 JOIN public.gacha_coin_purchase_credits c ON c.transaction_id=h.transaction_id
 WHERE c.coins<>100 OR c.product_id<>'mushiverse.coins.100';
 IF missing_holds>0 OR invalid_holds>0 OR inconsistent_holds>0
 THEN RAISE EXCEPTION 'Apple refund integrity failed: missing=%, invalid=%, wrong_products=%',
   missing_holds,invalid_holds,inconsistent_holds; END IF;
END
$audit$;
SELECT (SELECT count(*) FROM public.apple_coin_refund_holds) AS unresolved_refund_holds,
 (SELECT count(*) FROM public.apple_iap_events
   WHERE environment='Production' AND revocation_date IS NOT NULL) AS revoked_production_events;
