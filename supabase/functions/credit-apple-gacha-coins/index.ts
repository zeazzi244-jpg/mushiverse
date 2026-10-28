import { Buffer } from 'node:buffer';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { AppStoreServerAPIClient, Environment, SignedDataVerifier } from 'npm:@apple/app-store-server-library@3.1.0';
import { validateCoinTransaction } from '../_shared/apple-coin-policy.ts';
import { createAppleCreditHandler } from '../_shared/apple-credit-handler.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(createAppleCreditHandler({
  enabled: () => Deno.env.get('APPLE_COIN_CREDIT_ENABLED') === 'true',
  environment: () => Deno.env.get('APPLE_IAP_ENVIRONMENT') ?? '',
  authenticate: async bearer => {
    const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !key) throw Error('unavailable');
    const client = createClient(url, key, { global: { headers: { Authorization: bearer } }, auth: { persistSession: false } });
    const { data, error } = await client.auth.getUser();
    if (error || !data.user || data.user.is_anonymous) return null;
    // Decode ONLY AFTER getUser has independently validated this JWT with Supabase Auth.
    // The session ID is checked against auth.sessions again inside the atomic SQL operation.
    const claims = JSON.parse(Buffer.from(bearer.replace(/^Bearer\s+/i, '').split('.')[1], 'base64url').toString('utf8'));
    if (claims.sub !== data.user.id || typeof claims.session_id !== 'string' || !uuid.test(claims.session_id)) return null;
    return { id: data.user.id, sessionID: claims.session_id };
  },
  verify: async (signed, account) => {
    const env = Deno.env.get('APPLE_IAP_ENVIRONMENT');
    const privateKey = Deno.env.get('APPLE_IAP_PRIVATE_KEY'), keyID = Deno.env.get('APPLE_IAP_KEY_ID'), issuerID = Deno.env.get('APPLE_IAP_ISSUER_ID');
    const rootsJSON = Deno.env.get('APPLE_ROOT_CERTIFICATES_BASE64_JSON');
    const appID = Number(Deno.env.get('APPLE_APP_ID'));
    if ((env !== Environment.SANDBOX && env !== Environment.PRODUCTION) || !privateKey || !keyID || !issuerID || !rootsJSON || !Number.isSafeInteger(appID) || appID <= 0) throw Error('unavailable');
    const roots = JSON.parse(rootsJSON);
    if (!Array.isArray(roots) || !roots.length || roots.some(x => typeof x !== 'string' || !x)) throw Error('unavailable');
    const verifier = new SignedDataVerifier(roots.map(x => Buffer.from(x, 'base64')), true, env, 'com.rikuto.mushiverse', appID);
    const initial = await verifier.verifyAndDecodeTransaction(signed);
    const identity = validateCoinTransaction(initial as Record<string, unknown>, account.id, env);
    const apple = new AppStoreServerAPIClient(privateKey, keyID, issuerID, 'com.rikuto.mushiverse', env);
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
