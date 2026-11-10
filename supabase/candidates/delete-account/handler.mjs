// Review candidate only. Not used by the live delete-account function.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESTRICTED=['gacha_coin_wallets','gacha_coin_purchase_credits','gacha_coin_spends','gacha_paid_draws'];
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
class CleanupError extends Error{}
async function photoPaths(bucket,userId){
 const paths=[],folders=[userId],seen=new Set();
 for(let i=0;i<folders.length;i++){
  if(folders.length>1000)throw new CleanupError('photo_inventory_too_large');
  const folder=folders[i];
  for(let offset=0;offset<=50000;offset+=1000){
   const result=await bucket.list(folder,{limit:1000,offset,sortBy:{column:'name',order:'asc'}});
   if(result.error||!Array.isArray(result.data))throw new CleanupError('photo_lookup_failed');
   for(const entry of result.data){
    const name=entry?.name;
    if(typeof name!=='string'||!name||name==='.'||name==='..'||name.includes('/')||name.includes('\\'))throw new CleanupError('photo_path_invalid');
    const path=folder+'/'+name;
    if(seen.has(path))throw new CleanupError('photo_inventory_inconsistent');
    seen.add(path);
    if(entry.id===null){folders.push(path)}
    else if(typeof entry.id==='string'&&entry.id){paths.push(path)}
    else throw new CleanupError('photo_inventory_invalid');
    if(paths.length>50000)throw new CleanupError('photo_inventory_too_large');
   }
   if(result.data.length<1000)break;
   if(offset===50000)throw new CleanupError('photo_inventory_too_large');
  }
 }
 return paths;
}
export function createDeleteAccountHandler({caller,admin}){
 return async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({deleted:false,error:'method_not_allowed'},405);
  const auth=req.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer '))return json({deleted:false,error:'unauthorized'},401);
  try{
   const verified=await caller.auth.getUser(auth.slice(7));
   const userId=verified.data?.user?.id;
   if(verified.error||!UUID.test(userId||''))return json({deleted:false,error:'unauthorized'},401);
   let body;
   try{body=await req.json()}catch{return json({deleted:false,error:'invalid_json'},400)}
   if(!['DELETE','DELETE_MY_ACCOUNT'].includes(body?.confirmation))return json({deleted:false,error:'confirmation_required'},400);
   // Existing financial records must not be deleted or silently migrated.
   // Stop BEFORE photos/posts until the owner approves their retention/deletion policy.
   for(const table of RESTRICTED){
    const r=await admin.from(table).select('user_id',{count:'exact',head:true}).eq('user_id',userId);
    if(r.error||!Number.isSafeInteger(r.count)||r.count<0)return json({deleted:false,error:'dependency_lookup_failed'},503);
    if(r.count>0)return json({deleted:false,error:'account_requires_retention_review'},409);
   }
   const bucket=admin.storage.from('insect-photos');
   const paths=await photoPaths(bucket,userId);
   for(let i=0;i<paths.length;i+=1000){
    const removed=await bucket.remove(paths.slice(i,i+1000));
    if(removed.error)throw new CleanupError('photo_delete_failed');
   }
   // A concurrent upload must not be ignored.
   if((await photoPaths(bucket,userId)).length)throw new CleanupError('photos_changed_retry');
   // Actual FK metadata: post comments/likes cascade, report references set null.
   const posts=await admin.from('insect_posts').delete({count:'exact'}).eq('user_id',userId);
   if(posts.error)throw new CleanupError('post_delete_failed');
   const deleted=await admin.auth.admin.deleteUser(userId);
   if(deleted.error)throw new CleanupError('auth_delete_failed');
   // Auth has already been deleted. Audit failure must not falsely say otherwise.
   let auditRecorded=false;
   try{
    const audit=await admin.from('account_deletion_audit').insert({deleted_posts:posts.count||0,deleted_photos:paths.length,function_version:'candidate-v2'});
    auditRecorded=!audit.error;
   }catch{}
   return json({deleted:true,deleted_posts:posts.count||0,deleted_photos:paths.length,audit_recorded:auditRecorded});
  }catch(error){
   return json({deleted:false,error:error instanceof CleanupError?error.message:'deletion_failed'},503);
  }
 };
}
