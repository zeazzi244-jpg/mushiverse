// Validation of claims AFTER cryptographic verification of an Apple signed transaction.
// Sandbox retains its original three-pack allowlist.
// This module never verifies signatures and MUST NOT be used as proof of purchase.
// A trusted Apple certificate-chain/JWS verifier must run before this policy.
export const appleCoinPacks = Object.freeze({
  'mushiverse.coins.100': 100,
  'mushiverse.coins.500': 500,
  'mushiverse.coins.1200': 1200,
  'mushiverse.coins.300': 300,
  'mushiverse.coins.2500': 2500,
  'mushiverse.coins.5500': 5500,
  'mushiverse.coins.12000': 12000,
});

export function isAppleCoinProduct(productId) {
  return typeof productId === 'string' && Object.hasOwn(appleCoinPacks, productId);
}

export function isSandboxAppleCoinProduct(productId) {
  return ['mushiverse.coins.100', 'mushiverse.coins.500', 'mushiverse.coins.1200'].includes(productId);
}

// Existing Sandbox callers must remain fail-closed for live transactions.
export function validateVerifiedAppleCoinTransaction(transaction, expected) {
  if (expected?.environment !== 'Sandbox') throw new Error('production_fulfillment_disabled');
  if (!isSandboxAppleCoinProduct(expected.productId))
    throw new Error('product_mismatch');
  return validateSignedAppleCoinTransaction(transaction, expected);
}

// Independent, post-signature-verification policy for Production preparation.
// Not called by any purchase or fulfillment endpoint. This validates payload
// semantics only; it NEVER authorizes a purchase or writes a wallet.
export function validateProductionAppleCoinTransaction(transaction, expected) {
  if (expected?.environment !== 'Production') throw new Error('production_environment_required');
  // Production launch is approved for these three packs only. Legacy catalog
  // entries must never become purchasable merely by flipping a DB sale flag.
  if (!isSandboxAppleCoinProduct(expected.productId)) throw new Error('product_mismatch');
  return validateSignedAppleCoinTransaction(transaction, expected);
}

function validateSignedAppleCoinTransaction(transaction, expected) {
  if (!transaction || typeof transaction !== 'object' || !expected) throw new Error('invalid_transaction');
  const { bundleId, productId, environment, transactionId, originalTransactionId,
    revocationDate, revocationReason, isUpgraded, purchaseDate, signedDate, type, appAccountToken, quantity, inAppOwnershipType } = transaction;
  if (bundleId !== 'com.rikuto.mushiverse') throw new Error('bundle_mismatch');
  if (!['Sandbox', 'Production'].includes(environment) || environment !== expected.environment)
    throw new Error('environment_mismatch');
  if (!isAppleCoinProduct(productId) || productId !== expected.productId)
    throw new Error('product_mismatch');
  if (type !== 'Consumable') throw new Error('type_mismatch');
  // Consumables cannot carry subscription expiration or group metadata. Reject
  // contradictory signed fields instead of interpreting them as coin purchases.
  if (transaction.expiresDate != null || transaction.subscriptionGroupIdentifier != null ||
      transaction.offerType != null || transaction.offerIdentifier != null ||
      transaction.offerDiscountType != null || transaction.offerPeriod != null ||
      transaction.webOrderLineItemId != null)
    throw new Error('subscription_metadata_on_consumable');
  // A coin pack is a one-time consumable purchase, never a subscription renewal.
  // Apple's transactionReason can be omitted for consumables; if supplied it
  // must not identify a renewal, even if other transaction fields look valid.
  if (transaction.transactionReason != null && transaction.transactionReason !== 'PURCHASE')
    throw new Error('invalid_consumable_transaction_reason');
  // A multi-unit purchase must not be silently credited as a single pack.
  // Fail closed when quantity is absent or not exactly one. No ambiguous pack credits.
  if (quantity !== 1) throw new Error('unsupported_quantity');
  // Family-shared transactions cannot establish an independently paid consumable purchase.
  if (inAppOwnershipType !== 'PURCHASED')
    throw new Error('unsupported_ownership_type');
  if (typeof transactionId !== 'string' || !/^[0-9]{1,30}$/.test(transactionId))
    throw new Error('invalid_transaction_id');
  if (typeof originalTransactionId !== 'string' || !/^[0-9]{1,30}$/.test(originalTransactionId))
    throw new Error('invalid_original_transaction_id');
  // Fail closed on contradictory Apple revocation / upgrade indicators even if the
  // revocation timestamp is unexpectedly absent. Neither can fund consumable coins.
  if (revocationDate != null || revocationReason != null) throw new Error('revoked');
  // Apple defines this as a boolean. Fail closed on unexpected non-false values
  // rather than silently treating malformed upgrade indicators as eligible.
  if (isUpgraded != null && isUpgraded !== false) throw new Error('upgraded_transaction');
  if (!Number.isSafeInteger(purchaseDate) || purchaseDate <= 0 || purchaseDate > Date.now() + 300000)
    throw new Error('invalid_purchase_date');
  // Apple signs the transaction after the purchase. Reject implausible signed
  // timestamps instead of accepting missing, stale or future-dated transaction evidence.
  if (!Number.isSafeInteger(signedDate) ||
      signedDate < purchaseDate || signedDate > Date.now() + 300000)
    throw new Error('invalid_signed_date');
  // Require a trusted server-side account mapping for every consumable credit.
  // Never derive expected.appAccountToken from the untrusted client claim.
  {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof expected.appAccountToken !== 'string' || !uuid.test(expected.appAccountToken) ||
        typeof appAccountToken !== 'string' || appAccountToken.toLowerCase() !== expected.appAccountToken.toLowerCase())
      throw new Error('app_account_token_mismatch');
  }
  // Consumables are standalone purchases, not renewable subscription chains.
  // Their original transaction must identify the same purchase; rejecting an
  // unexpected chain prevents a second transaction reusing a consumable origin.
  if (originalTransactionId !== transactionId) throw new Error('consumable_transaction_chain_mismatch');
  if (expected.transactionId !== transactionId) throw new Error('transaction_mismatch');
  if (expected.originalTransactionId !== originalTransactionId) throw new Error('original_transaction_mismatch');
  return Object.freeze({ transactionId, originalTransactionId, productId, environment, coins: appleCoinPacks[productId] });
}
