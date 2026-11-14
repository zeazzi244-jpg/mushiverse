import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Execute the deployed Deno handler in an isolated Node harness with a fake
// Supabase client. This checks request behavior without a real Apple purchase,
// database writes, or a network dependency.
const file = 'supabase/functions/submit-apple-purchase-claim/index.ts';
function createHarness() {
  const source = readFileSync(file, 'utf8')
    .replace(/^import .*;\s*$/gm, '')
    .replace('const json=(b:any,s=200)', 'const json=(b,s=200)')
    .replace('let body:Record<string,unknown>;', 'let body;')
    .replaceAll('(row:any)', '(row)')
    .replace(/Deno\.env\.get\(("SUPABASE_(?:URL|ANON_KEY|SERVICE_ROLE_KEY)")\)!/g, 'Deno.env.get($1)');
  let handler;
  const rows = [];
  let currentUser = 'user-a';
  let insertRace = null;
  const queryFor = (options={}) => {
    const filters = [];
    const q = {
      eq(k,v) { filters.push(r => r[k]===v); return q; },
      limit(n) { return Promise.resolve({data: rows.filter(r=>filters.every(f=>f(r))).slice(0,n),error:null}); },
      gte(k,v) {
        const count=rows.filter(r=>filters.every(f=>f(r)) && r[k]>=v).length;
        return Promise.resolve({count,error:null});
      }
    };
    return q;
  };
  const client = {
    auth:{getUser:async()=>({data:{user:{id:currentUser}},error:null})},
    from:()=>({
      select:(_fields,options)=>queryFor(options),
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
    env:{get:()=> 'test-value'},
    serve:fn=>{handler=fn;}
  };
  new Function('Deno','createClient','Response',source)(deno,()=>client,Response);
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
  return {send,rows,setUser:id=>{currentUser=id},setInsertRace:fn=>{insertRace=fn}};
}
const coin=(id,product='mushiverse.coins.100',original=id)=>({
  transaction_id:id,original_transaction_id:original,product_id:product,
  environment:'storekit'
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
