import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return json({error:"method_not_allowed"},405);
  try{
    const auth=req.headers.get("Authorization")||"";
    const url=Deno.env.get("SUPABASE_URL")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const admin=createClient(url,service);
    const {data:{user},error:uerr}=await userClient.auth.getUser();
    if(uerr||!user) return json({error:"unauthorized"},401);

    const body=await req.json().catch(()=>({}));
    const transactionId=String(body?.transaction_id||"").slice(0,120);
    const originalTransactionId=body?.original_transaction_id?String(body.original_transaction_id).slice(0,120):null;
    const productId=String(body?.product_id||"").slice(0,160);
    const environment=body?.environment?String(body.environment).slice(0,32):null;
    if(!/^\d{6,}$/.test(transactionId)) return json({error:"invalid_transaction_id"},400);
    if(!["jp.mushiverse.premium.monthly","jp.mushiverse.premium.annual"].includes(productId)) return json({error:"invalid_product_id"},400);

    // Claims are only unverified reports. Replays must never reset a verified
    // or rejected transaction to pending, nor reassign it to another user.
    const {data:existing,error:lookupError}=await admin.from("apple_purchase_claims")
      .select("id,user_id,product_id,status")
      .eq("transaction_id",transactionId).limit(2);
    if(lookupError) throw lookupError;
    if(existing?.length){
      if(existing.some((row:any)=>row.user_id!==user.id || row.product_id!==productId))
        return json({error:"transaction_already_claimed"},409);
      return json({ok:true,claim_id:existing[0].id,status:existing[0].status});
    }

    const {data,error}=await admin.from("apple_purchase_claims").insert({
      user_id:user.id,
      transaction_id:transactionId,
      original_transaction_id:originalTransactionId,
      product_id:productId,
      environment,
      status:"pending"
    }).select("id,status,created_at").single();
    if(error){
      // A concurrent identical submission may have inserted the row first.
      if(error.code==="23505") return json({error:"transaction_already_claimed"},409);
      throw error;
    }
    return json({ok:true,claim_id:data.id,status:data.status});
  }catch{return json({error:"server_error"},500)}
});