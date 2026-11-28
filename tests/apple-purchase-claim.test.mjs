import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appleCoinPacks,isAppleCoinProduct} from '../supabase/functions/_shared/apple-coin-transaction-policy.mjs';

// Execute the deployed Deno handler in an isolated Node harness with a fake
// Supabase client. This checks request behavior without a real Apple purchase,
// database writes, or a network dependency.
const file = 'supabase/functions/submit-apple-purchase-claim/index.ts';
function createHarness({productionEnabled=false,gateOverrides={},verifierConfigured=true,appAppleId=undefined}={}) {
  const source = readFileSync(file, 'utf8')
    .replace(/^import .*;\s*$/gm, '')
    .replace('const json=(b:any,s=200)', 'const json=(b,s=200)')
    .replace('let body:Record<string,unknown>;', 'let body;')
    .replace('const chunks:Uint8Array[]=[];', 'const chunks=[];')
    .replace('let rawBody:string;', 'let rawBody;')
    .replaceAll('(row:any)', '(row)')
    .replaceAll(' as keyof typeof appleCoinPacks', '')
    .replace('productId: string', 'productId')
    .replace(/Deno\.env\.get\(("SUPABASE_(?:URL|ANON_KEY|SERVICE_ROLE_KEY)")\)!/g, 'Deno.env.get($1)');
  let handler;
  const rows = [];
  let currentUser = 'user-a';
  let accountFlags = {};
  let insertRace = null;
  const queryFor = (options={},table='apple_purchase_claims') => {
    const filters = [];
    const q = {
      eq(k,v) { filters.push(r => r[k]===v); return q; },
      // Match Supabase's negative-equality filter when checking transaction ownership.
      // The production claim handler uses .neq() for cross-account/product guards.
      neq(k,v) { filters.push(r => r[k]!==v); return q; },
      not(k, operator, values) {
        assert.equal(operator, 'in');
        const allowed = JSON.parse('[' + values.slice(1, -1) + ']');
        filters.push(r => !allowed.includes(r[k]));
        return q;
      },
      limit(n) { return Promise.resolve({data: rows.filter(r=>filters.every(f=>f(r))).slice(0,n),error:null}); },
      single() {
        const data={
          billing_settings:{billing_mode:productionEnabled?'live':'off',checkout_enabled:productionEnabled,ios_iap_ready:productionEnabled},
          apple_iap_verification_gate:{server_jws_verified:productionEnabled,sandbox_purchase_proven:productionEnabled},
          apple_coin_pack_catalog:{coins:100,is_sale_enabled:productionEnabled},
        }[table];
        const effective=data ? {...data,...(gateOverrides[table]??{})} : null;
        return Promise.resolve({data:effective,error:effective?null:{code:'NOT_FOUND'}});
      },
      gte(k,v) {
        const count=rows.filter(r=>filters.every(f=>f(r)) && r[k]>=v).length;
        return Promise.resolve({count,error:null});
      }
    };
    return q;
  };
  const client = {
    rpc:async name=>{
      assert.equal(name,"get_apple_production_verifier_secret");
      return {data:verifierConfigured?"1".repeat(64):null,error:null};
    },
    auth:{getUser:async()=>({data:{user:{id:currentUser,app_metadata:accountFlags}},error:null})},
    from:(table)=>({
      select:(_fields,options)=>queryFor(options,table),
      insert:row=>({
        select:()=>({
          single:async()=>{
            if(insertRace) {
              const winner = insertRace(row);
              insertRace = null;
              if(winner) rows.push({...row, ...winner, id:rows.length+1,created_at:new Date().toISOString()});
            }
            if(rows.some(x=>x.transaction_id===row.transaction_id))
              return {data:null,error:{code:'23505'}};
            const data={...row,id:rows.length+1,created_at:new Date().toISOString()};
            rows.push(data);
            return {data,error:null};
          }
        })
      })
    })
  };
  const deno = {
    env:{get:key=>key==='APPLE_IAP_APP_APPLE_ID'?appAppleId:'test-value'},
    serve:fn=>{handler=fn;}
  };
  new Function('Deno','createClient','Response','isAppleCoinProduct','appleCoinPacks',source)(deno,()=>client,Response,isAppleCoinProduct,appleCoinPacks);
  assert.equal(typeof handler,'function','Deno.serve handler not registered');
  async function send(body,raw=false,bearer='Bearer test') {
    const req=new Request('https://example.invalid/claim',{
      method:'POST',
      headers:bearer?{Authorization:bearer}:{},
      body:raw?body:JSON.stringify(body)
    });
    const res=await handler(req);
    return {status:res.status,data:await res.json()};
  }
  return {send,rows,setUser:id=>{currentUser=id},setFlags:flags=>{accountFlags=flags},setInsertRace:fn=>{insertRace=fn}};
}
const coin=(id,product='mushiverse.coins.100',original=id)=>({
  transaction_id:id,original_transaction_id:original,product_id:product,
  environment:'Sandbox'
});
test('purchase availability is read-only and respects every production gate',async()=>{
  const request={action:'production_availability',product_id:'mushiverse.coins.100'};
  const closed=createHarness();
  assert.equal((await closed.send(request)).status,503);
  const open=createHarness({productionEnabled:true});
  assert.deepEqual(await open.send(request),{status:200,data:{ok:true,available:true,product_id:request.product_id,coins:100}});
  assert.equal((await open.send(request,false,'')).status,401);
  assert.equal((await open.send({...request,product_id:'unknown'})).status,403);
  assert.equal((await open.send({...request,transaction_id:'123456789'})).status,400);
  open.setFlags({minor:true});
  assert.equal((await open.send(request)).status,403);
  assert.equal(open.rows.length,0);
  assert.equal(closed.rows.length,0);
  for(const options of [{verifierConfigured:false},{appAppleId:"123"}]) {
    const unavailable=createHarness({productionEnabled:true,...options});
    assert.deepEqual(await unavailable.send(request),{status:503,data:{error:"apple_verification_temporarily_unavailable"}});
    assert.equal(unavailable.rows.length,0);
  }
});
test('accepts an allowlisted coin claim as pending, not as a granted reward',async()=>{
  const h=createHarness();
  const r=await h.send(coin('123456789'));
  assert.equal(r.status,200);
  assert.equal(r.data.status,'pending');
  assert.equal(h.rows.length,1);
  assert.equal(Object.hasOwn(r.data,'coins'),false);
});
test('replay preserves verified status and does not insert a second claim',async()=>{
  const h=createHarness();
  await h.send(coin('123456789'));
  h.rows[0].status='verified';
  const r=await h.send(coin('123456789'));
  assert.equal(r.status,200);
  assert.equal(r.data.status,'verified');
  assert.equal(h.rows.length,1);
});
test('the same transaction ID cannot be claimed by another account or product',async()=>{
  const h=createHarness();
  await h.send(coin('123456789'));
  h.setUser('user-b');
  assert.equal((await h.send(coin('123456789'))).status,409);
  h.setUser('user-a');
  assert.equal((await h.send(coin('123456789','mushiverse.coins.500'))).status,409);
  assert.equal(h.rows.length,1);
});
test('a subscription original transaction cannot be reused by another account',async()=>{
  const h=createHarness();
  const premium=id=>coin(id,'jp.mushiverse.premium.monthly','888888888');
  assert.equal((await h.send(premium('123456789'))).status,200);
  h.setUser('user-b');
  assert.equal((await h.send(premium('223456789'))).status,409);
});
test('rejects local StoreKit claims without storing pending purchases',async()=>{
  const h=createHarness();
  const r=await h.send({...coin('123456789'),environment:'storekit'});
  assert.equal(r.status,400);
  assert.equal(r.data.error,'unsupported_environment');
  assert.equal(h.rows.length,0);
});
test('Production claims remain disabled while the independent server gates are closed',async()=>{
  const h=createHarness();
  const r=await h.send({...coin('123456789'),environment:'Production'});
  assert.equal(r.status,503);
  assert.equal(r.data.error,'production_fulfillment_disabled');
  assert.equal(h.rows.length,0);
});
test('Production claims are staged but never credited only when all gates are enabled',async()=>{
  const h=createHarness({productionEnabled:true});
  const r=await h.send({...coin('123456789'),environment:'Production'});
  assert.equal(r.status,200);
  assert.equal(r.data.status,'pending');
  assert.equal(h.rows.length,1);
  assert.equal(h.rows[0].environment,null);
  assert.equal(Object.hasOwn(r.data,'coins'),false);
});
test('Production claims stay closed if any one independent release gate is disabled',async()=>{
  const failures=[
    ['billing_settings',{billing_mode:'off'}],
    ['billing_settings',{checkout_enabled:false}],
    ['billing_settings',{ios_iap_ready:false}],
    ['apple_iap_verification_gate',{server_jws_verified:false}],
    ['apple_iap_verification_gate',{sandbox_purchase_proven:false}],
    ['apple_coin_pack_catalog',{is_sale_enabled:false}],
    ['apple_coin_pack_catalog',{coins:500}],
  ];
  for(const [table,override] of failures){
    const h=createHarness({productionEnabled:true,gateOverrides:{[table]:override}});
    const result=await h.send({...coin('123456789'),environment:'Production'});
    assert.equal(result.status,503,table+' '+JSON.stringify(override));
    assert.equal(result.data.error,'production_fulfillment_disabled');
    assert.equal(h.rows.length,0);
  }
});
test('Production claims reject unapproved packs even if server gates are open',async()=>{
  const h=createHarness({productionEnabled:true,gateOverrides:{
    apple_coin_pack_catalog:{is_sale_enabled:false,coins:500},
  }});
  const r=await h.send({...coin('123456789','mushiverse.coins.500'),environment:'Production'});
  assert.equal(r.status,503);
  assert.equal(r.data.error,'production_fulfillment_disabled');
  assert.equal(h.rows.length,0);
});
test('disallows unknown products and malformed transaction IDs',async()=>{
  const h=createHarness();
  assert.equal((await h.send(coin('123456789','mushiverse.coins.999'))).status,400);
  assert.equal((await h.send(coin('abc'))).status,400);
  assert.equal((await h.send({...coin('123456789'),original_transaction_id:'broken'})).status,400);
  assert.equal(h.rows.length,0);
});
test('limits new claims to 30 per hour without restricting idempotent retries',async()=>{
  const h=createHarness();
  for(let i=0;i<30;i++)assert.equal((await h.send(coin(String(100000000+i)))).status,200);
  assert.equal((await h.send(coin('999999999'))).status,429);
  assert.equal((await h.send(coin('100000000'))).status,200);
  assert.equal(h.rows.length,30);
});
test('rejects oversized and non-JSON requests',async()=>{
  const h=createHarness();
  assert.equal((await h.send('{invalid',true)).status,400);
  assert.equal((await h.send('x'.repeat(4200),true)).status,413);
});

