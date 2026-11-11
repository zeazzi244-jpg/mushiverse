-- Serialize Apple subscription-chain ownership claims across concurrent requests.
-- Claims remain untrusted and never grant an entitlement.
CREATE OR REPLACE FUNCTION public.enforce_apple_subscription_claim_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $fn$
BEGIN
  IF NEW.original_transaction_id IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('apple-chain:' || NEW.original_transaction_id, 0));
  IF EXISTS (
    SELECT 1 FROM public.apple_purchase_claims c
    WHERE c.original_transaction_id=NEW.original_transaction_id
      AND c.user_id IS DISTINCT FROM NEW.user_id
      AND (TG_OP='INSERT' OR c.id<>NEW.id)
  ) THEN
    RAISE EXCEPTION 'apple_subscription_chain_already_claimed' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION public.enforce_apple_subscription_claim_owner() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS enforce_apple_subscription_claim_owner ON public.apple_purchase_claims;
CREATE TRIGGER enforce_apple_subscription_claim_owner
BEFORE INSERT OR UPDATE OF user_id,original_transaction_id
ON public.apple_purchase_claims
FOR EACH ROW EXECUTE FUNCTION public.enforce_apple_subscription_claim_owner();
