// Call only with Apple-library verified payloads; this is not signature verification.
export const COIN_PRODUCTS: Readonly<Record<string, number>> = Object.freeze({
  "mushiverse.coins.100": 100, "mushiverse.coins.550": 550, "mushiverse.coins.1200": 1200,
});
export function validateCoinTransaction(tx: Record<string, unknown>, userID: string, environment: string, now = Date.now()) {
  if (tx.bundleId !== "com.rikuto.mushiverse" || tx.environment !== environment ||
      !["Sandbox", "Production"].includes(environment) || tx.type !== "Consumable" ||
      tx.inAppOwnershipType !== "PURCHASED" || tx.quantity !== 1 ||
      typeof tx.appAccountToken !== "string" || tx.appAccountToken.toLowerCase() !== userID.toLowerCase() ||
      tx.revocationDate != null || tx.revocationReason != null || tx.isUpgraded === true ||
      typeof tx.transactionId !== "string" || !/^\d{6,64}$/.test(tx.transactionId) ||
      typeof tx.productId !== "string" || !Object.hasOwn(COIN_PRODUCTS, tx.productId) ||
      typeof tx.purchaseDate !== "number" || !Number.isFinite(tx.purchaseDate) || tx.purchaseDate <= 0 ||
      typeof tx.signedDate !== "number" || !Number.isFinite(tx.signedDate) || tx.signedDate <= 0 ||
      tx.purchaseDate > now + 60_000 || tx.signedDate > now + 60_000 || tx.purchaseDate > tx.signedDate + 60_000) {
    throw new Error("invalid_apple_transaction");
  }
  return { transactionID: tx.transactionId, productID: tx.productId };
}
