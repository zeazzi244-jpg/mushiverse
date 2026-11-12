// Validation of claims AFTER cryptographic verification of an Apple signed transaction.
// This module never verifies signatures and MUST NOT be used as proof of purchase.
// A trusted Apple certificate-chain/JWS verifier must run before this policy.
export function validateVerifiedAppleCoinTransaction(transaction, expected) {
  if (!transaction || typeof transaction !== 'object' || !expected) throw new Error('invalid_transaction');
  const { bundleId, productId, environment, transactionId, originalTransactionId,
    revocationDate, purchaseDate, type, appAccountToken } = transaction;
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
  if (typeof transactionId !== 'string' || !/^[0-9]{1,30}$/.test(transactionId))
    throw new Error('invalid_transaction_id');
  if (typeof originalTransactionId !== 'string' || !/^[0-9]{1,30}$/.test(originalTransactionId))
    throw new Error('invalid_original_transaction_id');
  if (revocationDate != null) throw new Error('revoked');
  if (!Number.isSafeInteger(purchaseDate) || purchaseDate <= 0 || purchaseDate > Date.now() + 300000)
    throw new Error('invalid_purchase_date');
  // Only compare tokens supplied by the trusted server-side account mapping.\n  // Never derive expected.appAccountToken from the untrusted client claim.\n  if (expected.appAccountToken != null) {\n    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;\n    if (typeof expected.appAccountToken !== 'string' || !uuid.test(expected.appAccountToken) ||\n        typeof appAccountToken !== 'string' || appAccountToken.toLowerCase() !== expected.appAccountToken.toLowerCase())\n      throw new Error('app_account_token_mismatch');\n  }\n  if (expected.transactionId !== transactionId) throw new Error('transaction_mismatch');
  if (expected.originalTransactionId !== originalTransactionId) throw new Error('original_transaction_mismatch');
  return Object.freeze({ transactionId, originalTransactionId, productId, environment, coins: packs[productId] });
}
