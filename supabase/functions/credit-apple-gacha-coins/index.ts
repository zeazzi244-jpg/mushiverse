import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAppleCoinJws } from "../_shared/apple-coin-jws-verifier.ts";
import { isAppleCoinProduct } from "../_shared/apple-coin-transaction-policy.mjs";

// Sandbox verification-only staging: do not persist trusted events or grant coins
// before the release gate and atomic fulfillment integration are independently proven.
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };
const headers = { ...cors, "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers });
const idPattern = /^\d{6,30}$/;
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return json({ error: "unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json({ error: "unavailable" }, 503);
  try {
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "unauthorized" }, 401);
    const declaredLength = request.headers.get("content-length");
    if (declaredLength !== null) {
      if (!/^(0|[1-9][0-9]*)$/.test(declaredLength)) return json({ error: "invalid_content_length" }, 400);
      if (!Number.isSafeInteger(Number(declaredLength)) || Number(declaredLength) > 40000) return json({ error: "request_too_large" }, 413);
    }
    // Enforce the limit while reading: request.text() buffers an entire chunked
    // body before checking its size and permits unbounded unauthenticated memory use.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "invalid_body" }, 400);
    const chunks: Uint8Array[] = [];
    let received = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > 40000) {
          await reader.cancel();
          return json({ error: "request_too_large" }, 413);
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    // A mismatched declared length is not reliable purchase evidence. Reject
    // incomplete or inconsistent bodies rather than parsing partial JSON.
    if (declaredLength !== null && received !== Number(declaredLength))
      return json({ error: "content_length_mismatch" }, 400);
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let raw: string;
    try { raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { return json({ error: "invalid_utf8" }, 400); }
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_body" }, 400);
    const { transaction_id, signed_transaction } = body;
    if (typeof transaction_id !== "string" || !idPattern.test(transaction_id) ||
        typeof signed_transaction !== "string" || signed_transaction.length > 16384 ||
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(signed_transaction))
      return json({ error: "invalid_transaction" }, 400);
    const admin = createClient(url, service);
    const { data: claims, error: claimError } = await admin.from("apple_purchase_claims")
      .select("user_id,transaction_id,original_transaction_id,product_id,status,environment")
      .eq("transaction_id", transaction_id).limit(2);
    if (claimError) return json({ error: "unavailable" }, 503);
    if (!claims || claims.length !== 1 || claims[0].user_id !== user.id)
      return json({ error: "claim_not_owned" }, 403);
    const claim = claims[0];
    // A rejected or already-finalized claim must not be revalidated through the
    // staging endpoint. Only pending claims are eligible for Sandbox proof.
    // Fulfillment remains disabled regardless of verification outcome.
    // Claim submission deliberately stores null until Apple signs the environment.
    // Permit that untrusted pending state, but only verify an Apple-signed Sandbox JWS.
    // Any pre-existing non-Sandbox environment is rejected; never trust device metadata.
    if (claim.environment !== null && claim.environment !== "Sandbox")
      return json({ error: "claim_environment_not_sandbox", credited_or_previously_credited: false }, 409);
    if (claim.status !== "pending")
      return json({ error: "claim_not_pending", credited_or_previously_credited: false }, 409);
    if (!isAppleCoinProduct(claim.product_id))
      return json({ error: "not_coin_product" }, 400);
    if (!claim.original_transaction_id || !idPattern.test(claim.original_transaction_id))
      return json({ error: "original_transaction_required" }, 400);
    // Consumable purchases must be standalone. Reject inconsistent claims before
    // any ownership query or expensive certificate validation; the signed JWS
    // is independently checked against both IDs by the Apple verifier below.
    if (claim.original_transaction_id !== claim.transaction_id)
      return json({ error: "consumable_transaction_chain_mismatch", credited_or_previously_credited: false }, 409);
    // Fail closed if the same Apple original transaction is claimed by another
    // account. This is a preflight ownership check, not a substitute for the
    // atomic uniqueness enforcement required when fulfillment is enabled.
    // Query conflicts directly: a limited unfiltered result can miss a later
    // conflicting row when multiple claims share the same original transaction.
    const { data: foreignOwners, error: ownershipError } = await admin.from("apple_purchase_claims")
      .select("transaction_id").eq("original_transaction_id", claim.original_transaction_id)
      .neq("user_id", user.id).limit(1);
    if (ownershipError) return json({ error: "unavailable", credited_or_previously_credited: false }, 503);
    if (foreignOwners?.length)
      return json({ error: "original_transaction_owned_by_other_account", credited_or_previously_credited: false }, 409);
    const { data: conflictingClaims, error: conflictError } = await admin.from("apple_purchase_claims")
      .select("transaction_id").eq("original_transaction_id", claim.original_transaction_id)
      .eq("user_id", user.id)
      .or(`transaction_id.neq.${claim.transaction_id},product_id.neq.${claim.product_id}`).limit(1);
    if (conflictError) return json({ error: "unavailable", credited_or_previously_credited: false }, 503);
    if (conflictingClaims?.length)
      return json({ error: "original_transaction_claim_conflict", credited_or_previously_credited: false }, 409);
    // Never accept environment or app-account ownership from request metadata.
    // This staging endpoint deliberately accepts Sandbox only.
    let verified;
    try {
      verified = await verifyAppleCoinJws(signed_transaction, {
        productId: claim.product_id, transactionId: claim.transaction_id,
        originalTransactionId: claim.original_transaction_id,
        appAccountToken: user.id, environment: "Sandbox",
      });
    } catch {
      return json({ error: "apple_transaction_verification_failed", credited_or_previously_credited: false }, 422);
    }
    // Re-check ownership after asynchronous Apple certificate verification. A
    // pending claim can be modified while the remote verifier is running;
    // never report a verified purchase against a changed or reassigned claim.
    const { data: currentClaims, error: currentError } = await admin.from("apple_purchase_claims")
      .select("user_id,transaction_id,original_transaction_id,product_id,status,environment")
      .eq("transaction_id", verified.transactionId).limit(2);
    if (currentError) return json({ error: "unavailable", credited_or_previously_credited: false }, 503);
    if (!currentClaims || currentClaims.length !== 1 ||
        currentClaims[0].user_id !== user.id ||
        currentClaims[0].transaction_id !== verified.transactionId ||
        currentClaims[0].original_transaction_id !== verified.originalTransactionId ||
        currentClaims[0].product_id !== verified.productId ||
        currentClaims[0].status !== "pending" ||
        (currentClaims[0].environment !== null && currentClaims[0].environment !== "Sandbox"))
      return json({ error: "claim_changed_during_verification", credited_or_previously_credited: false }, 409);
    const { data: newForeignOwners, error: newOwnerError } = await admin.from("apple_purchase_claims")
      .select("transaction_id").eq("original_transaction_id", verified.originalTransactionId)
      .neq("user_id", user.id).limit(1);
    if (newOwnerError) return json({ error: "unavailable", credited_or_previously_credited: false }, 503);
    if (newForeignOwners?.length)
      return json({ error: "original_transaction_owned_by_other_account", credited_or_previously_credited: false }, 409);
    // A second claim for this same original transaction can appear while the
    // remote Apple signature verifier runs. Recheck same-account conflicts too:
    // a foreign-owner-only check cannot catch a duplicate transaction claim.
    const { data: newConflicts, error: newConflictError } = await admin.from("apple_purchase_claims")
      .select("transaction_id").eq("original_transaction_id", verified.originalTransactionId)
      .eq("user_id", user.id)
      .or(`transaction_id.neq.${verified.transactionId},product_id.neq.${verified.productId}`).limit(1);
    if (newConflictError) return json({ error: "unavailable", credited_or_previously_credited: false }, 503);
    if (newConflicts?.length)
      return json({ error: "original_transaction_claim_conflict", credited_or_previously_credited: false }, 409);
    // This is a staging-only consistency check, not an atomic fulfillment gate.
    // No event insertion, RPC invocation, wallet mutation or premium entitlement.
    return json({ ok: true, verification: "sandbox_signature_verified", transaction_id: verified.transactionId,
      credited_or_previously_credited: false, fulfillment: "disabled_pending_sandbox_proof" });
  } catch {
    return json({ error: "unavailable", credited_or_previously_credited: false }, 503);
  }
});
