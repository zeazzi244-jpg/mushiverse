import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { VerificationException, VerificationStatus } from "npm:@apple/app-store-server-library@3.1.0";
import { verifyAppleProductionCoinJws } from "../_shared/apple-production-coin-verifier.ts";
import { appleCoinPacks, isSandboxAppleCoinProduct } from "../_shared/apple-coin-transaction-policy.mjs";

// Production settlement is separate from the existing Sandbox-only endpoint.
// No balance is touched unless every independent database release gate is open.
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const headers = { ...cors, "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
const reply = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers });
const appleID = /^\d{6,30}$/;

async function boundedBody(request: Request, max = 20000): Promise<Record<string, unknown>> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^(0|[1-9]\d*)$/.test(declared) || Number(declared) > max))
    throw new Error("invalid_content_length");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_body");
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel();
        throw new Error("request_too_large");
      }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  if (declared !== null && Number(declared) !== total) throw new Error("content_length_mismatch");
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  const payload = JSON.parse(new TextDecoder("utf-8", {fatal:true}).decode(bytes));
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalid_body");
  return payload as Record<string, unknown>;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, {status:204, headers:cors});
  if (request.method !== "POST") return reply({error:"method_not_allowed"},405);
  if (!/^Bearer\s+\S+$/i.test(request.headers.get("authorization") ?? ""))
    return reply({error:"unauthorized"},401);
  const endpoint = Deno.env.get("SUPABASE_URL");
  const anonymousKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!endpoint || !anonymousKey || !serviceKey) return reply({error:"unavailable"},503);
  try {
    const token = request.headers.get("authorization")!;
    const authClient = createClient(endpoint, anonymousKey, {global:{headers:{Authorization:token}}});
    const {data:{user},error:authError} = await authClient.auth.getUser();
    if (authError || !user) return reply({error:"unauthorized"},401);
    // Server-controlled account restrictions are authoritative; an editable
    // client kids-mode setting must never authorize paid coin fulfillment.
    if (user.app_metadata?.kid_mode === true ||
        user.app_metadata?.minor === true ||
        user.app_metadata?.iap_disabled === true)
      return reply({error:"purchases_restricted"},403);
    const admin = createClient(endpoint, serviceKey);

    // A database gate is authoritative, not client config or a remote flag.
    const [{data:billing,error:billingError},{data:gate,error:gateError}] = await Promise.all([
      admin.from("billing_settings").select("billing_mode,checkout_enabled,ios_iap_ready").eq("singleton",true).single(),
      admin.from("apple_iap_verification_gate").select("server_jws_verified,sandbox_purchase_proven").eq("singleton",true).single(),
    ]);
    if (billingError || gateError) return reply({error:"unavailable"},503);
    if (billing.billing_mode !== "live" || billing.checkout_enabled !== true || billing.ios_iap_ready !== true ||
        gate.server_jws_verified !== true || gate.sandbox_purchase_proven !== true)
      return reply({error:"production_fulfillment_disabled"},503);

    let body: Record<string,unknown>;
    try { body = await boundedBody(request); }
    catch { return reply({error:"invalid_request"},400); }
    const transactionID = body.transaction_id;
    const signed = body.signed_transaction;
    if (typeof transactionID !== "string" || !appleID.test(transactionID) ||
        typeof signed !== "string" || signed.length > 16384 ||
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(signed))
      return reply({error:"invalid_transaction"},400);

    // The pending claim was created by the authenticated user's native app.
    // The environment, product, original ID and account token are NOT trusted
    // from this request; they are matched to the Apple-signed transaction.
    const {data:claims,error:claimError} = await admin.from("apple_purchase_claims")
      .select("user_id,transaction_id,original_transaction_id,product_id,status,environment")
      .eq("transaction_id",transactionID).limit(2);
    if (claimError) return reply({error:"unavailable"},503);
    if (!claims || claims.length !== 1) return reply({error:"claim_not_found"},403);
    const claim = claims[0];
    if (claim.user_id !== user.id || claim.transaction_id !== transactionID ||
        !isSandboxAppleCoinProduct(claim.product_id) ||
        claim.original_transaction_id !== transactionID ||
        !["pending","verified"].includes(claim.status) ||
        (claim.environment !== null && claim.environment !== "Production"))
      return reply({error:"claim_mismatch"},403);

    // Check the catalog for the authenticated, server-stored product only.
    // Never use a client-supplied product or amount for settlement.
    const {data:catalog,error:catalogError} = await admin.from("apple_coin_pack_catalog")
      .select("coins,is_sale_enabled").eq("product_id",claim.product_id).single();
    if (catalogError || !catalog || catalog.is_sale_enabled !== true ||
        catalog.coins !== appleCoinPacks[claim.product_id as keyof typeof appleCoinPacks])
      return reply({error:"production_fulfillment_disabled"},503);

    // Public App Store listing ID is fixed to this registered app identity.
    // A misconfigured deployment must fail closed rather than verify another app.
    const appIDRaw = Deno.env.get("APPLE_IAP_APP_APPLE_ID") ?? "6826061606";
    if (appIDRaw !== "6826061606")
      return reply({error:"apple_verification_unavailable"},503);

    const {data: verifierSecret, error: verifierSecretError} =
      await admin.rpc("get_apple_production_verifier_secret");
    if (verifierSecretError || typeof verifierSecret !== "string" || !/^[a-f0-9]{64}$/.test(verifierSecret))
      return reply({error:"apple_verification_temporarily_unavailable"},503);

    let verified;
    try {
      verified = await verifyAppleProductionCoinJws(signed, {
        environment:"Production",
        productId:claim.product_id,
        transactionId:transactionID,
        originalTransactionId:claim.original_transaction_id,
        appAccountToken:user.id,
      },Number(appIDRaw),verifierSecret);
    } catch (error) {
      // A transient Apple certificate/OCSP failure is not evidence of a bad
      // purchase. Never settle a wallet on failure, but allow StoreKit's
      // unfinished transaction to be retried after the outage.
      const transient = error instanceof VerificationException &&
        error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE;
      // Keep signed purchase details, raw exception messages and JWS out of logs.
      console.warn("Apple Production verification:", transient ? "retryable_apple_verifier_failure" : "rejected");
      return transient
        ? reply({error:"apple_verification_temporarily_unavailable"},503)
        : reply({error:"apple_transaction_verification_failed"},422);
    }

    // Remote signature verification is asynchronous. Reject a claim reassigned,
    // canceled, or changed while verification was running. The RPC must still
    // enforce ownership and uniqueness atomically against concurrent requests.
    const {data:latestClaims,error:latestError} = await admin.from("apple_purchase_claims")
      .select("user_id,transaction_id,original_transaction_id,product_id,status,environment")
      .eq("transaction_id",verified.transactionId).limit(2);
    if (latestError) return reply({error:"unavailable"},503);
    if (!latestClaims || latestClaims.length !== 1 ||
        latestClaims[0].user_id !== user.id ||
        latestClaims[0].transaction_id !== verified.transactionId ||
        latestClaims[0].original_transaction_id !== verified.originalTransactionId ||
        latestClaims[0].product_id !== verified.productId ||
        !["pending","verified"].includes(latestClaims[0].status) ||
        (latestClaims[0].environment !== null && latestClaims[0].environment !== "Production"))
      return reply({error:"claim_changed_during_verification"},409);

    // A release can be revoked while remote Apple certificate verification is
    // pending. Re-read both server-side gates immediately before settlement;
    // the atomic RPC must independently enforce them under its own lock.
    const [{data:currentBilling,error:currentBillingError},{data:currentGate,error:currentGateError}] = await Promise.all([
      admin.from("billing_settings").select("billing_mode,checkout_enabled,ios_iap_ready").eq("singleton",true).single(),
      admin.from("apple_iap_verification_gate").select("server_jws_verified,sandbox_purchase_proven").eq("singleton",true).single(),
    ]);
    if (currentBillingError || currentGateError ||
        currentBilling?.billing_mode !== "live" || currentBilling?.checkout_enabled !== true ||
        currentBilling?.ios_iap_ready !== true || currentGate?.server_jws_verified !== true ||
        currentGate?.sandbox_purchase_proven !== true)
      return reply({error:"production_fulfillment_disabled"},503);

    // A single Postgres transaction records verified evidence, locks the Apple
    // transaction, and inserts exactly one credit and wallet delta. No client
    // ever receives service-role credentials or calls this RPC directly.
    const {data:settled,error:settleError} = await admin.rpc("settle_verified_apple_coin_production", {
      p_transaction_id: verified.transactionId,
      p_original_transaction_id: verified.originalTransactionId,
      p_user_id:user.id,
      p_product_id:verified.productId,
      p_purchase_date:new Date(verified.purchaseDate).toISOString(),
    });
    if (settleError || settled !== true) {
      console.warn("Apple Production credit settlement rejected",settleError?.code ?? "unavailable");
      return reply({error:"settlement_unavailable"},503);
    }
    return reply({
      ok:true, credited_or_previously_credited:true,
      verification:"production_signature_verified",
      transaction_id:verified.transactionId,
      original_transaction_id:verified.originalTransactionId,
      product_id:verified.productId, environment:"Production",coins:verified.coins,
    });
  } catch {
    return reply({error:"unavailable"},503);
  }
});
