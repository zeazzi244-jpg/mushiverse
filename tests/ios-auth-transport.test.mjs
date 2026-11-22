import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=index.indexOf('async function backendFetch(input,options={}){');
const end=index.indexOf('\nlet db;',start);
assert.ok(start>=0&&end>start,'transport function exists');
const source=index.slice(start,end);
const endpoint='https://example.supabase.co';

function harness({web,native,platform='ios'}){
  const nativeCalls=[];
  const webCalls=[];
  const sandbox={
    SUPABASE_URL:endpoint, Request, Response, AbortController, DOMException,
    setTimeout,clearTimeout,console:{warn(){}},
    fetch:async(input,options)=>{webCalls.push({input,options});return web(input,options)},
    globalThis:{Capacitor:{getPlatform:()=>platform,
      nativePromise:async(...args)=>{nativeCalls.push(args);return native(...args)}}}
  };
  const fn=vm.runInNewContext(source+';backendFetch',sandbox);
  return {fn,webCalls,nativeCalls};
}
const loginUrl=endpoint+'/auth/v1/token?grant_type=password';

test('successful iOS login uses WebKit and does not invoke native HTTP',async()=>{
  const h=harness({web:()=>new Response(JSON.stringify({access_token:'test'}),{status:200}),
    native:()=>{throw Error('native bridge must not run')}});
  const r=await h.fn(loginUrl,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({email:'example@example.org',password:'not-real'})});
  assert.equal(r.status,200);
  assert.equal((await r.json()).access_token,'test');
  assert.equal(h.webCalls.length,1);
  assert.equal(h.nativeCalls.length,0);
});

test('HTTP 400 incorrect credentials are returned without duplicate native request',async()=>{
  const h=harness({web:()=>new Response('{"msg":"Invalid login credentials"}',{status:400}),
    native:()=>{throw Error('must not call native')}});
  const r=await h.fn(loginUrl,{method:'POST',body:'{}'});
  assert.equal(r.status,400);
  assert.equal(h.nativeCalls.length,0);
});

test('iOS WebKit transport exception falls back to Capacitor native HTTP',async()=>{
  const h=harness({web:()=>{throw new TypeError('Load failed')},
    native:()=>({status:200,data:JSON.stringify({access_token:'native-ok'}),headers:{'content-type':'application/json'}})});
  const r=await h.fn(loginUrl,{method:'POST',headers:{'content-type':'application/json'},
    body:'{"email":"example@example.org","password":"not-real"}'});
  assert.equal((await r.json()).access_token,'native-ok');
  assert.equal(h.webCalls.length,1);
  assert.equal(h.nativeCalls.length,1);
  assert.equal(h.nativeCalls[0][0],'CapacitorHttp');
  assert.equal(h.nativeCalls[0][2].data.email,'example@example.org');
});

test('browser-only WebKit failure does not attempt native transport',async()=>{
  const h=harness({platform:'web',web:()=>{throw new TypeError('Load failed')},
    native:()=>{throw Error('must not call native')}});
  await assert.rejects(h.fn(loginUrl,{method:'POST',body:'{}'}),/Load failed/);
  assert.equal(h.nativeCalls.length,0);
});

test('caller cancellation never launches a new authentication request',async()=>{
  const controller=new AbortController();
  controller.abort();
  const h=harness({web:()=>{throw new DOMException('Aborted','AbortError')},
    native:()=>{throw Error('must not call native')}});
  await assert.rejects(h.fn(loginUrl,{method:'POST',body:'{}',signal:controller.signal}),/Aborted/);
  assert.equal(h.nativeCalls.length,0);
});
