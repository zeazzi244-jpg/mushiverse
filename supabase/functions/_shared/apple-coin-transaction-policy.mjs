// Validation of claims AFTER cryptographic verification of an Apple signed transaction.
// This module never verifies signatures and MUST NOT be used as proof of purchase.
// A trusted Apple certificate-chain/JWS verifier must run before this policy.
export function validateVerifiedAppleCoinTransaction(transaction, expected) {
  if (!transaction || typeof transaction !== 'object' || !expected) throw new Error('invalid_transaction');
  const { bundleId, productId, environment, transactionId, originalTransactionId,
    revocationDate, purchaseDate, signedDate, type, appAccountToken, quantity, inAppOwnershipType } = transaction;
  if (bundleId !== 'com.rikuto.mushiverse') throw new Error('bundle_mismatch');
  if (!['Sandbox', 'Production'].includes(environment) || environment !== expected.environment)
    throw new Error('environment_mismatch');
  const packs = Object.freeze({
    'mushiverse.coins.100': 100,
    'mushiverse.coins.500': 500,
    'mushiverse.coins.1200': 1200,
  });
  if (!Object.hasOwn(packs, productId) || productId !== expected.productId)
    throw new Error('product_mismatch');
  if (type !== 'Consumable') throw new Error('type_mismatch');
  // A multi-unit purchase must not be silently credited as a single pack.
  // Apple may omit quantity on older transactions; when supplied, require exactly one.
  if (quantity != null && quantity !== 1) throw new Error('unsupported_quantity');
  // Family-shared transactions cannot establish an independently paid consumable purchase.
  if (inAppOwnershipType != null && inAppOwnershipType !== 'PURCHASED')
    throw new Error('unsupported_ownership_type');
  if (typeof transactionId !== 'string' || !/^[0-9]{1,30}$/.test(transactionId))
    throw new Error('invalid_transaction_id');
  if (typeof originalTransactionId !== 'string' || !/^[0-9]{1,30}$/.test(originalTransactionId))
    throw new Error('invalid_original_transaction_id');
  if (revocationDate != null) throw new Error('revoked');
  if (!Number.isSafeInteger(purchaseDate) || purchaseDate <= 0 || purchaseDate > Date.now() + 300000)
    throw new Error('invalid_purchase_date');
  // Apple signs the transaction after the purchase. Reject implausible signed
  // timestamps instead of accepting stale or future-dated transaction evidence.
  if (signedDate != null && (!Number.isSafeInteger(signedDate) ||
      signedDate < purchaseDate || signedDate > Date.now() + 300000))
    throw new Error('invalid_signed_date');
  // Require a trusted server-side account mapping for every consumable credit.
  // Never derive expected.appAccountToken from the untrusted client claim.
  {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof expected.appAccountToken !== 'string' || !uuid.test(expected.appAccountToken) ||
        typeof appAccountToken !== 'string' || appAccountToken.toLowerCase() !== expected.appAccountToken.toLowerCase())
      throw new Error('app_account_token_mismatch');
  }
  if (expected.transactionId !== transactionId) throw new Error('transaction_mismatch');
  if (expected.originalTransactionId !== originalTransactionId) throw new Error('original_transaction_mismatch');
  return Object.freeze({ transactionId, originalTransactionId, productId, environment, coins: packs[productId] });
}
