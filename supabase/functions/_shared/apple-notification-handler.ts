import { readJSONBody } from './apple-credit-handler.ts';
import { validateCoinStatus } from './apple-coin-policy.ts';
export const REFUND_TYPES=new Set(['REFUND','REVOKE','REFUND_REVERSED']);
const json=(data:Record<string,unknown>,status:number)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export function createAppleNotificationHandler(deps:{
 enabled:()=>boolean;environment:()=>string;
 verify:(signed:string)=>Promise<{notification:Record<string,unknown>;transaction?:Record<string,unknown>}>;
 apply:(notificationID:string,tx:Record<string,unknown>,refunded:boolean)=>Promise<boolean>;
}) {
 return async(request:Request):Promise<Response>=>{
  if(request.method!=='POST')return json({error:'method_not_allowed'},405);
  if(!deps.enabled())return json({error:'apple_notifications_disabled'},503);
  let signed:unknown;
  try{signed=(await readJSONBody(request,5000,65536)).signedPayload;if(typeof signed!=='string'||!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(signed))throw Error('invalid_request')}catch{return json({error:'invalid_request'},400)}
  let result:Awaited<ReturnType<typeof deps.verify>>;
  try{result=await deps.verify(signed as string)}catch{return json({error:'apple_verification_failed'},422)}
  const {notification,transaction}=result;
  if(typeof notification.notificationUUID!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(notification.notificationUUID)||typeof notification.notificationType!=='string')return json({error:'invalid_notification'},422);
  if(notification.notificationType==='CONSUMPTION_REQUEST')return json({error:'consumption_reporting_not_configured'},503);
  if(!REFUND_TYPES.has(notification.notificationType))return json({accepted:true,ignored:true},200);
  try{
   if(!transaction)throw Error('missing_transaction');
   const status=validateCoinStatus(transaction,deps.environment());
   if(!deps.enabled())return json({error:'apple_notifications_disabled'},503);
   if(!await deps.apply(notification.notificationUUID,transaction,status.refunded))return json({error:'status_unavailable'},503);
   return json({accepted:true},200);
  }catch{return json({error:'status_unavailable'},503)}
 };
}