test('simultaneous duplicate insert is idempotent for the same user and product',async()=>{
  const h=createHarness();
  h.setInsertRace(()=>({user_id:'user-a',product_id:'mushiverse.coins.100',status:'verified'}));
  const r=await h.send(coin('567891234'));
  assert.equal(r.status,200);
  assert.equal(r.data.status,'verified');
  assert.equal(h.rows.length,1);
});
test('simultaneous insert by another account or product stays a conflict',async()=>{
  for(const winner of [
    {user_id:'user-b',product_id:'mushiverse.coins.100'},
    {user_id:'user-a',product_id:'mushiverse.coins.500'}
  ]){
    const h=createHarness();
    h.setInsertRace(()=>winner);
    const r=await h.send(coin('567891235'));
    assert.equal(r.status,409);
    assert.equal(h.rows.length,1);
  }
});

test('claim endpoint rejects missing and malformed bearer authorization',async()=>{
  const h=createHarness();
  for(const authorization of ['', 'invalid', 'Bearer', 'Basic abc']) {
    const response=await h.send(coin('987654321'),false,authorization);
    assert.equal(response.status,401,authorization);
  }
  assert.equal(h.rows.length,0);
});

for(const flag of ['kid_mode','minor','iap_disabled']) {
  test('restricted account flag '+flag+' blocks new Apple claims',async()=>{
    const h=createHarness();
    h.setFlags({[flag]:true});
    const r=await h.send(coin('123456789'));
    assert.equal(r.status,403);
    assert.equal(r.data.error,'purchases_restricted');
    assert.equal(h.rows.length,0);
  });
}

test('staged Production packs require the exact catalog amount and an enabled sale', async()=>{
  for (const coins of [300, 2500, 5500, 12000]) {
    const product = 'mushiverse.coins.' + coins;
    const h = createHarness({productionEnabled:true,gateOverrides:{
      apple_coin_pack_catalog:{is_sale_enabled:true,coins},
    }});
    const result = await h.send({...coin('123456789',product),environment:'Production'});
    assert.equal(result.status,200,product);
    assert.equal(h.rows[0].product_id,product);
  }
});
