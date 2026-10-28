import { authenticateSupabaseAccount } from '../_shared/supabase-account.ts';
import { creditCoins } from '../_shared/coin-ledger.ts';
import { appleServices } from '../_shared/apple-services.ts';
import { validateCoinTransaction } from '../_shared/apple-coin-policy.ts';
import { createAppleCreditHandler } from '../_shared/apple-credit-handler.ts';


Deno.serve(createAppleCreditHandler({
  enabled: () => Deno.env.get('APPLE_COIN_CREDIT_ENABLED') === 'true',
  environment: () => Deno.env.get('APPLE_IAP_ENVIRONMENT') ?? '',
  authenticate: authenticateSupabaseAccount,
  verify: async (signed, account) => {
    const {environment:env,verifier,apple}=appleServices();
    const initial = await verifier.verifyAndDecodeTransaction(signed);
    const identity = validateCoinTransaction(initial as Record<string, unknown>, account.id, env);
    const current = await apple.getTransactionInfo(identity.transactionID);
    if (!current.signedTransactionInfo) throw Error('missing_transaction');
    const tx = await verifier.verifyAndDecodeTransaction(current.signedTransactionInfo);
    const refreshed = validateCoinTransaction(tx as Record<string, unknown>, account.id, env);
    if (refreshed.transactionID !== identity.transactionID || refreshed.productID !== identity.productID) throw Error('transaction_mismatch');
    return tx as Record<string, unknown>;
  },
  credit: creditCoins,
}));
