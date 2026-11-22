#!/usr/bin/env node
// Apple TEST notifications only: no purchases, credits, refunds or release changes.
import { createPrivateKey, sign } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const BID = 'com.rikuto.mushiverse';
const HOSTS = Object.freeze({
  Sandbox: 'https://api.storekit-sandbox.apple.com',
  Production: 'https://api.storekit.apple.com',
});
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
export function tokenForApple({keyId, issuerId, privateKey, now = Math.floor(Date.now() / 1000)}) {
  keyId = typeof keyId === 'string' ? keyId.trim() : '';
  issuerId = typeof issuerId === 'string' ? issuerId.trim() : '';
  // iPhone copy/paste may include the secret name before the UUID.
  // Normalize only that exact known two-line label, never arbitrary text.
  issuerId = issuerId.replace(/^APPLE_IAP_ISSUER_ID\s*[:=]?\s*/i, '');
  if (!/^[A-Za-z0-9]{6,32}$/.test(keyId))
    throw Error('invalid_apple_iap_key_id_format');
  const issuerUuids = issuerId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || [];
  // Allow an iPhone clipboard to include a field label or surrounding text,
  // but only when exactly one well-formed issuer UUID can be identified.
  if (issuerUuids.length !== 1 || issuerId.length > 500)
    throw Error('invalid_apple_iap_issuer_id_format');
  issuerId = issuerUuids[0];
  // The .p8 must contain a PEM key, not its filename or the binary preview.
  // Support common GitHub secret pastes where line breaks were escaped.
  const normalized = typeof privateKey === 'string' ? privateKey.trim().replace(/\\n/g, '\n') : '';
  if (!/^-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----$/.test(normalized))
    throw Error('apple_iap_p8_secret_must_contain_full_pem_text');
  let key;
  try {
    key = createPrivateKey(normalized);
  } catch {
    throw Error('apple_iap_p8_secret_is_not_a_valid_private_key');
  }
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1')
    throw Error('apple_iap_key_must_be_es256');
  const signingInput = `${encode({alg:'ES256', kid:keyId, typ:'JWT'})}.${encode({iss:issuerId, iat:now, exp:now+300, aud:'appstoreconnect-v1', bid:BID})}`;
  const signature = sign('sha256', Buffer.from(signingInput), {key, dsaEncoding:'ieee-p1363'}).toString('base64url');
  return `${signingInput}.${signature}`;
}

export async function requestAndCheckAppleTest({environment, authorization, fetchImpl=fetch, sleep=ms=>new Promise(r=>setTimeout(r,ms)), maxAttempts=8}) {
  const host=HOSTS[environment];
  if (!host || !/^Bearer [A-Za-z0-9._-]+$/.test(authorization))
    throw Error('invalid_apple_test_configuration');
  const common={Authorization:authorization,Accept:'application/json'};
  const request=await fetchImpl(`${host}/inApps/v1/notifications/test`,{
    method:'POST',headers:{...common,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000),
  });
  if (request.status !== 200) throw Error(`apple_test_request_http_${request.status}`);
  const created=await request.json();
  const notificationToken=created?.testNotificationToken;
  if (typeof notificationToken!=='string'||!/^[A-Za-z0-9-]{16,150}$/.test(notificationToken))
    throw Error('invalid_apple_test_token');
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    if(attempt>1) await sleep(10000);
    const status=await fetchImpl(`${host}/inApps/v1/notifications/test/${encodeURIComponent(notificationToken)}`,{
      method:'GET',headers:common,signal:AbortSignal.timeout(20000),
    });
    if(status.status!==200) throw Error(`apple_test_status_http_${status.status}`);
    const body=await status.json();
    const attempts=body?.sendAttempts;
    if(!Array.isArray(attempts)) throw Error('invalid_apple_test_status');
    if(attempts.length>0){
      // Never echo signedPayload, transaction data, JWT or the notification token.
      const results=attempts.map(item=>item?.sendAttemptResult).filter(x=>typeof x==='string');
      return {environment,attempts:attempts.length,results,success:results.includes('SUCCESS')};
    }
  }
  throw Error('apple_test_delivery_status_not_ready');
}

async function main() {
  const environment=process.env.APPLE_IAP_TEST_ENVIRONMENT || 'Sandbox';
  if (!Object.hasOwn(HOSTS, environment)) throw Error('invalid_apple_test_environment');
  // A raw multiline .p8 secret is easier to configure from an iPhone.
  // Base64 remains supported for existing CI automation.
  const rawKey=process.env.APPLE_IAP_PRIVATE_KEY_P8;
  const keyBase64=process.env.APPLE_IAP_PRIVATE_KEY_P8_BASE64;
  if (!rawKey && (!keyBase64 || !/^[A-Za-z0-9+/=\s]+$/.test(keyBase64)))
    throw Error('missing_apple_iap_api_key_secret');
  // Prefer file-derived base64 when provided, so a stale malformed raw-paste secret cannot mask it.
  const privateKey=keyBase64 ? Buffer.from(keyBase64.replace(/\s/g,''),'base64').toString('utf8') : rawKey;
  const jwt=tokenForApple({keyId:process.env.APPLE_IAP_KEY_ID,issuerId:process.env.APPLE_IAP_ISSUER_ID,privateKey});
  const result=await requestAndCheckAppleTest({environment,authorization:`Bearer ${jwt}`});
  console.log(`Apple ${result.environment} TEST delivery attempts: ${result.attempts}; results: ${result.results.join(',')||'unknown'}`);
  if (!result.success) throw Error('apple_test_delivery_not_successful');
  console.log('Apple TEST delivery SUCCESS; verify receiving function logs separately.');
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{console.error(`Apple TEST check failed: ${error instanceof Error ? error.message.replace(/[^a-zA-Z0-9_-]/g,'_') : 'unknown'}`);process.exitCode=1;});
}
