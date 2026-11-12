-- Read-only IAP release gate: zero rows means no unsafe records were found.
-- This does NOT establish that Apple's signed transactions were verified.
WITH problems AS (
 SELECT 'unverified_coin_credit' AS issue, c.transaction_id
 FROM public.gacha_coin_purchase_credits c
 LEFT JOIN public.apple_iap_events e ON e.transaction_id=c.transaction_id
 WHERE e.transaction_id IS NULL OR e.verified_at IS NULL OR e.revocation_date IS NOT NULL
    OR e.user_id IS DISTINCT FROM c.user_id OR e.product_id IS DISTINCT FROM c.product_id
 UNION ALL
 SELECT 'incorrect_coin_amount', c.transaction_id
 FROM public.gacha_coin_purchase_credits c
 LEFT JOIN public.apple_coin_pack_catalog p ON p.product_id=c.product_id
 WHERE p.product_id IS NULL OR c.coins IS DISTINCT FROM p.coins
 UNION ALL
 SELECT 'duplicate_coin_credit', c.transaction_id
 FROM public.gacha_coin_purchase_credits c
 GROUP BY c.transaction_id HAVING count(*)>1
 UNION ALL
 SELECT 'enabled_coin_sale', p.product_id
 FROM public.apple_coin_pack_catalog p WHERE p.is_sale_enabled
 UNION ALL
 SELECT 'invalid_coin_pack_price', p.product_id
 FROM public.apple_coin_pack_catalog p
 WHERE (p.product_id='mushiverse.coins.100' AND (p.coins<>100 OR p.planned_price_jpy<>160))
    OR (p.product_id='mushiverse.coins.500' AND (p.coins<>500 OR p.planned_price_jpy<>480))
    OR (p.product_id='mushiverse.coins.1200' AND (p.coins<>1200 OR p.planned_price_jpy<>980))
)
SELECT issue,transaction_id FROM problems ORDER BY issue,transaction_id;
