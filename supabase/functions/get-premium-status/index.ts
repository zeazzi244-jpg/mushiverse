import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"GET,POST,OPTIONS"
};

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="GET"&&req.method!=="POST") return new Response(JSON.stringify({error:"method_not_allowed"}),{status:405,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store","Allow":"GET, POST, OPTIONS"}});
  try{
    const auth=req.headers.get("Authorization")||"";
    const url=Deno.env.get("SUPABASE_URL")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const {data:{user},error:uerr}=await sb.auth.getUser();
    if(uerr||!user) return new Response(JSON.stringify({error:"unauthorized"}),{status:401,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
    const {data,error}=await sb.from("premium_entitlements").select("plan,source,status,current_period_end,updated_at").eq("user_id",user.id).maybeSingle();
    if(error) throw error;
    const periodEnd=data?.current_period_end ? Date.parse(data.current_period_end) : NaN;
    // Fail closed on missing, malformed, or expired entitlement periods.
    const active=!!data && data.plan==="premium" && ["trialing","active"].includes(data.status)
      && Number.isFinite(periodEnd) && periodEnd>Date.now();
    // Entitlements can expire or be revoked between requests. Never let a CDN,\n    // intermediary, or WKWebView reuse a previously active premium response.\n    return new Response(JSON.stringify({plan:active?"premium":"free",source:data?.source||null,status:data?.status||"inactive",current_period_end:data?.current_period_end||null,updated_at:data?.updated_at||null}),{headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store, private","Pragma":"no-cache","Vary":"Authorization","X-Content-Type-Options":"nosniff"}});
  }catch(e){
    return new Response(JSON.stringify({error:"server_error"}),{status:500,headers:{...cors,"Content-Type":"application/json"}});
  }
});