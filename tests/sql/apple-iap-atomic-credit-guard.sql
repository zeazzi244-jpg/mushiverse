-- Read-only permissions and fail-closed credit regression.
DO $test$
BEGIN
  IF has_function_privilege('anon','public.credit_verified_apple_coin_transaction(text)','EXECUTE')
    OR has_function_privilege('authenticated','public.credit_verified_apple_coin_transaction(text)','EXECUTE') THEN
    RAISE EXCEPTION 'Client must not execute verified Apple coin credit';
  END IF;
  IF NOT has_function_privilege('service_role','public.credit_verified_apple_coin_transaction(text)','EXECUTE') THEN
    RAISE EXCEPTION 'Trusted server role cannot credit verified Apple coins';
  END IF;
  BEGIN
    PERFORM public.credit_verified_apple_coin_transaction('unverified-probe-20261112');
    RAISE EXCEPTION 'Unexpected credit of an unverified transaction';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'verified_apple_coin_transaction_required' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM public.gacha_coin_purchase_credits WHERE transaction_id='unverified-probe-20261112') THEN
    RAISE EXCEPTION 'Unverified transaction was persisted';
  END IF;
END
$test$;
