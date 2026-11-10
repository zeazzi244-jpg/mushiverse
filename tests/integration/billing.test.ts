// Actual local GoTrue + PostgREST + Postgres; Apple trust alone is injected.
// This does not test a valid Apple JWS, Sandbox purchase or deployed Edge gateway.
import assert from 'node:assert/strict';
import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {authenticateSupabaseAccount} from '../../supabase/functions/_shared/supabase-account.ts';
import {createAppleCreditHandler} from '../../supabase/functions/_shared/apple-credit-handler.ts';
import {createPaidDrawHandler} from '../../supabase/functions/_shared/paid-draw-handler.ts';
import {createAppleNotificationHandler} from '../../supabase/functions/_shared/apple-notification-handler.ts';
import {creditCoins,drawCoins,applyCoinStatus} from '../../supabase/functions/_shared/coin-ledger.ts';
const url=Deno.env.get('SUPABASE_URL')??'';
if(url!=='http://127.0.0.1:54321')throw Error('local_integration_only');
const anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const caller=(token?:string)=>createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:token?{headers:{Authorization:'Bearer '+token}}:undefined});
const users:string[]=[];
const tx=(owner:string,id:string,coins=550)=>({bundleId:'com.rikuto.mushiverse',environment:'Sandbox',type:'Consumable',inAppOwnershipType:'PURCHASED',quantity:1,appAccountToken:owner,transactionId:id,productId:'mushiverse.coins.'+coins,purchaseDate:Date.now()-20000,signedDate:Date.now()-10000});
const request=(token:string,body:unknown)=>new Request('http://local.invalid',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
Deno.test('local Auth, handlers and real Postgres billing integration',async t=>{
 try{
 const login=async()=>{const email='billing-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomUUID()+'aA1!';const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.equal(created.error,null);users.push(created.data.user!.id);const signed=await caller().auth.signInWithPassword({email,password});assert.equal(signed.error,null);return {id:created.data.user!.id,token:signed.data.session!.access_token}};
 const a=await login(),b=await login();
 const original=tx(a.id,String(Date.now())+'01');let current:Record<string,unknown>=original;
 const credit=createAppleCreditHandler({authenticate:authenticateSupabaseAccount,enabled:()=>true,environment:()=> 'Sandbox',verify:async()=>current,credit:creditCoins});
 const draw=createPaidDrawHandler({authenticate:authenticateSupabaseAccount,enabled:()=>true,environment:()=> 'Sandbox',draw:drawCoins});
 const notify=(refunded:boolean,notificationID=crypto.randomUUID(),time=Date.now()-5000,transaction=original)=>createAppleNotificationHandler({enabled:()=>true,environment:()=> 'Sandbox',verify:async()=>({notification:{notificationUUID:notificationID,notificationType:refunded?'REFUND':'REFUND_REVERSED'},transaction:{...transaction,signedDate:time,...(refunded?{revocationDate:time}: {})}}),apply:applyCoinStatus})(request('',{signedPayload:'test.only.signature'}));
 const wallet=async()=>{const r=await caller(a.token).from('gacha_coin_wallets_v2').select('balance,debt').eq('environment','Sandbox').single();assert.equal(r.error,null);return {balance:Number(r.data.balance),debt:Number(r.data.debt)}};
 await t.step('real auth rejects forged tokens and fixed-off handlers never mutate',async()=>{
 assert.equal(await authenticateSupabaseAccount('Bearer forged'),null);
 const account=await authenticateSupabaseAccount('Bearer '+a.token);assert.equal(account?.id,a.id);assert.ok(account?.sessionID);
 const disabled=createAppleCreditHandler({authenticate:authenticateSupabaseAccount,enabled:()=>false,environment:()=> 'Sandbox',verify:async()=>{throw Error('must not verify')},credit:creditCoins});assert.equal((await disabled(request(a.token,{signed_transaction:'test.only.signature'}))).status,503);
 assert.equal((await admin.from('gacha_coin_wallets_v2').select('user_id').eq('user_id',a.id)).data?.length,0);
 });
 await t.step('simultaneous duplicate credit through HTTP RPC grants exactly once',async()=>{
 const rs=await Promise.all(Array.from({length:8},()=>credit(request(a.token,{signed_transaction:'test.only.signature'}))));assert.ok(rs.every(r=>r.status===200));assert.deepEqual(await wallet(),{balance:550,debt:0});
 assert.equal((await credit(request(b.token,{signed_transaction:'test.only.signature'}))).status,422);
 });
 await t.step('simultaneous retries return the same persisted draw and one debit',async()=>{
 const id=crypto.randomUUID(),rs=await Promise.all(Array.from({length:6},()=>draw(request(a.token,{draw_id:id,count:1,environment:'Production',cost:0}))));assert.ok(rs.every(r=>r.status===200));const data=await Promise.all(rs.map(r=>r.json()));for(const row of data)assert.deepEqual(row.results,data[0].results);assert.deepEqual(await wallet(),{balance:500,debt:0});
 const prod=await caller(a.token).from('gacha_coin_wallets_v2').select('balance').eq('environment','Production');assert.equal(prod.data?.length,0);
 });
 await t.step('refund arriving before claim blocks later credit without granting funds',async()=>{
 const future=tx(a.id,String(Date.now())+'02',100);assert.equal((await notify(true,crypto.randomUUID(),Date.now()-5000,future)).status,200);current=future;assert.equal((await credit(request(a.token,{signed_transaction:'test.only.signature'}))).status,503);assert.deepEqual(await wallet(),{balance:500,debt:0});current=original;
 });
 await t.step('spent refund debt, duplicate status and reversal preserve exact net coins',async()=>{
 assert.equal((await draw(request(a.token,{draw_id:crypto.randomUUID(),count:10}))).status,200);assert.deepEqual(await wallet(),{balance:50,debt:0});
 const id=crypto.randomUUID(),time=Date.now()-4000;assert.equal((await notify(true,id,time)).status,200);assert.equal((await notify(true,id,time)).status,200);assert.deepEqual(await wallet(),{balance:0,debt:500});assert.equal((await draw(request(a.token,{draw_id:crypto.randomUUID(),count:1}))).status,409);
 current=tx(a.id,String(Date.now())+'03',100);assert.equal((await credit(request(a.token,{signed_transaction:'test.only.signature'}))).status,200);assert.deepEqual(await wallet(),{balance:0,debt:400});
 assert.equal((await notify(false,crypto.randomUUID(),time+1000)).status,200);assert.equal((await notify(true,crypto.randomUUID(),time-1000)).status,200);assert.deepEqual(await wallet(),{balance:150,debt:0});
 });
 await t.step('concurrent distinct draws never overspend and cross-user reads/RPC reject',async()=>{
 const rs=await Promise.all(Array.from({length:4},()=>draw(request(a.token,{draw_id:crypto.randomUUID(),count:1}))));assert.equal(rs.filter(r=>r.status===200).length,3);assert.equal(rs.filter(r=>r.status===409).length,1);assert.deepEqual(await wallet(),{balance:0,debt:0});
 const own=await caller(b.token).from('gacha_coin_wallets_v2').select('*').eq('user_id',a.id);assert.equal(own.error,null);assert.equal(own.data?.length,0);
 const attack=await caller(b.token).rpc('apply_verified_apple_coin_status_v2',{p_notification_id:crypto.randomUUID(),p_transaction_id:original.transactionId,p_product_id:original.productId,p_environment:'Sandbox',p_refunded:false,p_status_ms:Date.now()});assert.ok(attack.error);
 const edit=await caller(a.token).from('gacha_coin_wallets_v2').update({balance:99999}).eq('user_id',a.id);assert.ok(edit.error);
 });
 await t.step('revoked session cannot spend even while the access JWT is not expired',async()=>{
 const result=await admin.auth.admin.signOut(a.token,'global');assert.equal(result.error,null);const response=await draw(request(a.token,{draw_id:crypto.randomUUID(),count:1}));assert.ok([401,503].includes(response.status));
 });
 await t.step('deleted user retains replay tombstones and notifications never recreate wallet',async()=>{
 const result=await admin.auth.admin.deleteUser(a.id);assert.equal(result.error,null);assert.equal((await notify(true,crypto.randomUUID(),Date.now()-1000)).status,200);const credits=await admin.from('gacha_coin_purchase_credits_v2').select('user_id').eq('transaction_id',original.transactionId);assert.equal(credits.data?.[0]?.user_id,null);assert.equal((await admin.from('gacha_coin_wallets_v2').select('user_id').eq('user_id',a.id)).data?.length,0);
 });
 }finally{for(const id of users)await admin.auth.admin.deleteUser(id)}
});
