// Recovery of an already cryptographically verified Sandbox transaction only.
// Neither the original date rejection nor the recovered JWS policy is bypassed.
import { validateVerifiedAppleCoinTransaction } from '../../supabase/functions/_shared/apple-coin-transaction-policy.mjs';

export async function recoverSandboxDate(transaction, expected, {fetchTransaction, verifyTransaction, timeoutMs=5000}) {
  // Do not look up transactions based solely on a caller-provided identifier.
  if (!transaction || !expected || expected.environment !== 'Sandbox' ||
      transaction.environment !== 'Sandbox' || transaction.bundleId !== 'com.rikuto.mushiverse' ||
      transaction.transactionId !== expected.transactionId ||
      transaction.originalTransactionId !== expected.originalTransactionId ||
      transaction.productId !== expected.productId ||
      typeof transaction.appAccountToken !== 'string' || typeof expected.appAccountToken !== 'string' ||
      transaction.appAccountToken.toLowerCase() !== expected.appAccountToken.toLowerCase() ||
      transaction.revocationDate != null || transaction.revocationReason != null ||
      transaction.type !== 'Consumable' || transaction.quantity !== 1 || transaction.inAppOwnershipType !== 'PURCHASED')
    throw new Error('invalid_signed_date');
  try { validateVerifiedAppleCoinTransaction(transaction, expected); }
  catch (error) {
    if (!(error instanceof Error) || error.message !== 'invalid_signed_date') throw error;
    if (typeof fetchTransaction !== 'function' || typeof verifyTransaction !== 'function') throw error;
    let timer;
    try {
      const fresh = await Promise.race([
        (async()=>{
          let response;
          try {response=await fetchTransaction(transaction.transactionId)} catch {throw new Error('apple_recovery_unavailable')}
          const jws=response?.signedTransactionInfo;
          if(typeof jws!=='string'||jws.length>16384||! /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jws))throw new Error('invalid_signed_date');
          return await verifyTransaction(jws);
        })(),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('apple_recovery_unavailable')),timeoutMs)})
      ]);
      const verified=validateVerifiedAppleCoinTransaction(fresh,expected);
      return {transaction:fresh,verified};
    } finally {clearTimeout(timer)}
  }
  // Callers must only enter recovery following the specific date rejection.
  throw new Error('invalid_signed_date');
}
