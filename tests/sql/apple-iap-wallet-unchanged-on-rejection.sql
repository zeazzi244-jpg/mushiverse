-- Production-safe regression checks for Apple IAP coin crediting.
-- An unverified transaction must never create a credit or modify a wallet.
DO $test$
DECLARE
  before_credits bigint;
  after_credits bigint;
  before_balance numeric;
  after_balance numeric;
BEGIN
  SELECT count(*) INTO before_credits FROM public.gacha_coin_purchase_credits;
  SELECT coalesce(sum(balance),0) INTO before_balance FROM public.gacha_coin_wallets;
  BEGIN
    PERFORM public.credit_verified_apple_coin_transaction('iap-unverified-20261112-probe');
    RAISE EXCEPTION 'unexpected_unverified_credit';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'verified_apple_coin_transaction_required' THEN RAISE; END IF;
  END;
  SELECT count(*) INTO after_credits FROM public.gacha_coin_purchase_credits;
  SELECT coalesce(sum(balance),0) INTO after_balance FROM public.gacha_coin_wallets;
  IF before_credits <> after_credits OR before_balance <> after_balance THEN
    RAISE EXCEPTION 'Unverified IAP transaction modified coin state';
  END IF;
  IF has_function_privilege('anon','public.credit_verified_apple_coin_transaction(text)','EXECUTE')
    OR has_function_privilege('authenticated','public.credit_verified_apple_coin_transaction(text)','EXECUTE') THEN
    RAISE EXCEPTION 'IAP coin credit RPC exposed to clients';
  END IF;
END
$test$;
