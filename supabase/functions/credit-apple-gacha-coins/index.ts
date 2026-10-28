import { Buffer } from "node:buffer";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { AppStoreServerAPIClient, Environment, SignedDataVerifier } from "npm:@apple/app-store-server-library@3.1.0";
import { validateCoinTransaction } from "../_shared/apple-coin-policy.ts";

const json = (data: Record<string, unknown>, status: number) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

// Independent server release gate. Keep disabled until all Sandbox and refund tests pass.
Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const auth = request.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(auth)) return json({ error: "unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return json({ error: "unavailable" }, 503);
  try {
    const client = createClient(url, key, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return json({ error: "unauthorized" }, 401);
    if (Deno.env.get("APPLE_COIN_CREDIT_ENABLED") !== "true") {
      return json({ error: "apple_verification_not_configured", credited_or_previously_credited: false }, 503);
    }
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "invalid_request" }, 400);
    let size = 0; const chunks: Uint8Array<ArrayBuffer>[] = [];
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 32_768) { await reader.cancel(); return json({ error: "payload_too_large" }, 413); }
      chunks.push(new Uint8Array(value));
    }
    let signed: unknown;
    try { signed = JSON.parse(await new Blob(chunks).text()).signed_transaction; }
    catch { return json({ error: "invalid_request" }, 400); }
    if (typeof signed !== "string" || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(signed)) return json({ error: "invalid_request" }, 400);
    // Operator-configured environment and roots; never trust roots or URLs in a client payload.
    const env = Deno.env.get("APPLE_IAP_ENVIRONMENT");
    const privateKey = Deno.env.get("APPLE_IAP_PRIVATE_KEY");
    const keyID = Deno.env.get("APPLE_IAP_KEY_ID"), issuerID = Deno.env.get("APPLE_IAP_ISSUER_ID");
    const rootsJSON = Deno.env.get("APPLE_ROOT_CERTIFICATES_BASE64_JSON");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appID = Number(Deno.env.get("APPLE_APP_ID"));
    if ((env !== Environment.SANDBOX && env !== Environment.PRODUCTION) ||
        !privateKey || !keyID || !issuerID || !rootsJSON || !serviceKey || !Number.isSafeInteger(appID) || appID <= 0) {
      return json({ error: "unavailable" }, 503);
    }
    const roots = JSON.parse(rootsJSON);
    if (!Array.isArray(roots) || !roots.length || roots.some(x => typeof x !== "string" || !x)) return json({ error: "unavailable" }, 503);
    const verifier = new SignedDataVerifier(roots.map(x => Buffer.from(x, "base64")), true, env, "com.rikuto.mushiverse", appID);
    let transaction;
    try {
      const initial = await verifier.verifyAndDecodeTransaction(signed);
      const identity = validateCoinTransaction(initial as Record<string, unknown>, data.user.id, env);
      // Ask Apple for current status to reject a previously valid transaction refunded since signing.
      const apple = new AppStoreServerAPIClient(privateKey, keyID, issuerID, "com.rikuto.mushiverse", env);
      const current = await apple.getTransactionInfo(identity.transactionID);
      if (!current.signedTransactionInfo) throw new Error("missing_transaction");
      transaction = await verifier.verifyAndDecodeTransaction(current.signedTransactionInfo);
      const refreshed = validateCoinTransaction(transaction as Record<string, unknown>, data.user.id, env);
      if (refreshed.transactionID !== identity.transactionID || refreshed.productID !== identity.productID) throw new Error("transaction_mismatch");
    } catch {
      return json({ error: "apple_verification_failed", credited_or_previously_credited: false }, 422);
    }
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    // New RPC name deliberately avoids the live legacy 3-argument signature. Deploy reviewed SQL first.
    const result = await admin.rpc("credit_verified_gacha_purchase_v2", {
      p_transaction_id: transaction.transactionId, p_user_id: data.user.id,
      p_product_id: transaction.productId, p_environment: env,
    });
    if (result.error || result.data !== true) return json({ error: "credit_unavailable" }, 503);
    return json({ credited_or_previously_credited: true }, 200);
  } catch {
    // Never log signed transactions, JWTs, private keys or purchase details.
    return json({ error: "unavailable" }, 503);
  }
});
