import { Buffer } from "node:buffer";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Environment, SignedDataVerifier, VerificationException, VerificationStatus } from "npm:@apple/app-store-server-library@3.1.0";
import { APPLE_G3_ROOT_DER_BASE64 } from "../_shared/apple-production-coin-verifier.ts";

// Apple App Store Server Notifications V2. This endpoint is public because Apple
// cannot send a Supabase JWT. BOTH the outer JWS and the inner transaction JWS
// must validate cryptographically against the pinned Apple root before any DB write.
// No purchase, grant, wallet deduction, or card deletion happens here.
const response = (body: Record<string, unknown>, status=200) =>
  new Response(JSON.stringify(body), {status,headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store", "x-content-type-options":"nosniff"
  }});
// Apple Root CA - G2, DER-encoded; fingerprint is checked in regression tests.
const APPLE_G2_ROOT_DER_BASE64 = "MIIFkjCCA3qgAwIBAgIIAeDltYNno+AwDQYJKoZIhvcNAQEMBQAwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEcyMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxMDA5WhcNMzkwNDMwMTgxMDA5WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzIxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBANgREkhI2imKScUcx+xuM23+TfvgHN6sXuI2pyT5f1BrTM65MFQn5bPW7SXmMLYFN14UIhHF6Kob0vuy0gmVOKTvKkmMXT5xZgM4+xb1hYjkWpIMBDLyyED7Ul+f9sDx47pFoFDVEovy3d6RhiPw9bZyLgHaC/YuOQhfGaFjQQscp5TBhsRTL3b2CtcM0YM/GlMZ81fVJ3/8E7j4ko380yhDPLVoACVdJ2LT3VXdRCCQgzWTxb+4Gftr49wIQuavbfqeQMpOhYV4SbHXw8EwOTKrfl+q04tvny0aIWhwZ7Oj8ZhBbZF8+NfbqOdfIRqMM78xdLe40fTgIvS/cjTf94FNcX1RoeKz8NMoFnNvzcytN31O661A4T+B/fc9Cj6i8b0xlilZ3MIZgIxbdMYs0xBTJh0UT8TUgWY8h2czJxQI6bR3hDRSj4n4aJgXv8O7qhOTH11UL6jHfPsNFL4VPSQ08prcdUFmIrQB1guvkJ4M6mL4m1k8COKWNORj3rw31OsMiANDC1CvoDTdUE0V+1ok2Az6DGOeHwOx4e7hqkP0ZmUoNwIx7wHHHtHMn23KVDpA287PT0aLSmWaasZobNfMmRtHsHLDd4/E92GcdB/O/WuhwpyUgquUoue9G7q5cDmVF8Up8zlYNPXEpMZ7YLlmQ1A/bmH8DvmGqmAMQ0uVAgMBAAGjQjBAMB0GA1UdDgQWBBTEmRNsGAPCe8CjoA1/coB6HHcmjTAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBBjANBgkqhkiG9w0BAQwFAAOCAgEAUabz4vS4PZO/Lc4Pu1vhVRROTtHlznldgX/+tvCHM/jvlOV+3Gp5pxy+8JS3ptEwnMgNCnWefZKVfhidfsJxaXwU6s+DDuQUQp50DhDNqxq6EWGBeNjxtUVAeKuowM77fWM3aPbn+6/Gw0vsHzYmE1SGlHKy6gLti23kDKaQwFd1z4xCfVzmMX3zybKSaUYOiPjjLUKyOKimGY3xn83uamW8GrAlvacp/fQ+onVJv57byfenHmOZ4VxG/5IFjPoeIPmGlFYl5bRXOJ3riGQUIUkhOb9iZqmxospvPyFgxYnURTbImHy99v6ZSYA7LNKmp4gDBDEZt7Y6YUX6yfIjyGNzv1aJMbDZfGKnexWoiIqrOEDCzBL/FePwN983csvMmOa/orz6JopxVtfnJBtIRD6e/J/JzBrsQzwBvDR4yGn1xuZW7AYJNpDrFEobXsmII9oDMJELuDY++ee1KG++P+w8j2Ud5cAeh6Squpj9kuNsJnfdBrRkBof0Tta6SqoWqPQFZ2aWuuJVecMsXUmPgEkrihLHdoBR37q9ZV0+N0djMenl9MU/S60EinpxLK8JQzcPqOMyT/RFtm2XNuyE9QoB6he7hY1Ck3DDUOUUi78/w0EP3SIEIwiKum1xRKtzCTrJ+VKACd+66eYWyi4uTLLT3OUEVLLUNIAytbwPF+E=";
const appId = 6826061606;
const bundleId = "com.rikuto.mushiverse";
const txId = /^\d{6,30}$/;
const accountId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readBounded(request: Request): Promise<string> {
  const declared=request.headers.get("content-length");
  if(declared!==null && (!/^(0|[1-9]\d*)$/.test(declared) || Number(declared)>50000))
    throw Error("invalid_content_length");
  const reader=request.body?.getReader();
  if(!reader)throw Error("invalid_body");
  const chunks: Uint8Array[]=[];let size=0;
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>50000) {await reader.cancel();throw Error("request_too_large");}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  if(declared!==null && size!==Number(declared)) throw Error("length_mismatch");
  const bytes=new Uint8Array(size);let pos=0;
  for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.byteLength;}
  return new TextDecoder("utf-8",{fatal:true}).decode(bytes);
}

