-- A staged transition from a permanent OFF constraint to an auditable
-- production-release guard. This migration does not enable any purchase.
-- The 100-coin pack is the only Apple-approved consumable at this point.
CREATE OR REPLACE FUNCTION public.guard_apple_coin_catalog_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $guard$
BEGIN
  IF NEW.is_sale_enabled IS TRUE THEN
    IF NEW.product_id <> 'mushiverse.coins.100' OR NEW.coins <> 100 THEN
      RAISE EXCEPTION 'apple_iap_product_not_approved'
        USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.billing_settings b
      WHERE b.singleton = true AND b.billing_mode = 'live'
        AND b.checkout_enabled IS TRUE AND b.ios_iap_ready IS TRUE
    ) OR NOT EXISTS (
      SELECT 1 FROM public.apple_iap_verification_gate g
      WHERE g.singleton = true AND g.server_jws_verified IS TRUE
        AND g.sandbox_purchase_proven IS TRUE
    ) THEN
      RAISE EXCEPTION 'apple_iap_release_gate_closed'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$guard$;

-- The pre-existing CHECK forced every product off forever; replace it only
-- with the strictly narrower release-reviewed trigger above.
DROP TRIGGER IF EXISTS apple_coin_catalog_sale_guard
  ON public.apple_coin_pack_catalog;
CREATE TRIGGER apple_coin_catalog_sale_guard
BEFORE INSERT OR UPDATE ON public.apple_coin_pack_catalog
FOR EACH ROW EXECUTE FUNCTION public.guard_apple_coin_catalog_sale();

ALTER TABLE public.apple_coin_pack_catalog
  DROP CONSTRAINT IF EXISTS apple_coin_pack_catalog_is_sale_enabled_check;

-- Not a public client API. DML privileges and RLS remain unchanged.
REVOKE ALL ON FUNCTION public.guard_apple_coin_catalog_sale()
  FROM PUBLIC, anon, authenticated;
