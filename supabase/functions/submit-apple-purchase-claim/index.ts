import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { appleCoinPacks, isAppleCoinProduct } from "../_shared/apple-coin-transaction-policy.mjs";
const premiumProducts = new Set(["jp.mushiverse.premium.monthly", "jp.mushiverse.premium.annual"]);
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return json({error:"method_not_allowed"},405);
  try{
    const auth=req.headers.get("Authorization")||"";
    if(!/^Bearer\s+\S+$/i.test(auth)) return json({error:"unauthorized"},401);
    const url=Deno.env.get("SUPABASE_URL")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const admin=createClient(url,service);
    const {data:{user},error:uerr}=await userClient.auth.getUser();
    if(uerr||!user) return json({error:"unauthorized"},401);
    // Match the Production verifier and both paid-draw endpoints: permission
    // to purchase must come from server-controlled app_metadata, not a
    // client-side kids-mode switch or user-editable profile fields.
    if(user.app_metadata?.kid_mode===true ||
       user.app_metadata?.minor===true ||
       user.app_metadata?.iap_disabled===true)
      return json({error:"purchases_restricted"},403);

    // Claims are untrusted input: bound request size and validate full values
    // rather than truncating strings into a potentially different transaction.
    const declaredLength=req.headers.get("content-length");
    if(declaredLength!==null){
      if(!/^(0|[1-9][0-9]*)$/.test(declaredLength)) return json({error:"invalid_content_length"},400);
      if(!Number.isSafeInteger(Number(declaredLength))||Number(declaredLength)>4096)
        return json({error:"request_too_large"},413);
    }
    // Limit actual streamed bytes, including chunked requests with no Content-Length.
    // req.text() would buffer the entire attacker-controlled body first.
    const reader=req.body?.getReader();
    if(!reader) return json({error:"invalid_body"},400);
    const chunks:Uint8Array[]=[];
    let received=0;
    try{
      while(true){
        const {done,value}=await reader.read();
        if(done) break;
        received+=value.byteLength;
        if(received>4096){
          await reader.cancel();
          return json({error:"request_too_large"},413);
        }
        chunks.push(value);
      }
    }finally{reader.releaseLock()}
    if(declaredLength!==null&&received!==Number(declaredLength))
      return json({error:"content_length_mismatch"},400);
    const bytes=new Uint8Array(received);
    let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
    let rawBody:string;
    try{rawBody=new TextDecoder("utf-8",{fatal:true}).decode(bytes)}
    catch{return json({error:"invalid_utf8"},400)}
    let body:Record<string,unknown>;
    try{body=JSON.parse(rawBody)}catch{return json({error:"invalid_json"},400)}
    if(!body||typeof body!=="object"||Array.isArray(body))return json({error:"invalid_body"},400);
    // Use the same read-only release checks before payment and before claim staging.
    async function productionGate(productId: string) {
      if(!isAppleCoinProduct(productId)) return json({error:"production_product_not_approved"},403);
      const [{data:billing,error:billingError},{data:gate,error:gateError},{data:pack,error:packError}]=await Promise.all([
        admin.from("billing_settings").select("billing_mode,checkout_enabled,ios_iap_ready").eq("singleton",true).single(),
        admin.from("apple_iap_verification_gate").select("server_jws_verified,sandbox_purchase_proven").eq("singleton",true).single(),
        admin.from("apple_coin_pack_catalog").select("coins,is_sale_enabled").eq("product_id",productId).single(),
      ]);
      if(billingError||gateError||packError) return json({error:"production_claim_unavailable"},503);
      if(!billing||billing.billing_mode!=="live"||billing.checkout_enabled!==true||billing.ios_iap_ready!==true||
         !gate||gate.server_jws_verified!==true||gate.sandbox_purchase_proven!==true||
         !pack||pack.coins!==appleCoinPacks[productId as keyof typeof appleCoinPacks]||pack.is_sale_enabled!==true)
        return json({error:"production_fulfillment_disabled"},503);
      return null;
    }
    if(body.action!==undefined){
      if(body.action!=="production_availability"||Object.keys(body).some(key=>key!=="action"&&key!=="product_id")||typeof body.product_id!=="string")
        return json({error:"invalid_availability_request"},400);
      const denied=await productionGate(body.product_id);
      if(denied) return denied;
      return json({ok:true,available:true,product_id:body.product_id,coins:appleCoinPacks[body.product_id as keyof typeof appleCoinPacks]});
    }
    const transactionId=body.transaction_id;
    const originalTransactionId=body.original_transaction_id??null;
    const productId=body.product_id;
    const environment=body.environment??null;
    if(typeof transactionId!=="string"||!/^\d{6,30}$/.test(transactionId)) return json({error:"invalid_transaction_id"},400);
    if(originalTransactionId!==null&&(typeof originalTransactionId!=="string"||!/^\d{6,30}$/.test(originalTransactionId)))
      return json({error:"invalid_original_transaction_id"},400);
    if(typeof productId!=="string"||(!isAppleCoinProduct(productId)&&!premiumProducts.has(productId)))
      return json({error:"invalid_product_id"},400);
    // Every Apple transaction, including consumable coin packs, has an original transaction ID.
    // Require it at claim time so the Sandbox verifier cannot be bypassed or dead-ended.
    // This is still unverified metadata: only Apple-signed values can grant access.
    if(!originalTransactionId)
      return json({error:"original_transaction_id_required"},400);
    // Consumable purchases cannot be renewal chains. Reject impossible claims
    // before storing them; the signed JWS verifier independently enforces this.
    if(isAppleCoinProduct(productId) && originalTransactionId!==transactionId)
      return json({error:"consumable_transaction_chain_mismatch"},400);
    // An environment field is an untrusted routing hint, never Apple proof.
    // The separate settlement endpoint verifies Apple's signed JWS before
    // crediting anything. Keep Xcode/local StoreKit claims rejected.
    if(environment!==null&&environment!=="Sandbox"&&environment!=="Production")
      return json({error:"unsupported_environment"},400);
    if(environment==="Production"){
      // Production claims may be staged only after every independent release
      // gate is open. This must not be a client-controlled feature switch.
      const denied=await productionGate(productId);
      if(denied) return denied;
    }

    // Claims are only unverified reports. Replays must never reset a verified
    // or rejected transaction to pending, nor reassign it to another user.
    const {data:existing,error:lookupError}=await admin.from("apple_purchase_claims")
      .select("id,user_id,product_id,original_transaction_id,status")
      .eq("transaction_id",transactionId).limit(2);
    if(lookupError) throw lookupError;
    if(existing?.length){
      // Multiple rows for one Apple transaction indicate broken uniqueness.
      // Never acknowledge an ambiguous claim as an idempotent success.
      if(existing.length !== 1) return json({error:"transaction_integrity_conflict"},409);
      if(existing.some((row:any)=>row.user_id!==user.id || row.product_id!==productId || row.original_transaction_id!==originalTransactionId))
        return json({error:"transaction_already_claimed"},409);
      return json({ok:true,claim_id:existing[0].id,status:existing[0].status});
    }
    // Subscription renewals have different transaction IDs but the same
    // original transaction ID. Do not let a second account claim that chain.
    if(originalTransactionId){
      if(!/^\d{6,}$/.test(originalTransactionId)) return json({error:"invalid_original_transaction_id"},400);
      // Query conflicting rows directly. A limited sample of the chain can
      // miss a foreign owner or product after two legitimate renewals.
      const {data:foreignOwner,error:ownerError}=await admin.from("apple_purchase_claims")
        .select("transaction_id").eq("original_transaction_id",originalTransactionId)
        .neq("user_id",user.id).limit(1);
      if(ownerError) throw ownerError;
      if(foreignOwner?.length)
        return json({error:"subscription_already_claimed"},409);
      // Apple subscription upgrades/downgrades can keep the same original
      // transaction ID while switching between monthly and annual products.
      // Only block cross-category reuse (coins vs subscriptions) or unknown
      // products; a same-owner premium plan change is a legitimate renewal.
      const productQuery=admin.from("apple_purchase_claims")
        .select("transaction_id").eq("original_transaction_id",originalTransactionId);
      const {data:conflictingProduct,error:productError}=premiumProducts.has(productId)
        ? await productQuery.not("product_id","in",'("jp.mushiverse.premium.monthly","jp.mushiverse.premium.annual")').limit(1)
        : await productQuery.neq("product_id",productId).limit(1);
      if(productError) throw productError;
      if(conflictingProduct?.length)
        return json({error:"original_transaction_chain_conflict"},409);
      // A consumable original transaction identifies one purchase, unlike a
      // subscription chain which legitimately has renewal transaction IDs.
      // Reject another transaction ID for the same consumable original ID
      // before creating a misleading pending claim. This is a preflight
      // check; DB uniqueness and verified fulfillment remain authoritative.
      if(isAppleCoinProduct(productId)){
        const {data:otherConsumable,error:otherError}=await admin.from("apple_purchase_claims")
          .select("transaction_id").eq("original_transaction_id",originalTransactionId)
          .neq("transaction_id",transactionId).limit(1);
        if(otherError) throw otherError;
        if(otherConsumable?.length)
          return json({error:"consumable_original_transaction_conflict"},409);
      }
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
          .select("id,user_id,product_id,original_transaction_id,status").eq("transaction_id",transactionId).limit(2);
        if(retryError) throw retryError;
        if(winner?.length===1 && winner[0].user_id===user.id && winner[0].product_id===productId && winner[0].original_transaction_id===originalTransactionId)
          return json({ok:true,claim_id:winner[0].id,status:winner[0].status});
        return json({error:"transaction_already_claimed"},409);
      }
      throw error;
    }
    return json({ok:true,claim_id:data.id,status:data.status});
  }catch{return json({error:"server_error"},500)}
});