// Non-authorizing diagnostics: only report trusted-root match and safe error
// categories. Never echo the untrusted JWS header, certificates or account data.
async function rootCategory(signedPayload: string): Promise<string> {
  try {
    const header=JSON.parse(atob(signedPayload.split(".")[0].replace(/-/g,"+").replace(/_/g,"/")));
    const chain=header?.x5c;
    if(!Array.isArray(chain) || chain.length!==3 || typeof chain[2]!=="string" ||
      chain[2].length>12000 || !/^[A-Za-z0-9+/=]+$/.test(chain[2])) return "chain_invalid";
    const der=Uint8Array.from(atob(chain[2]),c=>c.charCodeAt(0));
    const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",der));
    const hash=Array.from(digest,b=>b.toString(16).padStart(2,"0")).join("");
    if(hash==="c2b9b042dd57830e7d117dac55ac8ae19407d38e41d88f3215bc3a890444a050")return "g2";
    if(hash==="63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179")return "g3";
    return "unrecognized";
  }catch{return "unreadable";}
}
Deno.serve(async (request: Request) => {
  if(request.method!=="POST") return response({error:"method_not_allowed"},405);
  const endpoint=Deno.env.get("SUPABASE_URL");
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const configuredAppId=Deno.env.get("APPLE_IAP_APP_APPLE_ID");
  if(!endpoint||!service||(configuredAppId && configuredAppId!==String(appId)))
    return response({error:"unavailable"},503);
  let signedPayload: string;
  try {
    const parsed=JSON.parse(await readBounded(request));
    if(!parsed || typeof parsed!=="object" || Array.isArray(parsed) ||
      typeof parsed.signedPayload!=="string" || parsed.signedPayload.length>44000 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(parsed.signedPayload))
      return response({error:"invalid_notification"},400);
    signedPayload=parsed.signedPayload;
  } catch {return response({error:"invalid_notification"},400);}
  try {
    const root = Buffer.from(APPLE_G3_ROOT_DER_BASE64, "base64");
    const g2Root = Buffer.from(APPLE_G2_ROOT_DER_BASE64, "base64");
    const roots=[g2Root,root];
    const verifier=new SignedDataVerifier(roots,true,Environment.PRODUCTION,bundleId,appId);
    let notification;
    try {
      notification=await verifier.verifyAndDecodeNotification(signedPayload);
    } catch (error) {
      // A temporary Apple OCSP/certificate-service outage must be retried.
      // Never treat it as proof that the signed notification is invalid.
      if(error instanceof VerificationException &&
         error.status===VerificationStatus.RETRYABLE_VERIFICATION_FAILURE)
        return response({error:"notification_verification_temporarily_unavailable"},503);
      // Apple can forward Sandbox notifications to the Production URL if no
      // separate Sandbox URL is configured. Authenticate Sandbox signatures
      // independently; never let test notifications touch a Production wallet.
      const sandboxVerifier=new SignedDataVerifier(roots,true,Environment.SANDBOX,bundleId);
      try {
        const sandboxNotification = await sandboxVerifier.verifyAndDecodeNotification(signedPayload);
        if (sandboxNotification.notificationType === "TEST") {
          console.info("Apple Sandbox TEST signature verified");
        }
        return response({ok:true,ignored_sandbox:true});
      } catch (sandboxError) {
        if(sandboxError instanceof VerificationException &&
           sandboxError.status===VerificationStatus.RETRYABLE_VERIFICATION_FAILURE)
          return response({error:"notification_verification_temporarily_unavailable"},503);
        // Log only verification failure categories, never JWS, certificates,
        // transaction data, user identifiers or notification contents.
        const code = (e: unknown) => {
          if (!(e instanceof VerificationException)) return "exception";
          const cause = e.cause;
          if (cause instanceof Error) {
            if (cause.message.includes("not implemented")) return "runtime_unsupported";
            if (cause.name === "JsonWebTokenError") return "jwt_rejected";
            if (cause.name === "FetchError") return "ocsp_fetch_error";
            if (cause.name === "TypeError") return "verifier_type_error";
          }
          return VerificationStatus[e.status] ?? "verification_failed";
        };
        console.warn("Apple notification verification categories", code(error), code(sandboxError), "root", await rootCategory(signedPayload));
        return response({error:"notification_verification_failed"},422);
      }
    }
    // A signed CONSUMPTION_REQUEST is only a refund request, not a confirmed
    // refund. REFUND_DECLINED is also never authorization to revoke coins.
    if(notification.notificationType!=="REFUND") return response({ok:true,ignored:true});
    const data=notification.data;
    if(!data || data.bundleId!==bundleId ||
       data.environment!=="Production" || data.appAppleId!==appId ||
       typeof data.signedTransactionInfo!=="string")
      return response({error:"invalid_app_notification"},422);
    const purchase=await verifier.verifyAndDecodeTransaction(data.signedTransactionInfo);
    // A signed refund does not authorize another product, app, family owner,
    // Sandbox transaction or account. Revocation must have a signed date.
    if(purchase.bundleId!==bundleId || purchase.environment!=="Production" ||
       purchase.productId!=="mushiverse.coins.100" ||
       purchase.type!=="Consumable" || purchase.quantity!==1 ||
       purchase.inAppOwnershipType!=="PURCHASED" ||
       typeof purchase.transactionId!=="string" || !txId.test(purchase.transactionId) ||
       purchase.originalTransactionId!==purchase.transactionId ||
       typeof purchase.appAccountToken!=="string" ||
       !accountId.test(purchase.appAccountToken) ||
       typeof purchase.purchaseDate!=="number" || !Number.isSafeInteger(purchase.purchaseDate) ||
       typeof purchase.revocationDate!=="number" || !Number.isSafeInteger(purchase.revocationDate) ||
       purchase.revocationDate < purchase.purchaseDate ||
       purchase.revocationDate > Date.now()+300000)
      return response({error:"invalid_refunded_transaction"},422);
    const admin=createClient(endpoint,service);
    const {data:credits,error:creditError}=await admin.from("gacha_coin_purchase_credits")
      .select("user_id,product_id,coins").eq("transaction_id",purchase.transactionId).limit(2);
    if(creditError) return response({error:"unavailable"},503);
    // A valid Apple refund may arrive before a credit. Retry rather than
    // erroneously acknowledging it as reconciled. Never invent an account.
    if(!credits || credits.length!==1) return response({error:"credit_not_found"},503);
    const credit=credits[0];
    if(credit.user_id.toLowerCase()!==purchase.appAccountToken.toLowerCase() ||
       credit.product_id!==purchase.productId || credit.coins!==100)
      return response({error:"refund_owner_mismatch"},422);
    const {data:held,error:holdError}=await admin.rpc("record_apple_refund_after_verified_jws",{
      p_transaction_id:purchase.transactionId,
      p_user_id:credit.user_id,
      p_revocation_date:new Date(purchase.revocationDate).toISOString(),
    });
    if(holdError||held!==true) {
      console.warn("Apple refund quarantine: atomic hold unavailable");
      return response({error:"refund_hold_unavailable"},503);
    }
    return response({ok:true,refund_quarantined:true});
  } catch (error) {
    // Retry transient Apple verifier failures, including nested signed
    // transactions, without acknowledging or modifying a wallet.
    if(error instanceof VerificationException &&
       error.status===VerificationStatus.RETRYABLE_VERIFICATION_FAILURE)
      return response({error:"notification_verification_temporarily_unavailable"},503);
    // Never log raw signed payloads, user IDs, certificate data or exceptions.
    console.warn("Apple notification signature or data rejected");
    return response({error:"notification_verification_failed"},422);
  }
});
