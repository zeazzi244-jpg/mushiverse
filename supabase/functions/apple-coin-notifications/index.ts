import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
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
 apply:async(notificationID,tx,refunded)=>{
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)throw Error('unavailable');
  const admin=createClient(url,key,{auth:{persistSession:false}});
  const {data,error}=await admin.rpc('apply_verified_apple_coin_status_v2',{
   p_notification_id:notificationID,p_transaction_id:tx.transactionId,p_product_id:tx.productId,
   p_environment:tx.environment,p_refunded:refunded,p_status_ms:tx.signedDate,
  });return !error&&data===true;
 },
}));
