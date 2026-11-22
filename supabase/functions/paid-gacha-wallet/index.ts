import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// All spendable paid coins and paid card receipts live in Postgres.
// The browser never supplies an account ID or an earned coin balance.
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
};
const headers = {...cors,"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"};
const respond=(body: Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function parseBody(request: Request) {
  const declared=request.headers.get("content-length");
  if(declared!==null&&(!/^\d{1,4}$/.test(declared)||Number(declared)>4096))
    throw Error("invalid_length");
  const reader=request.body?.getReader();
  if(!reader)throw Error("invalid_body");
  const chunks: Uint8Array[]=[];
  let total=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>4096){await reader.cancel();throw Error("too_large");}
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  if(declared!==null&&Number(declared)!==total)throw Error("length_mismatch");
  const bytes=new Uint8Array(total);
  let position=0;
  for(const chunk of chunks){bytes.set(chunk,position);position+=chunk.byteLength;}
  const data=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
  if(!data||typeof data!=="object"||Array.isArray(data))throw Error("invalid_body");
  return data as Record<string,unknown>;
}
Deno.serve(async(request: Request)=>{
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(request.method!=="POST")return respond({error:"method_not_allowed"},405);
  const token=request.headers.get("authorization")??"";
  if(!/^Bearer\s+\S+$/i.test(token))return respond({error:"unauthorized"},401);
  const url=Deno.env.get("SUPABASE_URL");
  const anon=Deno.env.get("SUPABASE_ANON_KEY");
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!service)return respond({error:"unavailable"},503);
  try{
    const userClient=createClient(url,anon,{global:{headers:{Authorization:token}}});
    const {data:{user},error:authError}=await userClient.auth.getUser();
    if(authError||!user)return respond({error:"unauthorized"},401);
    let body:Record<string,unknown>;
    try{body=await parseBody(request);}catch{return respond({error:"invalid_request"},400);}
    const admin=createClient(url,service);
    const [{data:billing,error:billingError},{data:proof,error:proofError},
           {data:pack,error:packError}] = await Promise.all([
      admin.from("billing_settings")
        .select("billing_mode,checkout_enabled,ios_iap_ready")
        .eq("singleton",true).single(),
      admin.from("apple_iap_verification_gate")
        .select("server_jws_verified,sandbox_purchase_proven")
        .eq("singleton",true).single(),
      admin.from("apple_coin_pack_catalog")
        .select("coins,is_sale_enabled")
        .eq("product_id","mushiverse.coins.100").single()
    ]);
    // A missing release gate must fail closed. Read-only wallet/history access
    // remains available during intentional billing pauses.
    const drawsEnabled = !billingError && !proofError && !packError &&
      billing?.billing_mode==="live" && billing?.checkout_enabled===true &&
      billing?.ios_iap_ready===true && proof?.server_jws_verified===true &&
      proof?.sandbox_purchase_proven===true &&
      pack?.coins===100 && pack?.is_sale_enabled===true;
    // Check for a server-recorded, Apple-signed refund. The DB draw RPC
    // checks the same quarantine after taking its per-user transaction lock,
    // so a refund racing a draw cannot be bypassed by an old status response.
    const {count:refundCount,error:refundError}=await admin.from("apple_coin_refund_holds")
      .select("transaction_id",{count:"exact",head:true}).eq("user_id",user.id);
    if(refundError)return respond({error:"refund_status_unavailable"},503);
    const refundHeld=(refundCount??0)>0;
    if(body.action==="status"){
      const page=body.page??0;
      if(!Number.isInteger(page)||Number(page)<0||Number(page)>100)
        return respond({error:"invalid_page"},400);
      const [{data:wallet,error:walletError},{data:draws,error:drawError}]=await Promise.all([
        admin.from("gacha_coin_wallets").select("balance").eq("user_id",user.id).maybeSingle(),
        admin.from("gacha_paid_draws").select("draw_id,draw_count,coins_spent,results,created_at")
          .eq("user_id",user.id).order("created_at",{ascending:false})
          .range(Number(page)*50,Number(page)*50+49),
      ]);
      if(walletError||drawError)return respond({error:"unavailable"},503);
      const balance=Number(wallet?.balance??0);
      if(!Number.isSafeInteger(balance)||balance<0)return respond({error:"invalid_balance"},503);
      return respond({ok:true,balance,draws:draws??[],page,
        has_more:(draws?.length??0)===50,draws_enabled:drawsEnabled&&!refundHeld,
        refund_reconciliation_required:refundHeld});
    }
    if(body.action!=="draw")return respond({error:"invalid_action"},400);
    // The native/JS kids toggle is not authorization. Only server-controlled
    // account flags can forbid a minor/restricted account from paid draws.
    if(user.app_metadata?.kid_mode===true || user.app_metadata?.minor===true ||
       user.app_metadata?.iap_disabled===true)
      return respond({error:"purchases_restricted"},403);
    if(refundHeld)return respond({error:"refund_reconciliation_required"},409);
    if(!drawsEnabled)return respond({error:"paid_draws_disabled"},503);
    if(Object.keys(body).some(key=>!["action","draw_id","count"].includes(key)))
      return respond({error:"invalid_draw"},400);
    if(typeof body.draw_id!=="string"||!uuid.test(body.draw_id)||
       ![1,10].includes(body.count as number))
      return respond({error:"invalid_draw"},400);
    const {data:draw,error:drawError}=await admin.rpc("draw_with_purchased_gacha_coins_and_lr",{
      p_draw_id:body.draw_id,p_user_id:user.id,p_count:body.count
    });
    if(drawError)return respond({error:"draw_unavailable"},503);
    if(!draw||draw.ok!==true){
      if(draw?.reason==="insufficient_balance")return respond({ok:false,error:"insufficient_balance"});
      return respond({error:"draw_unavailable"},503);
    }
    if(!Array.isArray(draw.results)||draw.results.length!==body.count||
       !draw.results.every((c:unknown)=>c&&typeof c==="object"&&!Array.isArray(c)&&
         Number.isInteger((c as Record<string,unknown>).card_id)&&
         ((c as Record<string,unknown>).card_id as number)>=1&&
         ((c as Record<string,unknown>).card_id as number)<=101))
      return respond({error:"draw_receipt_unavailable"},503);
    const {data:wallet,error:walletError}=await admin.from("gacha_coin_wallets")
      .select("balance").eq("user_id",user.id).single();
    if(walletError||!wallet)return respond({error:"wallet_unavailable"},503);
    return respond({ok:true,replayed:draw.replayed===true,draw_id:body.draw_id,
      results:draw.results,balance:Number(wallet.balance)});
  }catch{return respond({error:"unavailable"},503);}
});
