import { applyCoinStatus } from '../_shared/coin-ledger.ts';
import { appleServices } from '../_shared/apple-services.ts';
import { validateCoinStatus } from '../_shared/apple-coin-policy.ts';
import { createAppleNotificationHandler, REFUND_TYPES } from '../_shared/apple-notification-handler.ts';
Deno.serve(createAppleNotificationHandler({
 enabled:()=>Deno.env.get('APPLE_COIN_NOTIFICATIONS_ENABLED')==='true',
 environment:()=>Deno.env.get('APPLE_IAP_ENVIRONMENT')??'',
 verify:async signed=>{
  const {environment,verifier,apple}=appleServices();
  // No user JWT on Apple's webhook: the outer JWS AND nested transaction are verified against Apple trust.
  const notification=await verifier.verifyAndDecodeNotification(signed);
  if(!REFUND_TYPES.has(notification.notificationType??''))return {notification:notification as Record<string,unknown>};
  const nested=notification.data?.signedTransactionInfo;if(!nested)throw Error('missing_transaction');
  const original=await verifier.verifyAndDecodeTransaction(nested);
  const identity=validateCoinStatus(original as Record<string,unknown>,environment);
  const latest=await apple.getTransactionInfo(identity.transactionID);
  if(!latest.signedTransactionInfo)throw Error('missing_transaction');
  const tx=await verifier.verifyAndDecodeTransaction(latest.signedTransactionInfo);
  const current=validateCoinStatus(tx as Record<string,unknown>,environment);
  if(current.transactionID!==identity.transactionID||current.productID!==identity.productID||current.accountID!==identity.accountID)throw Error('transaction_mismatch');
  // Current Apple state, not notification arrival order, decides refund vs reversal.
  return {notification:notification as Record<string,unknown>,transaction:tx as Record<string,unknown>};
 },
 apply:applyCoinStatus,
}));
