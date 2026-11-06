import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeleteAccountHandler} from '../supabase/candidates/delete-account/handler.mjs';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
function fixture(options={}){
 const events=[],objects=new Set(options.paths||[A+'/one.jpg',B+'/private.jpg']);
 let listCalls=0;
 const caller={auth:{getUser:async()=>{events.push('verify');return {data:{user:{id:options.userId||A}},error:options.authError||null}}}};
 const bucket={
  async list(folder,{offset=0,limit}){
   listCalls++;events.push({list:folder,offset});
   assert(folder===A||folder.startsWith(A+'/'));
   if(options.listError||options.failListCall===listCalls)return {data:null,error:{message:'test'}};
   if(options.invalidPath)return {data:[{name:'../other',id:'x'}],error:null};
   const entries=new Map();
   for(const path of objects){
    if(!path.startsWith(folder+'/'))continue;
    const rest=path.slice(folder.length+1),slash=rest.indexOf('/');
    if(slash>=0)entries.set(rest.slice(0,slash),{name:rest.slice(0,slash),id:null});
    else entries.set(rest,{name:rest,id:'object-id'});
   }
   return {data:[...entries.values()].sort((a,b)=>a.name.localeCompare(b.name)).slice(offset,offset+limit),error:null};
  },
  async remove(paths){
   events.push({remove:paths});
   assert(paths.length<=1000);assert(paths.every(p=>p.startsWith(A+'/')));
   if(options.removeError)return {error:{message:'test'}};
   for(const path of paths)objects.delete(path);
   if(options.concurrentUpload)objects.add(A+'/new.jpg');
   return {data:paths.map(name=>({name})),error:null};
  }
 };
 const admin={
  storage:{from:name=>{assert.equal(name,'insect-photos');return bucket}},
  from(table){
   return {
    select(){return {eq:async(key,id)=>{assert.equal(key,'user_id');assert.equal(id,A);events.push({lookup:table});return {count:options.restricted===table?1:0,error:options.countError?{message:'test'}:null}}}},
    delete(){return {eq:async(key,id)=>{assert.equal(table,'insect_posts');assert.equal(key,'user_id');assert.equal(id,A);events.push('posts');return {count:2,error:options.postError?{message:'test'}:null}}}},
    async insert(payload){assert.equal(table,'account_deletion_audit');assert(!('user_id' in payload));events.push('audit');return {error:options.auditError?{message:'test'}:null}}
   }
  },
  auth:{admin:{deleteUser:async id=>{assert.equal(id,A);events.push('auth-delete');return {error:options.deleteError?{message:'test'}:null}}}}
 };
 const handler=createDeleteAccountHandler({caller,admin});
 const run=async(body={confirmation:'DELETE_MY_ACCOUNT'},headers={Authorization:'Bearer mock-token'},method='POST')=>{
  const r=await handler(new Request('https://example.invalid/delete-account',{method,headers:{...headers,'Content-Type':'application/json'},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})}));
  return {status:r.status,body:await r.json()};
 };
 return {run,events,objects};
}
test('method, credentials, invalid JSON and missing confirmation stop before mutation',async()=>{
 for(const [body,headers,method,status] of [[{}, {},'GET',405],[{}, {},'POST',401],['{',{Authorization:'Bearer mock-token'},'POST',400],[{}, {Authorization:'Bearer mock-token'},'POST',400]]){
  const f=fixture();assert.equal((await f.run(body,headers,method)).status,status);
  assert(!f.events.some(x=>x==='posts'||x==='auth-delete'||x?.remove));
 }
});
test('unverified or malformed identity cannot access admin data',async()=>{
 for(const options of [{authError:{message:'test'}},{userId:'../other'}]){
  const f=fixture(options);assert.equal((await f.run()).status,401);assert.deepEqual(f.events,['verify']);
 }
});
test('request body cannot select another account and other owner photos survive',async()=>{
 const f=fixture();const r=await f.run({confirmation:'DELETE_MY_ACCOUNT',user_id:B});
 assert.equal(r.body.deleted,true);assert(f.objects.has(B+'/private.jpg'));assert(!f.objects.has(A+'/one.jpg'));
 assert(f.events.indexOf('posts')<f.events.indexOf('auth-delete'));
});
test('pagination and nested folders remove all 1151 owned objects in bounded batches',async()=>{
 const paths=Array.from({length:1150},(_,i)=>A+'/'+String(i).padStart(4,'0')+'.jpg');paths.push(A+'/nested/child.jpg',B+'/private.jpg');
 const f=fixture({paths});const r=await f.run();
 assert.equal(r.body.deleted_photos,1151);assert.equal(r.body.deleted,true);
 assert.deepEqual(f.events.filter(x=>x?.remove).map(x=>x.remove.length),[1000,151]);
 assert.deepEqual([...f.objects],[B+'/private.jpg']);
});
test('storage lookup or pagination failure never begins deletion',async()=>{
 const many=Array.from({length:1001},(_,i)=>A+'/'+i+'.jpg');
 for(const options of [{listError:true},{paths:many,failListCall:2},{invalidPath:true}]){
  const f=fixture(options);assert.equal((await f.run()).body.deleted,false);
  assert(!f.events.some(x=>x?.remove||x==='posts'||x==='auth-delete'));
 }
});
test('storage removal failure never proceeds to posts or Auth deletion',async()=>{
 const f=fixture({removeError:true});const r=await f.run();assert.equal(r.body.error,'photo_delete_failed');
 assert(!f.events.includes('posts'));assert(!f.events.includes('auth-delete'));
});
test('financial dependency or failed dependency lookup stops before destructive work',async()=>{
 for(const table of ['gacha_coin_wallets','gacha_coin_purchase_credits','gacha_coin_spends','gacha_paid_draws']){
  const f=fixture({restricted:table});assert.equal((await f.run()).status,409);
  assert(!f.events.some(x=>x?.list||x?.remove||x==='posts'||x==='auth-delete'));
 }
 const f=fixture({countError:true});assert.equal((await f.run()).body.error,'dependency_lookup_failed');assert(!f.events.some(x=>x?.list));
});
test('concurrent upload is detected before post or Auth deletion',async()=>{
 const f=fixture({concurrentUpload:true});assert.equal((await f.run()).body.error,'photos_changed_retry');
 assert(!f.events.includes('posts'));assert(!f.events.includes('auth-delete'));
});
test('post or Auth deletion failures are never reported as completed',async()=>{
 const f=fixture({postError:true});assert.equal((await f.run()).body.deleted,false);assert(!f.events.includes('auth-delete'));
 const g=fixture({deleteError:true});assert.equal((await g.run()).body.error,'auth_delete_failed');assert(!g.events.includes('audit'));
});
test('audit failure after actual Auth deletion reports deletion honestly',async()=>{
 const f=fixture({auditError:true});const r=await f.run();
 assert.equal(r.body.deleted,true);assert.equal(r.body.audit_recorded,false);assert(f.events.includes('auth-delete'));
});
