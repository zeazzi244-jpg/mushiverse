import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import type {AuthenticatedAccount} from './apple-credit-handler.ts';
const admin=()=>{
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)throw Error('unavailable');
 return createClient(url,key,{auth:{persistSession:false}});
};
export async function creditCoins(tx:Record<string,unknown>,account:AuthenticatedAccount){
 const {data,error}=await admin().rpc('credit_verified_gacha_purchase_v2',{
  p_transaction_id:tx.transactionId,p_user_id:account.id,p_product_id:tx.productId,
  p_environment:tx.environment,p_session_id:account.sessionID,
 });return !error&&data===true;
}
export async function drawCoins(drawID:string,count:number,account:AuthenticatedAccount,environment:string){
 const {data,error}=await admin().rpc('draw_with_purchased_gacha_coins_v2',{
  p_draw_id:drawID,p_user_id:account.id,p_count:count,p_environment:environment,p_session_id:account.sessionID,
 });if(error||!data)throw Error('draw_unavailable');return data;
}
export async function applyCoinStatus(notificationID:string,tx:Record<string,unknown>,refunded:boolean){
 const {data,error}=await admin().rpc('apply_verified_apple_coin_status_v2',{
  p_notification_id:notificationID,p_transaction_id:tx.transactionId,p_product_id:tx.productId,
  p_environment:tx.environment,p_refunded:refunded,p_status_ms:tx.signedDate,
 });return !error&&data===true;
}
