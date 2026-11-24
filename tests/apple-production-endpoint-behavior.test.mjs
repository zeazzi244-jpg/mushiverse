import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appleCoinPacks, isAppleCoinProduct} from '../supabase/functions/_shared/apple-coin-transaction-policy.mjs';

const source = readFileSync(new URL('../supabase/functions/settle-apple-production-coins/index.ts',import.meta.url),'utf8')
  .replace(/^import .*;\s*$/gm,'')
  .replace('(body: Record<string, unknown>, status', '(body, status')
  .replace('request: Request, max', 'request, max')
  .replace('): Promise<Record<string, unknown>>', ')')
  .replace('const parts: Uint8Array[] = [];', 'const parts = [];')
  .replace('return payload as Record<string, unknown>', 'return payload')
  .replace('Deno.serve(async (request: Request)', 'Deno.serve(async (request)')
  .replace('let body: Record<string,unknown>;', 'let body;')
  .replace('claim.product_id as keyof typeof appleCoinPacks', 'claim.product_id')
  .replace('request.headers.get("authorization")!', 'request.headers.get("authorization")');

function harness({enabled=false,owner='user-1',validSignature=true,transientSignatureFailure=false,settled=true,claimStatus='pending',claimEnvironment=null,productID='mushiverse.coins.100',appMetadata={}}={}) {
  const calls={auth:0, verify:0, settle:0};
  let handler;
  const Deno={env:{get(key){
    return ({
      SUPABASE_URL:'https://test.supabase.co',
      SUPABASE_ANON_KEY:'anon',
      SUPABASE_SERVICE_ROLE_KEY:'service',
    })[key];
  }},serve(fn){handler=fn;}};
  const mockUser={auth:{getUser:async()=>{calls.auth++;return {data:{user:{id:'user-1',app_metadata:appMetadata}},error:null};}}};
  const tables={
    billing_settings: {billing_mode:enabled?'live':'off',checkout_enabled:enabled,ios_iap_ready:enabled},
    apple_iap_verification_gate: {server_jws_verified:enabled,sandbox_purchase_proven:enabled},
    apple_coin_pack_catalog: {coins:appleCoinPacks[productID],is_sale_enabled:enabled},
  };
  const admin={
    from(table) {
      return {
        select(){return {eq(){
          if(table==='apple_purchase_claims'){
            return {limit:async()=>({data:[{user_id:owner,transaction_id:'123456789',
              original_transaction_id:'123456789',product_id:productID,status:claimStatus,
              environment:claimEnvironment}],error:null})};
          }
          return {single:async()=>({data:tables[table],error:null})};
        }};}
      };
    },
    rpc:async(name,args)=>{
      if (name === 'get_apple_production_verifier_secret') return {data:'1'.repeat(64),error:null};
      calls.settle++;
      assert.equal(name,'settle_verified_apple_coin_production');
      assert.equal(args.p_transaction_id,'123456789');
      assert.equal(args.p_original_transaction_id,'123456789');
      assert.equal(args.p_user_id,'user-1');
      assert.equal(args.p_product_id,productID);
      assert.equal(args.p_purchase_date,'2024-10-27T03:33:20.000Z');
      return settled?{data:true,error:null}:{data:null,error:{code:'FAILED'}};
    }
  };
  const createClient=(_url,key)=>key==='anon'?mockUser:admin;
  const verifier=async(signed, expected, appID)=>{
    calls.verify++;
    assert.equal(signed,'abc.def.ghi');
    assert.equal(appID,6826061606);
    assert.deepEqual(expected,{environment:'Production',productId:productID,
      transactionId:'123456789',originalTransactionId:'123456789',appAccountToken:'user-1'});
    if(transientSignatureFailure) throw new VerificationException(VerificationStatus.RETRYABLE_VERIFICATION_FAILURE);
    if(!validSignature) throw Error('bad_signature');
    return {transactionId:'123456789',originalTransactionId:'123456789',productId:productID,coins:appleCoinPacks[productID],purchaseDate:1730000000000};
  };
  class VerificationException extends Error { constructor(status){ super('redacted'); this.status=status; } }
  const VerificationStatus = {RETRYABLE_VERIFICATION_FAILURE:'RETRYABLE_VERIFICATION_FAILURE'};
  new Function('Deno','createClient','verifyAppleProductionCoinJws','Response','appleCoinPacks','isAppleCoinProduct','VerificationException','VerificationStatus',source)(
    Deno,createClient,verifier,Response,appleCoinPacks,isAppleCoinProduct,VerificationException,VerificationStatus
  );
  assert.equal(typeof handler,'function');
  const send=async({bearer='Bearer token',method='POST',body={transaction_id:'123456789',signed_transaction:'abc.def.ghi'}}={})=>{
    const req=new Request('https://test.supabase.co/functions/v1/settle-apple-production-coins',{
      method,
      headers:{...(bearer?{authorization:bearer}:{}),'content-type':'application/json'},
      ...(method==='POST'?{body:JSON.stringify(body)}:{})
    });
    const res=await handler(req);
    return {status:res.status,body:await res.json()};
  };
  return {send,calls};
}

