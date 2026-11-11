-- IAP subscription chain ownership safety regression.
-- This test is read-only and safe against the production schema.
DO $test$
DECLARE
  trigger_count integer;
  trigger_function text;
BEGIN
  SELECT count(*), max(p.proname)
    INTO trigger_count, trigger_function
  FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
  WHERE t.tgrelid='public.apple_purchase_claims'::regclass
    AND t.tgname='enforce_apple_subscription_claim_owner'
    AND t.tgenabled='O'
    AND NOT t.tgisinternal;
  IF trigger_count <> 1 OR trigger_function <> 'enforce_apple_subscription_claim_owner' THEN
    RAISE EXCEPTION 'Subscription chain ownership guard trigger missing or disabled';
  END IF;
  IF pg_catalog.has_function_privilege('anon','public.enforce_apple_subscription_claim_owner()','EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated','public.enforce_apple_subscription_claim_owner()','EXECUTE') THEN
    RAISE EXCEPTION 'Subscription chain guard function exposed to client roles';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.apple_purchase_claims c
    JOIN public.apple_purchase_claims other
      ON c.original_transaction_id=other.original_transaction_id
     AND c.user_id<>other.user_id
    WHERE c.original_transaction_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Existing subscription chain ownership collision detected';
  END IF;
END
$test$;
