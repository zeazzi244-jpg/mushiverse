import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAppleCoinJws } from "../_shared/apple-coin-jws-verifier.ts";

// Sandbox verification-only staging: do not persist trusted events or grant coins
// before the release gate and atomic fulfillment integration are independently proven.
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers });
const idPattern = /^\d{6,30}$/;
Deno.serve(async (request: Request) => {
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
    if (Number(request.headers.get("content-length") || 0) > 40000) return json({ error: "request_too_large" }, 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 40000) return json({ error: "request_too_large" }, 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_body" }, 400);
    const { transaction_id, signed_transaction } = body;
    if (typeof transaction_id !== "string" || !idPattern.test(transaction_id) ||
        typeof signed_transaction !== "string" || signed_transaction.length > 32768)
      return json({ error: "invalid_transaction" }, 400);
    const admin = createClient(url, service);
    const { data: claims, error: claimError } = await admin.from("apple_purchase_claims")
      .select("user_id,transaction_id,original_transaction_id,product_id,status")
      .eq("transaction_id", transaction_id).limit(2);
    if (claimError) return json({ error: "unavailable" }, 503);
    if (!claims || claims.length !== 1 || claims[0].user_id !== user.id)
      return json({ error: "claim_not_owned" }, 403);
    const claim = claims[0];
    if (!["mushiverse.coins.100", "mushiverse.coins.500", "mushiverse.coins.1200"].includes(claim.product_id))
      return json({ error: "not_coin_product" }, 400);
    if (!claim.original_transaction_id || !idPattern.test(claim.original_transaction_id))
      return json({ error: "original_transaction_required" }, 400);
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
    // No event insertion, RPC invocation, wallet mutation or premium entitlement.
    return json({ ok: true, verification: "sandbox_signature_verified", transaction_id: verified.transactionId,
      credited_or_previously_credited: false, fulfillment: "disabled_pending_sandbox_proof" });
  } catch {
    return json({ error: "unavailable", credited_or_previously_credited: false }, 503);
  }
});