test('closed Production billing gates reject all fulfillment before Apple or DB credit',async()=>{
  const h=harness();
  const x=await h.send();
  assert.equal(x.status,503);
  assert.equal(x.body.error,'production_fulfillment_disabled');
  assert.equal(h.calls.verify,0);
  assert.equal(h.calls.settle,0);
});

test('unauthenticated requests cannot read or credit Apple purchases',async()=>{
  const h=harness({enabled:true});
  assert.equal((await h.send({bearer:''})).status,401);
  assert.equal(h.calls.auth,0);
  assert.equal(h.calls.verify,0);
  assert.equal(h.calls.settle,0);
});

test('cross-account claim is denied before Apple verification',async()=>{
  const h=harness({enabled:true,owner:'other'});
  assert.equal((await h.send()).status,403);
  assert.equal(h.calls.verify,0);
  assert.equal(h.calls.settle,0);
});

test('prior Sandbox claim cannot become a Production credit',async()=>{
  const h=harness({enabled:true,claimEnvironment:'Sandbox'});
  assert.equal((await h.send()).status,403);
  assert.equal(h.calls.verify,0);
  assert.equal(h.calls.settle,0);
});

test('invalid Apple signature cannot ever settle a wallet',async()=>{
  const h=harness({enabled:true,validSignature:false});
  const r=await h.send();
  assert.equal(r.status,422);
  assert.equal(h.calls.verify,1);
  assert.equal(h.calls.settle,0);
});

test('temporary Apple verifier outage is retryable and cannot credit coins',async()=>{
  const h=harness({enabled:true,transientSignatureFailure:true});
  const r=await h.send();
  assert.equal(r.status,503);
  assert.equal(r.body.error,'apple_verification_temporarily_unavailable');
  assert.equal(h.calls.verify,1);
  assert.equal(h.calls.settle,0);
});

test('a fully verified Production claim gets one atomic server acknowledgment',async()=>{
  const h=harness({enabled:true});
  const r=await h.send();
  assert.equal(r.status,200);
  assert.equal(r.body.verification,'production_signature_verified');
  assert.equal(r.body.credited_or_previously_credited,true);
  assert.equal(r.body.coins,100);
  assert.equal(h.calls.verify,1);
  assert.equal(h.calls.settle,1);
});

test('a DB settlement failure cannot be acknowledged as completed payment',async()=>{
  const h=harness({enabled:true,settled:false});
  const r=await h.send();
  assert.equal(r.status,503);
  assert.equal(r.body.error,'settlement_unavailable');
  assert.equal(h.calls.verify,1);
  assert.equal(h.calls.settle,1);
});

test('each approved pack is acknowledged for its exact verified denomination only when the gates are open',async()=>{
  for (const [productID,coins] of Object.entries(appleCoinPacks)) {
    const closed = harness({productID});
    assert.equal((await closed.send()).status,503);
    assert.equal(closed.calls.settle,0);
    const open = harness({productID,enabled:true});
    const result = await open.send();
    assert.equal(result.status,200,productID);
    assert.equal(result.body.coins,coins);
    assert.equal(open.calls.settle,1);
  }
});

for(const flag of ['kid_mode','minor','iap_disabled']) {
  test('server-managed '+flag+' prevents Production settlement before signature verification',async()=>{
    const h=harness({enabled:true,appMetadata:{[flag]:true}});
    const result=await h.send();
    assert.equal(result.status,403);
    assert.equal(result.body.error,'purchases_restricted');
    assert.equal(h.calls.verify,0);
    assert.equal(h.calls.settle,0);
  });
}
test('editable metadata cannot turn off a server-managed purchase restriction',async()=>{
  const h=harness({enabled:true,appMetadata:{minor:true}});
  assert.equal((await h.send()).status,403);
  assert.equal(h.calls.settle,0);
});
