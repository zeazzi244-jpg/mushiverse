import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../supabase/functions/apple-refund-notifications/index.ts',import.meta.url),'utf8')
 .replace(/^import .*;\s*$/gm,'')
 .replace('(body: Record<string, unknown>, status','(body, status')
 .replace('async function readBounded(request: Request): Promise<string>','async function readBounded(request)')
 .replace('const chunks: Uint8Array[]=[]','const chunks=[]')
 .replace('Deno.serve(async (request: Request)','Deno.serve(async (request)')
 .replace('let signedPayload: string;','let signedPayload;');

function harness({type='REFUND',verified=true,creditOwner='123e4567-e89b-42d3-a456-426614174000',
  product='mushiverse.coins.100',environment='Production',held=true,revocationDate=Date.now()-10000}={}){
  const calls={verify:0,verifyTransaction:0,credits:0,holds:0};
  let handler;
  const purchase={bundleId:'com.rikuto.mushiverse',environment,productId:product,
    type:'Consumable',quantity:1,inAppOwnershipType:'PURCHASED',
    transactionId:'123456789',originalTransactionId:'123456789',
    appAccountToken:'123e4567-e89b-42d3-a456-426614174000',
    purchaseDate:1730000000000,revocationDate};
  class SignedDataVerifier{
    async verifyAndDecodeNotification(){
      calls.verify++;
      if(!verified)throw Error('signature_invalid');
      return {notificationType:type,data:{
        bundleId:'com.rikuto.mushiverse',environment:'Production',
        appAppleId:6826061606,signedTransactionInfo:'aaa.bbb.ccc'
      }};
    }
    async verifyAndDecodeTransaction(){calls.verifyTransaction++;return purchase;}
  }
  const createClient=()=>({
    from:(table)=>{
      assert.equal(table,'gacha_coin_purchase_credits');
      return {select:()=>({eq:()=>({limit:async()=>{
        calls.credits++;return {data:[{user_id:creditOwner,product_id:'mushiverse.coins.100',coins:100}],error:null};
      }})})};
    },
    rpc:async(name,args)=>{
      assert.equal(name,'record_apple_refund_after_verified_jws');
      assert.equal(args.p_transaction_id,purchase.transactionId);
      assert.equal(args.p_user_id,creditOwner);
      calls.holds++;return {data:held,error:null};
    }
  });
  const Deno={env:{get(key){return ({
    SUPABASE_URL:'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY:'test-secret',
  })[key];}},serve(fn){handler=fn;}};
  const Environment={PRODUCTION:'Production'};
  new Function('Deno','createClient','SignedDataVerifier','Environment',
    'APPLE_G3_ROOT_DER_BASE64','Response','atob',source)(
      Deno,createClient,SignedDataVerifier,Environment,'aGk=',Response,atob
    );
  const send=async(signedPayload='aaa.bbb.ccc')=>{
    const result=await handler(new Request('https://example.invalid/apple-refund',{method:'POST',
      body:JSON.stringify({signedPayload}),headers:{'content-type':'application/json'}}));
    return {status:result.status,body:await result.json()};
  };
  return {send,calls};
}

test('refund notification rejects malformed payload before any Apple or database calls',async()=>{
  const h=harness();
  const r=await h.send('not-jws');
  assert.equal(r.status,400);
  assert.equal(h.calls.verify,0);
  assert.equal(h.calls.holds,0);
});

test('unverified Apple notification can never alter refund holds',async()=>{
  const h=harness({verified:false});
  assert.equal((await h.send()).status,422);
  assert.equal(h.calls.verify,1);
  assert.equal(h.calls.credits,0);
  assert.equal(h.calls.holds,0);
});

test('a refund request or declined refund does not revoke paid credits',async()=>{
  for(const type of ['CONSUMPTION_REQUEST','REFUND_DECLINED']){
    const h=harness({type});
    const r=await h.send();
    assert.equal(r.status,200);
    assert.equal(r.body.ignored,true);
    assert.equal(h.calls.verifyTransaction,0);
    assert.equal(h.calls.holds,0);
  }
});

test('Apple-signed matching refund records a server-only quarantine',async()=>{
  const h=harness();
  const r=await h.send();
  assert.equal(r.status,200);
  assert.equal(r.body.refund_quarantined,true);
  assert.equal(h.calls.verifyTransaction,1);
  assert.equal(h.calls.credits,1);
  assert.equal(h.calls.holds,1);
});

test('a verified refund for a different wallet owner never enters the refund RPC',async()=>{
  const h=harness({creditOwner:'123e4567-e89b-42d3-a456-426614174001'});
  assert.equal((await h.send()).status,422);
  assert.equal(h.calls.holds,0);
});

test('a Sandbox or different-product signed transaction cannot quarantine Production coins',async()=>{
  for(const opts of [{environment:'Sandbox'},{product:'other.product'}]){
    const h=harness(opts);
    assert.equal((await h.send()).status,422);
    assert.equal(h.calls.credits,0);
    assert.equal(h.calls.holds,0);
  }
});

test('refund RPC rejection remains retryable and never claims the hold succeeded',async()=>{
  const h=harness({held:false});
  const r=await h.send();
  assert.equal(r.status,503);
  assert.equal(r.body.error,'refund_hold_unavailable');
});
