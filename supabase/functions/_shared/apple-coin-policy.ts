// Call only with Apple-library verified payloads; this is not signature verification.
export const COIN_PRODUCTS: Readonly<Record<string, number>> = Object.freeze({
  "mushiverse.coins.100": 100, "mushiverse.coins.550": 550, "mushiverse.coins.1200": 1200,
});
export function validateCoinTransaction(tx: Record<string, unknown>, userID: string, environment: string, now = Date.now()) {
  if (tx.bundleId !== "com.rikuto.mushiverse" || tx.environment !== environment ||
      !["Sandbox", "Production"].includes(environment) || tx.type !== "Consumable" ||
      tx.inAppOwnershipType !== "PURCHASED" || tx.quantity !== 1 ||
      typeof tx.appAccountToken !== "string" || tx.appAccountToken.toLowerCase() !== userID.toLowerCase() ||
      tx.revocationDate != null || tx.revocationReason != null || tx.revocationType != null || tx.revocationPercentage != null || tx.isUpgraded === true ||
      typeof tx.transactionId !== "string" || !/^\d{6,64}$/.test(tx.transactionId) ||
      typeof tx.productId !== "string" || !Object.hasOwn(COIN_PRODUCTS, tx.productId) ||
      typeof tx.purchaseDate !== "number" || !Number.isFinite(tx.purchaseDate) || tx.purchaseDate <= 0 ||
      typeof tx.signedDate !== "number" || !Number.isFinite(tx.signedDate) || tx.signedDate <= 0 ||
      tx.purchaseDate > now + 60_000 || tx.signedDate > now + 60_000 || tx.purchaseDate > tx.signedDate + 60_000) {
    throw new Error("invalid_apple_transaction");
  }
  return { transactionID: tx.transactionId, productID: tx.productId };
}

// Only for Apple-verified status updates; never use this to authorize a purchase credit.
export function validateCoinStatus(tx: Record<string, unknown>, environment: string, now=Date.now()) {
  const account=tx.appAccountToken;
  if(typeof account!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(account))throw Error('invalid_account');
  if(tx.revocationPercentage!=null||(tx.revocationType!=null&&tx.revocationType!=='REFUND_FULL'))throw Error('unsupported_partial_revocation');
  const identity=validateCoinTransaction({...tx,revocationDate:undefined,revocationReason:undefined,revocationType:undefined,revocationPercentage:undefined},account,environment,now);
  const revoked=tx.revocationDate!=null;
  if(revoked&&(typeof tx.revocationDate!=='number'||!Number.isFinite(tx.revocationDate)||tx.revocationDate<=0||tx.revocationDate>now+60000))throw Error('invalid_revocation');
  if(!revoked&&(tx.revocationReason!=null||tx.revocationType!=null))throw Error('ambiguous_revocation');
  return {...identity,accountID:account.toLowerCase(),refunded:revoked,statusMS:tx.signedDate as number};
}
