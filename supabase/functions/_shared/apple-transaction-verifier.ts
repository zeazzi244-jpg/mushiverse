// Apple-signed transaction verification. This module does NOT grant coins or premium.
// Root certificates must be pinned Apple PKI roots provisioned by the server, never
// certificates supplied by the app. Keep all fulfillment disabled until Sandbox proven.
import { Environment, SignedDataVerifier } from "npm:@apple/app-store-server-library";

export type VerifiedAppleTransaction = {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  environment: "Sandbox" | "Production";
  bundleId: string;
  revoked: boolean;
  expiresDate?: number;
};

const PRODUCTS = new Set([
  "mushiverse.coins.100",
  "mushiverse.coins.500",
  "mushiverse.coins.1200",
  "jp.mushiverse.premium.monthly",
  "jp.mushiverse.premium.annual",
]);

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`missing_${name}`);
  return value;
}

export async function verifyAppleTransaction(
  signedTransaction: string,
  expectedProductId: string,
  expectedTransactionId: string,
  expectedOriginalTransactionId: string | null,
  config: {
    rootCertificates: Uint8Array[];
    bundleId: string;
    environment: "Sandbox" | "Production";
    appAppleId?: number;
  },
): Promise<VerifiedAppleTransaction> {
  if (!/^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$/.test(signedTransaction) ||
      signedTransaction.length > 16384) throw new Error("invalid_signed_transaction");
  if (!PRODUCTS.has(expectedProductId)) throw new Error("unknown_product");
  if (!/^\\d{6,30}$/.test(expectedTransactionId)) throw new Error("invalid_transaction_id");
  if (!config.rootCertificates.length || config.rootCertificates.some(c => c.length < 500))
    throw new Error("apple_roots_not_configured");
  if (config.bundleId !== "com.rikuto.mushiverse") throw new Error("bundle_mismatch");
  if (config.environment === "Production" && !config.appAppleId)
    throw new Error("app_apple_id_required");

  const verifier = new SignedDataVerifier(
    config.rootCertificates,
    true, // online certificate revocation checks
    config.environment === "Sandbox" ? Environment.SANDBOX : Environment.PRODUCTION,
    config.bundleId,
    config.appAppleId,
  );
  const decoded = await verifier.verifyAndDecodeTransaction(signedTransaction);
  if (decoded.bundleId !== config.bundleId ||
      decoded.environment !== config.environment ||
      decoded.productId !== expectedProductId ||
      decoded.transactionId !== expectedTransactionId ||
      !decoded.originalTransactionId ||
      (expectedOriginalTransactionId !== null &&
        decoded.originalTransactionId !== expectedOriginalTransactionId))
    throw new Error("signed_transaction_mismatch");
  if (decoded.revocationDate != null) throw new Error("transaction_revoked");
  if (expectedProductId.includes(".premium.") &&
      (!decoded.expiresDate || decoded.expiresDate <= Date.now()))
    throw new Error("subscription_expired");
  return {
    transactionId: required(decoded.transactionId, "transaction_id"),
    originalTransactionId: required(decoded.originalTransactionId, "original_transaction_id"),
    productId: required(decoded.productId, "product_id"),
    environment: config.environment,
    bundleId: config.bundleId,
    revoked: false,
    expiresDate: decoded.expiresDate,
  };
}
