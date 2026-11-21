import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// Server-authoritative paid draws; never accepts client-selected cards or
// coin balances. This endpoint stays closed while Production billing is OFF.
const cors = {
  "access-control-allow-origin":"*",
  "access-control-allow-headers":"authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods":"GET, POST, OPTIONS"
};
const headers = {...cors,"content-type":"application/json; charset=utf-8",
  "cache-control":"no-store","x-content-type-options":"nosniff"};
const reply = (body: Record<string,unknown>, status=200) =>
  new Response(JSON.stringify(body),{status,headers});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readJson(req: Request) {
  const length = req.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length)>1024))
    throw Error("invalid_body_size");
  const reader = req.body?.getReader();
  if (!reader) throw Error("invalid_body");
  const chunks:Uint8Array[]=[];
  let count=0;
  try {
    while (true) {
      const {done,value}=await reader.read();
      if(done) break;
      count+=value.byteLength;
      if(count>1024){await reader.cancel();throw Error("request_too_large");}
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (length !== null && Number(length)!==count) throw Error("length_mismatch");
  const data = new Uint8Array(count);
  let offset=0;
  for (const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
  const body=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(data));
  if (!body || typeof body!=="object" || Array.isArray(body)) throw Error("invalid_body");
  return body as Record<string,unknown>;
}

Deno.serve(async (req:Request)=>{
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
  if(!["GET","POST"].includes(req.method)) return reply({error:"method_not_allowed"},405);
  const bearer=req.headers.get("authorization")??"";
  if(!/^Bearer\s+\S+$/i.test(bearer)) return reply({error:"unauthorized"},401);
  const url=Deno.env.get("SUPABASE_URL");
  const anon=Deno.env.get("SUPABASE_ANON_KEY");
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!service) return reply({error:"service_unavailable"},503);

  try {
    const userClient=createClient(url,anon,{global:{headers:{Authorization:bearer}}});
    const {data:{user},error:authError}=await userClient.auth.getUser();
    if(authError||!user||!uuid.test(user.id)) return reply({error:"unauthorized"},401);

    // Server-side account restrictions, not the editable client kid-mode toggle.
    if(user.app_metadata?.kid_mode===true || user.app_metadata?.minor===true ||
       user.app_metadata?.iap_disabled===true)
      return reply({error:"purchases_restricted"},403);

    const admin=createClient(url,service);
    const [{data:billing,error:billingError},{data:gate,error:gateError},
           {data:pack,error:packError}]=await Promise.all([
      admin.from("billing_settings")
        .select("billing_mode,checkout_enabled,ios_iap_ready").eq("singleton",true).single(),
      admin.from("apple_iap_verification_gate")
        .select("server_jws_verified,sandbox_purchase_proven").eq("singleton",true).single(),
      admin.from("apple_coin_pack_catalog")
        .select("is_sale_enabled,coins").eq("product_id","mushiverse.coins.100").single()
    ]);
    if(billingError||gateError||packError) return reply({error:"service_unavailable"},503);
    if(billing.billing_mode!=="live"||billing.checkout_enabled!==true||
       billing.ios_iap_ready!==true||gate.server_jws_verified!==true||
       gate.sandbox_purchase_proven!==true||pack.is_sale_enabled!==true||
       pack.coins!==100) return reply({error:"paid_draws_disabled"},503);

    if(req.method==="GET"){
      const {data:wallet,error}=await admin.from("gacha_coin_wallets")
        .select("balance").eq("user_id",user.id).maybeSingle();
      if(error) return reply({error:"balance_unavailable"},503);
      const {data:history,error:historyError}=await admin.from("gacha_paid_draws")
        .select("draw_id,draw_count,coins_spent,results,created_at")
        .eq("user_id",user.id).order("created_at",{ascending:false}).limit(20);
      if(historyError) return reply({error:"history_unavailable"},503);
      const balance=Number(wallet?.balance??0);
      if(!Number.isSafeInteger(balance)||balance<0) return reply({error:"balance_unavailable"},503);
      return reply({ok:true,balance,currency:"purchased_coins",history:history??[]});
    }

    let body:Record<string,unknown>;
    try{body=await readJson(req);}catch{return reply({error:"invalid_request"},400);}
    const drawID=body.draw_id;
    const count=body.count;
    // A caller-provided stable UUID is required for safely replaying a
    // dropped response; no client-selected rarity, card or balance accepted.
    if(typeof drawID!=="string"||!uuid.test(drawID)||
       (count!==1&&count!==10)||Object.keys(body).some(k=>!["draw_id","count"].includes(k)))
      return reply({error:"invalid_draw"},400);
    const {data,error}=await admin.rpc("draw_with_purchased_gacha_coins_and_lr",{
      p_draw_id:drawID,p_user_id:user.id,p_count:count
    });
    if(error||!data||typeof data!=="object") return reply({error:"draw_unavailable"},503);
    if(data.ok!==true){
      if(data.reason==="insufficient_balance") return reply({error:"insufficient_balance"},409);
      return reply({error:"draw_rejected"},409);
    }
    if(!Array.isArray(data.results)||data.results.length!==count)
      return reply({error:"draw_receipt_invalid"},503);
    return reply({ok:true,draw_id:drawID,replayed:data.replayed===true,
      draw_count:count,results:data.results,balance:data.balance??null});
  }catch{
    return reply({error:"service_unavailable"},503);
  }
});
