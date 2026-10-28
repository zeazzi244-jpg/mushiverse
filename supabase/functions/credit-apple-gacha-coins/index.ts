import { authenticateSupabaseAccount } from '../_shared/supabase-account.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
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
  credit: async (tx, account) => {
    const url = Deno.env.get('SUPABASE_URL'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) throw Error('unavailable');
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const result = await admin.rpc('credit_verified_gacha_purchase_v2', {
      p_transaction_id: tx.transactionId, p_user_id: account.id, p_product_id: tx.productId,
      p_environment: tx.environment, p_session_id: account.sessionID,
    });
    return !result.error && result.data === true;
  },
}));
