-- Apple subscription renewals retain original_transaction_id while transaction_id changes.
-- Protect chain ownership atomically under concurrent inserts, not just Edge Function preflight.
CREATE OR REPLACE FUNCTION public.guard_apple_purchase_claim_chain()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE conflicting boolean;
BEGIN
  IF NEW.original_transaction_id IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('apple_purchase_chain:' || NEW.original_transaction_id, 0));
  SELECT EXISTS (
    SELECT 1 FROM public.apple_purchase_claims c
    WHERE c.original_transaction_id = NEW.original_transaction_id
      AND c.id IS DISTINCT FROM NEW.id
      AND (
        c.user_id IS DISTINCT FROM NEW.user_id
        OR (c.product_id IN ('jp.mushiverse.premium.monthly','jp.mushiverse.premium.annual'))
           IS DISTINCT FROM (NEW.product_id IN ('jp.mushiverse.premium.monthly','jp.mushiverse.premium.annual'))
        OR (NEW.product_id NOT IN ('jp.mushiverse.premium.monthly','jp.mushiverse.premium.annual')
            AND (c.product_id IS DISTINCT FROM NEW.product_id OR c.transaction_id IS DISTINCT FROM NEW.transaction_id))
      )
  ) INTO conflicting;
  IF conflicting THEN RAISE EXCEPTION 'apple original transaction chain ownership/product conflict' USING ERRCODE='23505'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_apple_purchase_claim_chain_trg ON public.apple_purchase_claims;
CREATE TRIGGER guard_apple_purchase_claim_chain_trg
BEFORE INSERT OR UPDATE OF user_id,original_transaction_id,transaction_id,product_id
ON public.apple_purchase_claims
FOR EACH ROW EXECUTE FUNCTION public.guard_apple_purchase_claim_chain();
DROP INDEX IF EXISTS public.apple_purchase_claims_original_transaction_unique;
CREATE INDEX IF NOT EXISTS apple_purchase_claims_original_owner_idx
ON public.apple_purchase_claims(original_transaction_id,user_id);
