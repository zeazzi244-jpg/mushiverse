import { Buffer } from "node:buffer";
import { X509Certificate } from "node:crypto";
// Staged Production-only Apple signed coin verification.
// Imported by the gated Production settlement endpoint; this module never credits a wallet.
// Keep the independent database release gates closed until Sandbox proof and approval.
import { Environment, SignedDataVerifier, VerificationException, VerificationStatus } from "npm:@apple/app-store-server-library@3.1.0";
import { isAppleCoinProduct, validateProductionAppleCoinTransaction } from "./apple-coin-transaction-policy.mjs";

// Apple Root CA - G3, pinned, from https://www.apple.com/certificateauthority/
// SHA-256 DER: 63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179
export const APPLE_G3_ROOT_DER_BASE64 = "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";

export async function verifyAppleProductionCoinJws(
  signedTransaction: string,
  expected: {
    productId: string;
    transactionId: string;
    originalTransactionId: string;
    appAccountToken: string;
    environment: "Production";
  },
  appAppleId: number,
  configuredSecret?: string,
) {
  if (!expected || expected.environment !== "Production")
    throw new Error("production_environment_required");
  if (!isAppleCoinProduct(expected.productId))
    throw new Error("invalid_expected_product");
  if (!Number.isSafeInteger(appAppleId) || appAppleId <= 0)
    throw new Error("apple_app_id_required");
  if (typeof signedTransaction !== "string" || signedTransaction.length > 16384 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(signedTransaction))
    throw new Error("invalid_signed_transaction");
  if (!/^\d{6,30}$/.test(expected.transactionId) ||
      !/^\d{6,30}$/.test(expected.originalTransactionId))
    throw new Error("invalid_expected_transaction");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expected.appAccountToken))
    throw new Error("invalid_expected_account");

  const remoteSecret = configuredSecret ?? Deno.env.get("APPLE_PRODUCTION_VERIFIER_SECRET");
  let transaction;
  if (remoteSecret !== undefined) {
    if (!/^[a-f0-9]{64}$/.test(remoteSecret)) {
      throw new VerificationException(VerificationStatus.RETRYABLE_VERIFICATION_FAILURE);
    }
    const transient = () => new VerificationException(VerificationStatus.RETRYABLE_VERIFICATION_FAILURE);
    let result: Response;
    try {
      result = await fetch("https://mushiverse-apple-sandbox-verifier.onrender.com/verify-production-purchase", {
        method: "POST",
        redirect: "error",
        headers: {"content-type": "application/json", authorization: "Bearer " + remoteSecret},
        body: JSON.stringify({signedTransaction, expected}),
        signal: AbortSignal.timeout(33000),
      });
    } catch {
      throw transient();
    }
    if (result.status !== 200) {
      await result.body?.cancel();
      if (result.status === 422) throw new VerificationException(VerificationStatus.VERIFICATION_FAILURE);
      throw transient();
    }
    try {
      transaction = (await result.json())?.verified;
    } catch {
      throw transient();
    }
  } else {
    // Never trust roots/certificates, account IDs or environments from a client.
    // These roots are pinned in server code and expected values must come from
    // an authenticated server-side purchase claim and fixed app configuration.
    const root = Buffer.from(APPLE_G3_ROOT_DER_BASE64, "base64");
    // The hosted Edge runtime can expose X509Certificate while lacking the
    // operations the Apple SDK uses. Keep unfinished StoreKit purchases retryable.
    try {
      const certificate = new X509Certificate(root);
      if (!certificate.raw.byteLength || !certificate.toString().includes("BEGIN CERTIFICATE") ||
          !certificate.verify(certificate.publicKey)) {
        throw new Error("apple_certificate_runtime_unsupported");
      }
    } catch {
      throw new VerificationException(VerificationStatus.RETRYABLE_VERIFICATION_FAILURE);
    }
    const verifier = new SignedDataVerifier(
      [root], true, Environment.PRODUCTION, "com.rikuto.mushiverse", appAppleId,
    );
    // SignedDataVerifier validates the JWS, certificate chain, app identity,
    // environment and Apple app ID before exposing its decoded transaction.
    transaction = await verifier.verifyAndDecodeTransaction(signedTransaction);
  }
  // Product, owner, nonce-free transaction identity, revocation and consumable
  // metadata are checked independently against authenticated server state.
  const validated = validateProductionAppleCoinTransaction(transaction, expected);
  // Settlement records the exact Apple-signed purchase timestamp, not a
  // client value or the current server time. Preserve it after validation.
  return Object.freeze({ ...validated, purchaseDate: transaction.purchaseDate as number });
}
