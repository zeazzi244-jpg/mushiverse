-- Server-side defense in depth: coin credit ledger must match a verified Apple event.
-- Existing credit rows are checked before adding the guard.
CREATE OR REPLACE FUNCTION public.assert_verified_apple_coin_credit()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE matched boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.apple_iap_events e
    JOIN public.apple_coin_pack_catalog p ON p.product_id=e.product_id
    WHERE e.transaction_id=NEW.transaction_id
      AND e.user_id=NEW.user_id
      AND e.product_id=NEW.product_id
      AND e.verified_at IS NOT NULL
      AND e.revocation_date IS NULL
      AND p.coins=NEW.coins
  ) INTO matched;
  IF NOT matched THEN
    RAISE EXCEPTION 'apple_coin_credit_requires_verified_transaction'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_verified_apple_coin_credit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enforce_verified_apple_coin_credit ON public.gacha_coin_purchase_credits;
CREATE TRIGGER enforce_verified_apple_coin_credit
BEFORE INSERT OR UPDATE ON public.gacha_coin_purchase_credits
FOR EACH ROW EXECUTE FUNCTION public.assert_verified_apple_coin_credit();
