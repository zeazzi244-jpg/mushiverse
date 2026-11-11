-- MUSHIVERSE IAP catalog and entitlement read-only preflight.
-- Run as a privileged database operator. This is not proof of Apple verification.
DO $audit$
DECLARE
  mismatch_count integer;
  unexpected_count integer;
  unsafe_entitlements integer;
  bad_credit_amounts integer;
BEGIN
  WITH expected(product_id,coins,price) AS (
    VALUES ('mushiverse.coins.100',100,160),
           ('mushiverse.coins.500',500,480),
           ('mushiverse.coins.1200',1200,980)
  )
  SELECT count(*) INTO mismatch_count
  FROM expected x LEFT JOIN public.apple_coin_pack_catalog c USING (product_id)
  WHERE c.product_id IS NULL OR c.coins IS DISTINCT FROM x.coins
     OR c.planned_price_jpy IS DISTINCT FROM x.price
     OR c.is_sale_enabled IS DISTINCT FROM false;
  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'IAP catalog expected products/prices differ or sale enabled';
  END IF;
  SELECT count(*) INTO unexpected_count FROM public.apple_coin_pack_catalog
   WHERE product_id NOT IN ('mushiverse.coins.100','mushiverse.coins.500','mushiverse.coins.1200');
  IF unexpected_count <> 0 THEN
    RAISE EXCEPTION 'IAP catalog contains unexpected products';
  END IF;
  SELECT count(*) INTO bad_credit_amounts FROM public.gacha_coin_purchase_credits c
   LEFT JOIN public.apple_coin_pack_catalog p ON p.product_id=c.product_id
   WHERE p.product_id IS NULL OR c.coins IS DISTINCT FROM p.coins;
  IF bad_credit_amounts <> 0 THEN
    RAISE EXCEPTION 'IAP coin credit amount differs from catalog';
  END IF;
  SELECT count(*) INTO unsafe_entitlements FROM public.premium_entitlements
   WHERE source='apple' AND status='active'
     AND (current_period_end IS NULL OR current_period_end <= now());
  IF unsafe_entitlements <> 0 THEN
    RAISE EXCEPTION 'IAP active Apple entitlement missing future expiration';
  END IF;
  RAISE NOTICE 'IAP catalog and entitlement preflight passed; Apple Sandbox verification still required';
END
$audit$;
