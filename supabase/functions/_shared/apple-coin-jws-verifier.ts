// Server-only Apple JWS verification. NEVER trust decoded JWS payloads directly.
// Uses Apple's public, pinned root certificate as base64 DER.
import { Environment, SignedDataVerifier } from "npm:@apple/app-store-server-library@1.5.0";
import { isAppleCoinProduct, validateVerifiedAppleCoinTransaction } from "./apple-coin-transaction-policy.mjs";

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
}, vaultSecret?: string) {
  // Reject malformed compact JWS before invoking the Apple verifier. Each segment
  // must be nonempty base64url; never accept padded or extra-segment tokens.
  if (typeof signedTransaction !== "string" || signedTransaction.length > 16384 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(signedTransaction))
    throw new Error("invalid_signed_transaction");
  if (!expected || !["Sandbox", "Production"].includes(expected.environment))
    throw new Error("invalid_expected_environment");
  // Validate server-derived claim fields before network-backed certificate checks.
  // A malformed or unsupported claim must never reach Apple verification.
  if (!isAppleCoinProduct(expected.productId))
    throw new Error("invalid_expected_product");
  if (!/^\d{6,30}$/.test(expected.transactionId) ||
      !/^\d{6,30}$/.test(expected.originalTransactionId))
    throw new Error("invalid_expected_transaction_id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expected.appAccountToken))
    throw new Error("invalid_expected_account_token");
  // No caller may opt into live fulfillment merely by passing "Production".
  // Keep production verification unavailable until an independently audited
  // release explicitly enables it after end-to-end Sandbox purchase proof.
  if (expected.environment === "Production")
    throw new Error("production_verification_disabled");

  const remoteUrl = Deno.env.get("APPLE_SANDBOX_VERIFIER_URL") ??
    (vaultSecret ? "https://mushiverse-apple-sandbox-verifier.onrender.com/verify" : undefined);
  const remoteSecret = Deno.env.get("APPLE_SANDBOX_VERIFIER_SECRET") ?? vaultSecret;
  if (remoteUrl || remoteSecret) {
    if (!remoteUrl || !remoteSecret || !/^[a-f0-9]{64}$/.test(remoteSecret))
      throw new Error("apple_verification_not_configured");
    const url = URL.parse(remoteUrl);
    if (!url || url.protocol !== "https:" || url.username || url.password ||
        url.pathname !== "/verify" || url.search || url.hash)
      throw new Error("apple_verification_not_configured");
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: { "content-type": "application/json", authorization: "Bearer " + remoteSecret },
        body: JSON.stringify({ signedTransaction, expected }),
      });
    } catch {
      throw new Error("apple_verification_not_configured");
    }
    if (response.status === 422 || response.status === 400)
      throw new Error("invalid_signed_transaction");
    if (!response.ok) throw new Error("apple_verification_not_configured");
    const { verified } = await response.json();
    // Treat the remote verifier response as untrusted transport data: bind it
    // to the server-derived claim and the exact approved pack denomination.
    // Never assume every verified purchase is the 100-coin product.
    const packCoins = Object.freeze({
      "mushiverse.coins.100": 100,
      "mushiverse.coins.500": 500,
      "mushiverse.coins.1200": 1200,
    });
    const expectedCoins = packCoins[expected.productId as keyof typeof packCoins];
    if (!verified || typeof verified !== "object" ||
        verified.environment !== expected.environment ||
        verified.productId !== expected.productId ||
        verified.transactionId !== expected.transactionId ||
        verified.originalTransactionId !== expected.originalTransactionId ||
        !Number.isSafeInteger(verified.coins) || verified.coins !== expectedCoins)
      throw new Error("invalid_signed_transaction");
    return verified;
  }

  const bundleId = "com.rikuto.mushiverse";
  // Apple Root CA - G3, from https://www.apple.com/certificateauthority/.
  // SHA-256: 63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179.
  const certificates = [decodeDer("MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==")];
  const environment = expected.environment === "Sandbox" ? Environment.SANDBOX : Environment.PRODUCTION;
  const appAppleIdRaw = Deno.env.get("APPLE_IAP_APP_APPLE_ID");
  // Never silently ignore a malformed configured Apple app ID, even in Sandbox.
  // Number conversion must not round a large decimal into a different app ID.
  if (appAppleIdRaw != null &&
      (!/^[1-9]\d*$/.test(appAppleIdRaw) ||
       !Number.isSafeInteger(Number(appAppleIdRaw))))
    throw new Error("invalid_apple_app_id");
  const appAppleId = appAppleIdRaw == null ? undefined : Number(appAppleIdRaw);
  if (expected.environment === "Production" && appAppleId === undefined)
    throw new Error("apple_app_id_not_configured");

  // The Apple library validates the JWS signature, certificate chain, certificate
  // purpose, bundle/environment and (in production) Apple app ID before decoding.
  const verifier = new SignedDataVerifier(certificates, true, environment, bundleId, appAppleId);
  const transaction = await verifier.verifyAndDecodeTransaction(signedTransaction);
  return validateVerifiedAppleCoinTransaction(transaction, expected);
}
