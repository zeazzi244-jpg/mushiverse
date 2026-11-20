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
    if(!/^Bearer\s+\S+$/i.test(auth)) return new Response(JSON.stringify({error:"unauthorized"}),{status:401,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store, private","Vary":"Authorization"}});
    const url=Deno.env.get("SUPABASE_URL")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const {data:{user},error:uerr}=await sb.auth.getUser();
    if(uerr||!user) return new Response(JSON.stringify({error:"unauthorized"}),{status:401,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
    const {data,error}=await sb.from("premium_entitlements").select("plan,source,status,current_period_end,updated_at,provider_subscription_id").eq("user_id",user.id).maybeSingle();
    if(error) throw error;
    // Apple premium is not released until both independent IAP proof gates pass.
    // Existing non-Apple subscriptions retain their established entitlement logic.
    // Recognize all supported App Store/StoreKit source labels, not just apple_*.
    // Otherwise a differently named Apple entitlement could bypass the proof gate.
    // Only explicitly recognized non-Apple billing sources may use the legacy entitlement path.
    // An unfamiliar or missing source must never become premium merely by avoiding
    // the known Apple source-name prefixes.
    const source=typeof data?.source==="string" ? data.source.trim().toLowerCase() : "";
    const nonAppleSource=/^(?:stripe|stripe_subscription|stripe_checkout|manual|admin)$/.test(source);
    const appleSource=!!source && !nonAppleSource;
    let applePurchaseProven=nonAppleSource;
    if(appleSource){
      const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if(service){
        const admin=createClient(url,service);
        const {data:gate,error:gateError}=await admin.from("apple_iap_verification_gate")
          .select("server_jws_verified,sandbox_purchase_proven").eq("singleton",true).maybeSingle();
        // Global release gates are necessary but never sufficient for a user's entitlement.
        // Bind the active subscription to a server-verified, non-revoked Apple event.
        if(!gateError && gate?.server_jws_verified===true && gate?.sandbox_purchase_proven===true &&
           typeof data?.provider_subscription_id==="string" && /^\d{6,30}$/.test(data.provider_subscription_id)){
          // Evaluate the latest verified event, including revocations. Looking for
          // *any* older unrevoked event can incorrectly restore a revoked subscription.
          const {data:events,error:eventError}=await admin.from("apple_iap_events")
            .select("transaction_id,product_id,environment,revocation_date,expires_date,purchase_date").eq("user_id",user.id)
            .eq("original_transaction_id",data.provider_subscription_id)
            .not("verified_at","is",null)
            // A delayed verification of an older transaction must not supersede a newer renewal or revocation.
            .order("purchase_date",{ascending:false}).order("verified_at",{ascending:false}).limit(1);
          const latest=events?.[0];
          const expiresAt=latest?.expires_date ? Date.parse(latest.expires_date) : NaN;
          const purchasedAt=latest?.purchase_date ? Date.parse(latest.purchase_date) : NaN;
          // Only a well-formed, already-purchased signed event may establish access.
          // Reject impossible future purchases and reversed purchase/expiry periods.
          const validSignedPeriod=typeof latest?.transaction_id==="string" && /^\\d{6,30}$/.test(latest.transaction_id) &&
            Number.isFinite(purchasedAt) && purchasedAt<=Date.now()+5*60*1000 &&
            Number.isFinite(expiresAt) && expiresAt>purchasedAt;
          // A verified transaction must be a supported subscription, never a coin pack or an unknown environment.
          const supportedPremiumProduct=latest?.product_id==="jp.mushiverse.premium.monthly" || latest?.product_id==="jp.mushiverse.premium.annual";
          // Until production Apple transactions are independently proven, only Sandbox-signed events may establish an Apple entitlement.
          // The global gates alone must not turn an unexpected Production event into premium.
          const supportedEnvironment=latest?.environment==="Sandbox";
          applePurchaseProven=!eventError && !!latest && supportedPremiumProduct && supportedEnvironment && latest.revocation_date==null &&
            validSignedPeriod && expiresAt>Date.now();
        }
      }
    }
    const periodEnd=data?.current_period_end ? Date.parse(data.current_period_end) : NaN;
    // Fail closed on missing, malformed, or expired entitlement periods.
    const active=applePurchaseProven && !!data && data.plan==="premium" && ["trialing","active"].includes(data.status)
      && Number.isFinite(periodEnd) && periodEnd>Date.now();
    // An Apple entitlement blocked by the proof gate is pending verification, not expired.
    // Do not return an expired or malformed entitlement as status=active:
    // clients must not accidentally grant premium by reading status alone.
    const pendingVerification=!applePurchaseProven && !!data && (appleSource || !source) &&
      data.plan==="premium" && ["active","trialing"].includes(data.status) &&
      Number.isFinite(periodEnd) && periodEnd>Date.now();
    const effectiveStatus=active?data.status:(pendingVerification ? "verification_pending" :
      (data?.status==="active"||data?.status==="trialing"?"expired":data?.status||"inactive"));
    // Entitlements can expire or be revoked between requests. Never let a CDN,
    // intermediary, or WKWebView reuse a previously active premium response.
    return new Response(JSON.stringify({plan:active?"premium":"free",source:data?.source||null,status:effectiveStatus,current_period_end:data?.current_period_end||null,updated_at:data?.updated_at||null}),{headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store, private","Pragma":"no-cache","Vary":"Authorization","X-Content-Type-Options":"nosniff"}});
  }catch(e){
    return new Response(JSON.stringify({error:"server_error"}),{status:500,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store, private","Vary":"Authorization","X-Content-Type-Options":"nosniff"}});
  }
});