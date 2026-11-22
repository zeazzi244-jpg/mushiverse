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
// GitHub secrets are write-only. Recover only documented encodings of the same
// EC private key, without logging, exporting or weakening signature validation.
export function parseApplePrivateKey({rawKey, keyBase64}) {
  const candidates = [];
  const seen = new Set();
  function offer(value, depth=0) {
    if (depth > 3 || value == null) return;
    const valueText = Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
    const normalized = valueText.trim().replace(/\\n/g, '\n');
    if (normalized.length > 16000 || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(value);
    // Some iOS Shortcuts output Base64 encoded text and then Base64-encode
    // the copied text again; decode conservatively, maximum three levels.
    if (/^[A-Za-z0-9+/_=-]+(?:\s+[A-Za-z0-9+/_=-]+)*$/.test(normalized) && normalized.length >= 40) {
      const compact = normalized.replace(/\s/g, '').replace(/-/g,'+').replace(/_/g,'/');
      if (compact.length % 4 !== 1) {
        const decoded = Buffer.from(compact, 'base64');
        if (decoded.length > 0 && decoded.length < 12000) offer(decoded, depth + 1);
      }
    }
    if (normalized.startsWith('"') && normalized.endsWith('"')) {
      try { offer(JSON.parse(normalized),depth+1); } catch {}
    }
  }
  offer(rawKey);
  offer(keyBase64);
  for (const candidate of candidates) {
    const data = Buffer.isBuffer(candidate) ? candidate : String(candidate).trim().replace(/\\n/g, '\n');
    for (const options of [{key:data}, {key:Buffer.isBuffer(data)?data:Buffer.from(data),format:'der',type:'pkcs8'}]) {
      try {
        const key = createPrivateKey(options);
        if (key.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails?.namedCurve === 'prime256v1')
          return key;
      } catch {}
    }
  }
  throw Error('apple_iap_secret_not_valid_es256_private_key');
}
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
  const key = parseApplePrivateKey({rawKey: privateKey});
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
  const rawKey=process.env.APPLE_IAP_PRIVATE_KEY_P8;
  const keyBase64=process.env.APPLE_IAP_PRIVATE_KEY_P8_BASE64;
  const key=parseApplePrivateKey({rawKey,keyBase64});
  const jwt=tokenForApple({keyId:process.env.APPLE_IAP_KEY_ID,issuerId:process.env.APPLE_IAP_ISSUER_ID,privateKey:key.export({format:'pem',type:'pkcs8'})});
  const result=await requestAndCheckAppleTest({environment,authorization:`Bearer ${jwt}`});
  console.log(`Apple ${result.environment} TEST delivery attempts: ${result.attempts}; results: ${result.results.join(',')||'unknown'}`);
  if (!result.success) throw Error('apple_test_delivery_not_successful');
  console.log('Apple TEST delivery SUCCESS; verify receiving function logs separately.');
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{console.error(`Apple TEST check failed: ${error instanceof Error ? error.message.replace(/[^a-zA-Z0-9_-]/g,'_') : 'unknown'}`);process.exitCode=1;});
}
