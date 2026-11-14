// Server-only Apple JWS verification. NEVER trust decoded JWS payloads directly.
// Requires Apple's pinned root certificates, provisioned securely as base64 DER.
import { Environment, SignedDataVerifier } from "npm:@apple/app-store-server-library@1.5.0";
import { validateVerifiedAppleCoinTransaction } from "./apple-coin-transaction-policy.mjs";

function decodeDer(encoded: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length > 16384)
    throw new Error("invalid_apple_root_certificate");
  const bytes = atob(encoded);
  if (bytes.length < 500 || bytes.length > 8192) throw new Error("invalid_apple_root_certificate");
  return Uint8Array.from(bytes, c => c.charCodeAt(0));
}

export async function verifyAppleCoinJws(signedTransaction: string, expected: {
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  appAccountToken: string;
  environment: "Sandbox" | "Production";
}) {
  // Reject malformed compact JWS before invoking the Apple verifier. Each segment
  // must be nonempty base64url; never accept padded or extra-segment tokens.
  if (typeof signedTransaction !== "string" || signedTransaction.length > 16384 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(signedTransaction))
    throw new Error("invalid_signed_transaction");
  if (!expected || !["Sandbox", "Production"].includes(expected.environment))
    throw new Error("invalid_expected_environment");
  // No caller may opt into live fulfillment merely by passing "Production".
  // Keep production verification unavailable until an independently audited
  // release explicitly enables it after end-to-end Sandbox purchase proof.
  if (expected.environment === "Production" &&
      Deno.env.get("APPLE_IAP_PRODUCTION_VERIFICATION_ENABLED") !== "true")
    throw new Error("production_verification_disabled");

  const bundleId = Deno.env.get("APPLE_IAP_BUNDLE_ID");
  const roots = Deno.env.get("APPLE_IAP_ROOT_CERTS_DER_BASE64");
  // Never let a misconfigured deployment trust a different App Store app.
  // SignedDataVerifier checks the JWS against this ID, but the ID itself must
  // also be pinned server-side to MUSHIVERSE's immutable iOS bundle identity.
  if (bundleId !== "com.rikuto.mushiverse" || !roots)
    throw new Error("apple_verification_not_configured");
  const certificates = roots.split(",").map(v => decodeDer(v.trim()));
  if (certificates.length < 1 || certificates.length > 5)
    throw new Error("invalid_apple_root_certificates");
  const environment = expected.environment === "Sandbox" ? Environment.SANDBOX : Environment.PRODUCTION;
  const appAppleIdRaw = Deno.env.get("APPLE_IAP_APP_APPLE_ID");
  const appAppleId = appAppleIdRaw && /^\d+$/.test(appAppleIdRaw) ? Number(appAppleIdRaw) : undefined;
  if (expected.environment === "Production" && (!appAppleId || !Number.isSafeInteger(appAppleId)))
    throw new Error("apple_app_id_not_configured");

  // The Apple library validates the JWS signature, certificate chain, certificate
  // purpose, bundle/environment and (in production) Apple app ID before decoding.
  const verifier = new SignedDataVerifier(certificates, true, environment, bundleId, appAppleId);
  const transaction = await verifier.verifyAndDecodeTransaction(signedTransaction);
  return validateVerifiedAppleCoinTransaction(transaction, expected);
}
