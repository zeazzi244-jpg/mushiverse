-- Read-only release gate: fail CI until Apple verification and Sandbox testing are complete.
-- Intended to run before enabling any real-money checkout.
DO $gate$
DECLARE
  wrong_catalog integer;
  enabled_packs integer;
  unsafe_settings integer;
BEGIN
  SELECT count(*) INTO wrong_catalog
  FROM (VALUES ('mushiverse.coins.100',100),('mushiverse.coins.500',500),('mushiverse.coins.1200',1200)) expected(product_id,coins)
  LEFT JOIN public.apple_coin_pack_catalog c
    ON c.product_id=expected.product_id AND c.coins=expected.coins
  WHERE c.product_id IS NULL;
  IF wrong_catalog<>0 THEN
    RAISE EXCEPTION 'Apple coin pack catalog does not match approved products';
  END IF;
  SELECT count(*) INTO enabled_packs FROM public.apple_coin_pack_catalog WHERE is_sale_enabled;
  SELECT count(*) INTO unsafe_settings FROM public.billing_settings
  WHERE billing_mode IS DISTINCT FROM 'off'
     OR checkout_enabled IS DISTINCT FROM false
     OR ios_iap_ready IS DISTINCT FROM false;
  IF enabled_packs<>0 OR unsafe_settings<>0 THEN
    RAISE EXCEPTION 'Apple IAP checkout enabled before verification release gate';
  END IF;
  IF EXISTS (SELECT 1 FROM public.apple_iap_events WHERE verified_at IS NOT NULL)
     AND NOT EXISTS (SELECT 1 FROM public.gacha_coin_purchase_credits) THEN
    -- Verified events alone are not evidence that wallet crediting works.
    RAISE NOTICE 'Verified events present but no credit; Sandbox end-to-end test still required';
  END IF;
END
$gate$;
