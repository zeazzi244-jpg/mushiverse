import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Exercise the checked-in fail-closed endpoint, not a mocked replacement response.
// Before a trusted Apple JWS verifier is deployed, requests MUST NOT credit coins.
function harness({user = {id:'user-a'}, configured = true} = {}) {
  const source = readFileSync('supabase/functions/credit-apple-gacha-coins/index.ts','utf8')
    .replace(/^import .*;\s*$/gm,'')
    .replace('data: Record<string, unknown>, status: number','data, status')
    .replace('request: Request','request');
  let handler;
  const calls = {client:0, rpc:0, getUser:0};
  const deno = {
    env:{get:()=>configured?'configured-value':undefined},
    serve:fn=>{handler=fn}
  };
  const client = {
    auth:{getUser:async()=>{calls.getUser++; return {data:{user},error:null}}},
    rpc:()=>{calls.rpc++; throw new Error('Coin credit RPC must never run before verification')}
  };
  const createClient = ()=>{calls.client++; return client};
  new Function('Deno','createClient','Response',source)(deno,createClient,Response);
  assert.equal(typeof handler,'function');
  const send = async (method='POST', bearer='Bearer valid-token')=>{
    const headers = bearer?{Authorization:bearer}:undefined;
    const response = await handler(new Request('https://example.invalid/credit',{
      method,headers,
      ...(method==='POST'?{body:JSON.stringify({signed_transaction:'fake-jws'})}:{})
    }));
    return {status:response.status,body:await response.json(),headers:response.headers};
  };
  return {send,calls};
}

test('credit endpoint rejects unauthenticated requests without touching a wallet',async()=>{
  const h=harness();
  const result=await h.send('POST','');
  assert.equal(result.status,401);
  assert.equal(result.body.error,'unauthorized');
  assert.equal(h.calls.rpc,0);
  assert.equal(h.calls.getUser,0);
});

test('credit endpoint rejects invalid methods without touching a wallet',async()=>{
  const h=harness();
  const result=await h.send('GET');
  assert.equal(result.status,405);
  assert.equal(h.calls.rpc,0);
});

test('credit endpoint does not trust a signed-transaction string as proof of coins',async()=>{
  const h=harness();
  const result=await h.send();
  assert.equal(result.status,503);
  assert.equal(result.body.error,'apple_verification_not_configured');
  assert.equal(result.body.credited_or_previously_credited,false);
  assert.equal(result.headers.get('cache-control'),'no-store');
  assert.equal(h.calls.rpc,0);
});

test('credit endpoint rejects unauthenticated sessions and missing backend configuration',async()=>{
  const badSession=harness({user:null});
  assert.equal((await badSession.send()).status,401);
  assert.equal(badSession.calls.rpc,0);
  const noConfig=harness({configured:false});
  assert.equal((await noConfig.send()).status,503);
  assert.equal(noConfig.calls.rpc,0);
});
