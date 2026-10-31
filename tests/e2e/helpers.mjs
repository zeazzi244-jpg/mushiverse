import {expect} from '@playwright/test';
export const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
export async function setup(page, { cards=0, tickets=0, coins=500, streak=0, lastClaim='', extraCards=[], rawWallet=null, failSave=false,initialLoadFailure=false,insectName='カブトムシ' }={}) {
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message,JSON.stringify(e),e.stack)});
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1'&&!url.pathname.endsWith('/assets/vendor/supabase.js'))return route.continue();
    if(url.pathname.endsWith('/assets/vendor/supabase.js'))return route.fulfill({contentType:'text/javascript',body:`
      (()=>{const callbacks=[];let user={id:'${A}',email:'test@example.invalid'};
      const now=new Date().toISOString();
      const rows=[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_id:user.id,insect_name:${JSON.stringify(insectName)},category:'甲虫',prefecture:'東京都',municipality:'',observed_at:now,created_at:now,image_url:null}];
      window.testRows=rows;window.testInitialLoadFailure=${initialLoadFailure};window.testLeaders=[];window.testWrites=[];
      const auth={getUser:async()=>({data:{user},error:null}),getSession:async()=>({data:{session:user?{user,access_token:'test-token'}:null}}),onAuthStateChange:fn=>{callbacks.push(fn);return {data:{subscription:{unsubscribe(){}}}}},signOut:async()=>{window.testSwitchUser(null);return {error:null}}};
      window.testSwitchUser=id=>{user=id?{id,email:'test@example.invalid'}:null;callbacks.forEach(fn=>fn('SIGNED_IN',user?{user}:null))};
      function from(table){let single=false,head=false;const filters=[];let proxy,write=null;const q={then(resolve,reject){if(table==='insect_posts'&&!head&&!filters.length&&window.testInitialLoadFailure){window.testInitialLoadFailure=false;return Promise.reject(Error('test network unavailable')).then(resolve,reject)}if(write)window.testWrites.push({table,...write});if(window.testQueryHook){const response=window.testQueryHook({table,filters,head,write});if(response)return Promise.resolve(response).then(resolve,reject)}let data=table==='insect_posts'?rows:table==='gacha_collection_leaderboard'?window.testLeaders:[];for(const [k,v] of filters)data=data.filter(r=>r[k]===v);return Promise.resolve({data:head?null:single?(data[0]||null):data,count:data.length,error:null}).then(resolve,reject)}};
      proxy=new Proxy(q,{get(o,k){if(k==='then')return o.then.bind(o);return (...args)=>{if(['insert','upsert','update','delete'].includes(k))write={action:k,payload:args[0]};if(k==='eq')filters.push(args);if(k==='maybeSingle'||k==='single')single=true;if(k==='select'&&args[1]?.head)head=true;return proxy}}});return proxy}
      window.supabase={createClient:()=>({auth,from,functions:{invoke:async()=>({data:{plan:'free',status:'free',ok:true,features:{}},error:null})},storage:{from:()=>({upload:async(path)=>{window.testWrites.push({action:'upload',path});if(window.testPauseUpload)await new Promise(resolve=>{window.testReleaseUpload=resolve});return {error:null}},remove:async(paths)=>{window.testWrites.push({action:'remove',paths});return {error:null}},getPublicUrl:path=>({data:{publicUrl:'https://example.invalid/'+path}})})}})};})()`});
    return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
  await page.addInitScript(({A,cards,tickets,coins,streak,lastClaim,extraCards,rawWallet,failSave})=>{
    if(localStorage.getItem('mushiverse-v77-game:user:'+A)===null)localStorage.setItem('mushiverse-v77-game:user:'+A,rawWallet??JSON.stringify({coins,tickets,streak,lastClaim,history:[],cards:[...Array.from({length:cards},()=>({name:'ナナホシテントウ',rarity:'N',at:new Date().toISOString()})),...extraCards]}));
    localStorage.setItem('mushiverse-profile-v86:user:'+A,JSON.stringify({name:'採集家A'}));
    if(failSave){const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('mushiverse-v77-game:'))throw new DOMException('quota','QuotaExceededError');return original.call(this,k,v)}}
  },{A,cards,tickets,coins,streak,lastClaim,extraCards,rawWallet,failSave});
  await page.goto('/');if(!initialLoadFailure)await expect.poll(()=>page.evaluate(()=>window.records?.length)).toBe(1);else await expect.poll(()=>page.evaluate(()=>window.user?.id)).toBe(A);
  return errors;
}
