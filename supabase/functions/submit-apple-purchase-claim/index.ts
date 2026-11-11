import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return json({error:"method_not_allowed"},405);
  try{
    const auth=req.headers.get("Authorization")||"";
    if(!/^Bearer\\s+\\S+$/i.test(auth)) return json({error:"unauthorized"},401);
    const url=Deno.env.get("SUPABASE_URL")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const admin=createClient(url,service);
    const {data:{user},error:uerr}=await userClient.auth.getUser();
    if(uerr||!user) return json({error:"unauthorized"},401);

    // Claims are untrusted input: bound request size and validate full values
    // rather than truncating strings into a potentially different transaction.
    const length=Number(req.headers.get("content-length")||0);
    if(length>4096) return json({error:"request_too_large"},413);
    const rawBody=await req.text();
    if(rawBody.length>4096) return json({error:"request_too_large"},413);
    let body:Record<string,unknown>;
    try{body=JSON.parse(rawBody)}catch{return json({error:"invalid_json"},400)}
    if(!body||typeof body!=="object"||Array.isArray(body))return json({error:"invalid_body"},400);
    const transactionId=body.transaction_id;
    const originalTransactionId=body.original_transaction_id||null;
    const productId=body.product_id;
    const environment=body.environment||null;
    if(typeof transactionId!=="string"||!/^\d{6,120}$/.test(transactionId)) return json({error:"invalid_transaction_id"},400);
    if(originalTransactionId!==null&&(typeof originalTransactionId!=="string"||!/^\d{6,120}$/.test(originalTransactionId)))
      return json({error:"invalid_original_transaction_id"},400);
    if(typeof productId!=="string"||!["jp.mushiverse.premium.monthly","jp.mushiverse.premium.annual","mushiverse.coins.100","mushiverse.coins.500","mushiverse.coins.1200"].includes(productId))
      return json({error:"invalid_product_id"},400);
    if(environment!==null&&(typeof environment!=="string"||!["Sandbox","Production","Xcode","storekit"].includes(environment)))
      return json({error:"invalid_environment"},400);

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
    // Subscription renewals have different transaction IDs but the same
    // original transaction ID. Do not let a second account claim that chain.
    if(originalTransactionId){
      if(!/^\d{6,}$/.test(originalTransactionId)) return json({error:"invalid_original_transaction_id"},400);
      const {data:chain,error:chainError}=await admin.from("apple_purchase_claims")
        .select("user_id").eq("original_transaction_id",originalTransactionId).limit(1);
      if(chainError) throw chainError;
      if(chain?.length && chain[0].user_id!==user.id)
        return json({error:"subscription_already_claimed"},409);
    }

    // Rate-limit new unverified claims. Replaying an existing transaction
    // above remains idempotent and does not consume this quota.
    const since=new Date(Date.now()-60*60*1000).toISOString();
    const {count:recentCount,error:rateError}=await admin.from("apple_purchase_claims")
      .select("id",{count:"exact",head:true}).eq("user_id",user.id)
      .gte("created_at",since);
    if(rateError) throw rateError;
    if((recentCount??0)>=30) return json({error:"claim_rate_limited"},429);

    const {data,error}=await admin.from("apple_purchase_claims").insert({
      user_id:user.id,
      transaction_id:transactionId,
      original_transaction_id:originalTransactionId,
      product_id:productId,
      // Never record an untrusted device-selected environment as Apple's verified environment.
      // The trusted verification worker must populate it from Apple's signed transaction.
      environment:null,
      status:"pending"
    }).select("id,status,created_at").single();
    if(error){
      // A concurrent request may have won the unique transaction-ID insert race.
      // Re-read its committed owner/product instead of treating a safe retry as a conflict.
      // Never report success if the winner belongs to a different account or product.
      if(error.code==="23505"){
        const {data:winner,error:retryError}=await admin.from("apple_purchase_claims")
          .select("id,user_id,product_id,status").eq("transaction_id",transactionId).limit(2);
        if(retryError) throw retryError;
        if(winner?.length===1 && winner[0].user_id===user.id && winner[0].product_id===productId)
          return json({ok:true,claim_id:winner[0].id,status:winner[0].status});
        return json({error:"transaction_already_claimed"},409);
      }
      throw error;
    }
    return json({ok:true,claim_id:data.id,status:data.status});
  }catch{return json({error:"server_error"},500)}
});