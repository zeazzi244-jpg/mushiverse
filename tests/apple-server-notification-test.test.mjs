import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {tokenForApple,requestAndCheckAppleTest,parseApplePrivateKey} from '../scripts/check-apple-server-notification.mjs';
const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const key=privateKey.export({type:'pkcs8',format:'pem'});
const input={keyId:'ABC123DEF9',issuerId:'123e4567-e89b-42d3-a456-426614174000',privateKey:key,now:1795319999};
test('Apple API token is correctly signed ES256 for this app and expires after 5 minutes',()=>{
  const jwt=tokenForApple(input);const [header,payload,sig]=jwt.split('.');
  assert.equal(JSON.parse(Buffer.from(header,'base64url')).alg,'ES256');
  const claims=JSON.parse(Buffer.from(payload,'base64url'));
  assert.equal(claims.bid,'com.rikuto.mushiverse');
  assert.equal(claims.aud,'appstoreconnect-v1');
  assert.equal(claims.exp-claims.iat,300);
  assert.ok(verify('sha256',Buffer.from(`${header}.${payload}`),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(sig,'base64url')));
});
test('rejects invalid key metadata and unsupported environments',async()=>{
  assert.throws(()=>tokenForApple({...input,keyId:'bad'}),/invalid_apple_iap_key_id_format/);
  await assert.rejects(()=>requestAndCheckAppleTest({environment:'StoreKit',authorization:'Bearer a.b.c'}),/invalid_apple_test_configuration/);
});
test('TEST request and status check target Apple sandbox without leaking the JWS or token',async()=>{
  const calls=[];
  const fetchImpl=async(url,opts)=>{
    calls.push({url,method:opts.method});
    return opts.method==='POST'
      ? {status:200,json:async()=>({testNotificationToken:'abcdef0123456789-abcdef'})}
      : {status:200,json:async()=>({sendAttempts:[{sendAttemptResult:'SUCCESS',signedPayload:'PRIVATE'}]})};
  };
  const result=await requestAndCheckAppleTest({environment:'Sandbox',authorization:'Bearer a.b.c',fetchImpl});
  assert.deepEqual(result,{environment:'Sandbox',attempts:1,results:['SUCCESS'],success:true});
  assert.equal(calls[0].url,'https://api.storekit-sandbox.apple.com/inApps/v1/notifications/test');
  assert.equal(calls[1].method,'GET');
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
test('unsuccessful Apple delivery cannot be treated as success',async()=>{
  const fetchImpl=async(_url,opts)=>opts.method==='POST'
    ? {status:200,json:async()=>({testNotificationToken:'abcdef0123456789-abcdef'})}
    : {status:200,json:async()=>({sendAttempts:[{sendAttemptResult:'TIMED_OUT'}]})};
  const result=await requestAndCheckAppleTest({environment:'Production',authorization:'Bearer a.b.c',fetchImpl});
  assert.equal(result.success,false);
});
test('API rejection does not pass the notification check',async()=>{
  await assert.rejects(()=>requestAndCheckAppleTest({environment:'Sandbox',authorization:'Bearer a.b.c',fetchImpl:async()=>({status:401})}),/apple_test_request_http_401/);
});

test('accepts original PEM, Base64 file, twice-encoded Base64 and DER',()=>{
  const pem=key;
  const b64=Buffer.from(pem).toString('base64');
  const twice=Buffer.from(b64).toString('base64');
  const der=privateKey.export({format:'der',type:'pkcs8'});
  for(const secret of [{rawKey:pem},{keyBase64:b64},{keyBase64:twice},{keyBase64:der.toString('base64')}]) {
    const parsed=parseApplePrivateKey(secret);
    assert.equal(parsed.asymmetricKeyType,'ec');
    assert.equal(parsed.asymmetricKeyDetails.namedCurve,'prime256v1');
  }
});
test('rejects filenames and other non-key secrets safely',()=>{
  for(const secret of [{rawKey:'SubscriptionKey_NWG44787M7.p8'},{keyBase64:Buffer.from('fake text').toString('base64')}]){
    assert.throws(()=>parseApplePrivateKey(secret),/apple_iap_secret_not_valid_es256_private_key/);
  }
});
