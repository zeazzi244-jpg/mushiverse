import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createDeleteAccountHandler} from '../../supabase/candidates/delete-account/handler.mjs';
const url=process.env.SUPABASE_URL;
if(url!=='http://127.0.0.1:55321')throw Error('disposable_loopback_stack_only');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,options);
const caller=token=>createClient(url,process.env.SUPABASE_ANON_KEY,{...options,global:token?{headers:{Authorization:'Bearer '+token}}:undefined});
const users=[],uploaded=[];
const request=(token,body)=>new Request('http://local.invalid/delete-account',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
async function login(){
 const email='safety-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomUUID()+'aA1!';
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.equal(created.error,null);
 const id=created.data.user.id;users.push(id);
 const signed=await caller().auth.signInWithPassword({email,password});assert.equal(signed.error,null);
 return {id,email,password,token:signed.data.session.access_token};
}
async function upload(user,name){
 const path=user.id+'/'+name;
 const r=await caller(user.token).storage.from('insect-photos').upload(path,new Uint8Array([1,2,3]),{contentType:'image/jpeg'});
 assert.equal(r.error,null);uploaded.push(path);return path;
}
test('isolated real Auth, Storage and FK/RLS safety integration',async t=>{
 try{
  assert.equal((await admin.storage.createBucket('insect-photos',{public:false})).error,null);
  const a=await login(),b=await login(),c=await login(),d=await login();
  const aPost=crypto.randomUUID(),bPost=crypto.randomUUID();
  assert.equal((await admin.from('insect_posts').insert([{id:aPost,user_id:a.id,insect_name:'A test'},{id:bPost,user_id:b.id,insect_name:'B test'}])).error,null);
  const handler=createDeleteAccountHandler({caller:caller(),admin});
  await t.test('report insert is authenticated, hidden from other users and rejects forged ownership',async()=>{
   const r=await caller(a.token).from('content_reports').insert({reporter_id:a.id,post_id:bPost,reason:'isolated test report'});assert.equal(r.error,null);
   const rows=await admin.from('content_reports').select('id,reporter_id,post_id');assert.equal(rows.data.length,1);assert.equal(rows.data[0].reporter_id,a.id);
   const other=await caller(b.token).from('content_reports').select('id');assert.equal(other.error,null);assert.deepEqual(other.data,[]);
   const forged=await caller(a.token).from('content_reports').insert({reporter_id:b.id,post_id:bPost,reason:'forged'});assert.ok(forged.error);
   assert.equal((await caller(b.token).from('content_reports').insert({reporter_id:b.id,post_id:aPost,reason:'keep after target deletion'})).error,null);
  });
  await t.test('Storage API enforces owner path and supports nested photo cleanup',async()=>{
   await upload(a,'one.jpg');await upload(a,'nested/two.jpg');await upload(b,'private.jpg');
   const forged=await caller(a.token).storage.from('insect-photos').upload(b.id+'/forged.jpg',new Uint8Array([1]));assert.ok(forged.error);
  });
  await t.test('paid-data dependency stops before any account or photo deletion',async()=>{
   await upload(c,'keep.jpg');
   assert.equal((await admin.from('gacha_coin_wallets').insert({user_id:c.id})).error,null);
   const response=await handler(request(c.token,{confirmation:'DELETE_MY_ACCOUNT'}));assert.equal(response.status,409);
   assert.equal((await response.json()).deleted,false);
   assert.equal((await admin.auth.admin.getUserById(c.id)).error,null);
   assert.equal((await admin.storage.from('insect-photos').list(c.id)).data.length,1);
  });
  await t.test('injected Storage failure with real Auth preserves posts and account',async()=>{
   await upload(d,'keep.jpg');
   const dPost=crypto.randomUUID();
   assert.equal((await admin.from('insect_posts').insert({id:dPost,user_id:d.id,insect_name:'D preserved'})).error,null);
   const failingAdmin={
    from:table=>admin.from(table),
    auth:admin.auth,
    storage:{from:()=>({
     list:(...args)=>admin.storage.from('insect-photos').list(...args),
     remove:async()=>({error:{message:'injected'}})
    })}
   };
   const failing=createDeleteAccountHandler({caller:caller(),admin:failingAdmin});
   const response=await failing(request(d.token,{confirmation:'DELETE_MY_ACCOUNT'}));assert.equal(response.status,503);assert.equal((await response.json()).error,'photo_delete_failed');
   assert.equal((await admin.auth.admin.getUserById(d.id)).error,null);assert.equal((await admin.storage.from('insect-photos').list(d.id)).data.length,1);
   assert.equal((await admin.from('insect_posts').select('id').eq('id',dPost)).data.length,1);
   assert.equal((await admin.from('insect_posts').delete().eq('id',dPost)).error,null);
  });
  await t.test('deletion removes only caller photos, posts and Auth; other user and report remain',async()=>{
   assert.equal((await admin.from('post_comments').insert([{post_id:bPost,user_id:a.id},{post_id:aPost,user_id:b.id}])).error,null);
   assert.equal((await admin.from('post_likes').insert([{post_id:bPost,user_id:a.id},{post_id:aPost,user_id:b.id}])).error,null);
   const response=await handler(request(a.token,{confirmation:'DELETE_MY_ACCOUNT',user_id:b.id}));assert.equal(response.status,200);
   const result=await response.json();assert.equal(result.deleted,true);assert.equal(result.deleted_photos,2);assert.equal(result.audit_recorded,true);
   assert.ok((await admin.auth.admin.getUserById(a.id)).error);
   assert.equal((await admin.auth.admin.getUserById(b.id)).error,null);
   assert.deepEqual((await admin.storage.from('insect-photos').list(a.id)).data,[]);
   assert.deepEqual((await admin.storage.from('insect-photos').list(a.id+'/nested')).data,[]);
   assert.equal((await admin.storage.from('insect-photos').list(b.id)).data.length,1);
   const posts=await admin.from('insect_posts').select('id,user_id');assert.deepEqual(posts.data,[{id:bPost,user_id:b.id}]);
   const reports=await admin.from('content_reports').select('reporter_id,post_id');assert.deepEqual(reports.data,[{reporter_id:b.id,post_id:null}]);
   assert.deepEqual((await admin.from('post_comments').select('id')).data,[]);
   assert.deepEqual((await admin.from('post_likes').select('id')).data,[]);
  });
  await t.test('deleted account cannot log in or request another deletion with its old token',async()=>{
   const signed=await caller().auth.signInWithPassword({email:a.email,password:a.password});assert.ok(signed.error);
   assert.equal((await handler(request(a.token,{confirmation:'DELETE_MY_ACCOUNT'}))).status,401);
   const oldInsert=await caller(a.token).from('content_reports').insert({reporter_id:a.id,post_id:bPost,reason:'stale token'});assert.ok(oldInsert.error);
  });
 }finally{
  // Only generated users in this disposable stack are ever cleaned up.
  if(uploaded.length)await admin.storage.from('insect-photos').remove(uploaded);
  if(users.length){
   for(const table of ['gacha_coin_wallets','gacha_coin_purchase_credits','gacha_coin_spends','gacha_paid_draws'])await admin.from(table).delete().in('user_id',users);
   await admin.from('insect_posts').delete().in('user_id',users);
   for(const id of users)await admin.auth.admin.deleteUser(id);
  }
 }
});
