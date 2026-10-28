import { test, expect } from '@playwright/test';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
async function setup(page, { cards=0, failSave=false,initialLoadFailure=false,insectName='カブトムシ' }={}) {
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
  await page.addInitScript(({A,cards,failSave})=>{
    localStorage.setItem('mushiverse-v77-game:user:'+A,JSON.stringify({coins:500,tickets:0,streak:0,lastClaim:'',history:[],cards:Array.from({length:cards},()=>({name:'ナナホシテントウ',rarity:'N',at:new Date().toISOString()}))}));
    localStorage.setItem('mushiverse-profile-v86:user:'+A,JSON.stringify({name:'採集家A'}));
    if(failSave){const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('mushiverse-v77-game:'))throw new DOMException('quota','QuotaExceededError');return original.call(this,k,v)}}
  },{A,cards,failSave});
  await page.goto('/');if(!initialLoadFailure)await expect.poll(()=>page.evaluate(()=>window.records?.length)).toBe(1);else await expect.poll(()=>page.evaluate(()=>window.user?.id)).toBe(A);
  return errors;
}
test('six tabs preserve their nested panels; weekly quest and records render',async({page})=>{
  const errors=await setup(page);
  for(const tab of ['profile','home','gacha','collection','map','post','home']){
    await page.locator('.nav [data-tab="'+tab+'"]').click();
    await expect(page.locator('main > section:not(.hide)')).toHaveAttribute('id',tab);
    expect(await page.locator('main > section:not(.hide) section.hide').count()).toBe(0);
  }
  await expect(page.locator('#weeklyQuest')).toContainText('1 / 3');
  await expect(page.locator('#feed')).toContainText('カブトムシ');
  expect(errors).toEqual([]);
});
test('draw retains collection beyond 300 and updates encyclopedia immediately',async({page})=>{
  await setup(page,{cards:300});await page.locator('.nav [data-tab="gacha"]').click();
  await page.locator('#mv77Draw').click();
  await expect.poll(()=>page.evaluate(A=>JSON.parse(localStorage.getItem('mushiverse-v77-game:user:'+A)).cards.length,A)).toBe(301);
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await page.locator('.nav [data-tab="collection"]').click();await page.locator('#mv90GachaTab').click();
  await expect(page.locator('#mv90Stats')).toContainText('301');
});
test('failed daily bonus save rolls back and purchases remain disabled',async({page})=>{
  await setup(page,{failSave:true});await page.locator('.nav [data-tab="gacha"]').click();
  await page.locator('#mv77Claim').click();
  await expect(page.locator('#mv77Coins')).toContainText('500');
  await expect(page.locator('#mv77Result')).toContainText('保存に失敗');
  for(const b of await page.locator('#mv134CoinStore .mv134Pack button').all())await expect(b).toBeDisabled();
});
test('account switch clears private profile and refreshes records and follower count',async({page})=>{
  await setup(page);await page.locator('.nav [data-tab="profile"]').click();
  await expect(page.locator('#mv86Name')).toHaveText('採集家A');
  await page.evaluate(B=>window.testSwitchUser(B),B);
  await expect(page.locator('#mv86Name')).toHaveText('昆虫採集家');
  await expect(page.locator('#mv86Posts')).toHaveText('0');
  await page.evaluate(()=>window.testSwitchUser(null));
  await expect(page.locator('#mv86Posts')).toHaveText('—');
});
test('network reconnect does not crash the core app',async({page})=>{
  const errors=await setup(page);
  await page.evaluate(()=>{window.dispatchEvent(new Event('offline'));window.dispatchEvent(new Event('online'))});
  await page.locator('.nav [data-tab="collection"]').click();
  await expect(page.locator('#collectionList')).toContainText('カブトムシ');
  expect(errors).toEqual([]);
});
test('a slow map lookup cannot restore pins excluded by a newer filter',async({page})=>{
  await setup(page);
  let release;
  const pending=new Promise(resolve=>{release=resolve});
  await page.route('**/AddressSearch**',async route=>{await pending;await route.fulfill({contentType:'application/json',body:JSON.stringify([{geometry:{coordinates:[139.7,35.69]}}])})});
  await page.evaluate(()=>{window.records[0].municipality='新宿区'});
  const requested=page.waitForRequest('**/AddressSearch**');
  await page.locator('.nav [data-tab="map"]').click();await requested;
  await page.locator('#mapCategory').selectOption('チョウ・ガ');
  release();
  await expect(page.locator('#areaRanking')).toContainText('地図に表示できる地域がまだありません');
  await expect(page.locator('#insectMap .leaflet-marker-icon')).toHaveCount(0);
});
test('drafts and selected photos cannot cross account boundaries',async({page})=>{
  await setup(page);await page.locator('.nav [data-tab="post"]').click();
  await page.locator('#species').fill('アカウントAの下書き');
  await page.evaluate(B=>window.testSwitchUser(B),B);
  await expect(page.locator('#species')).toHaveValue('');
  await page.locator('#species').fill('アカウントBの下書き');
  await page.evaluate(A=>window.testSwitchUser(A),A);
  await expect(page.locator('#species')).toHaveValue('アカウントAの下書き');
});
test('two tabs can claim a free bonus only once',async({page,context})=>{
  await setup(page);await page.locator('.nav [data-tab="gacha"]').click();
  const second=await context.newPage();await setup(second);await second.locator('.nav [data-tab="gacha"]').click();
  // Exercise concurrent storage actions without requiring animation frames in a background WebKit tab.
  await Promise.all([page.evaluate(()=>document.getElementById('mv77Claim').click()),second.evaluate(()=>document.getElementById('mv77Claim').click())]);
  await expect(page.locator('#mv77Coins')).toContainText('600');await expect(second.locator('#mv77Coins')).toContainText('600');
  await expect(page.locator('#mv77Claim')).toBeDisabled();await expect(second.locator('#mv77Claim')).toBeDisabled();
});
test('switching account during photo upload prevents insert and double submit',async({page})=>{
  await setup(page);await page.locator('.nav [data-tab="post"]').click();
  await page.locator('#species').fill('テスト採集');
  await page.locator('#photo').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
  await expect(page.locator('#aiIdentify')).toBeEnabled();
  await page.evaluate(()=>{window.testPauseUpload=true;document.getElementById('recordForm').dispatchEvent(new Event('submit',{cancelable:true}))});
  await expect.poll(()=>page.evaluate(()=>typeof window.testReleaseUpload)).toBe('function');
  await page.evaluate(B=>{document.getElementById('recordForm').dispatchEvent(new Event('submit',{cancelable:true}));window.testSwitchUser(B);window.testReleaseUpload()},B);
  await expect(page.locator('#toast')).toContainText('アカウントが変更');
  const writes=await page.evaluate(()=>window.testWrites);
  expect(writes.filter(x=>x.action==='upload')).toHaveLength(1);
  expect(writes.filter(x=>x.table==='insect_posts'&&x.action==='insert')).toHaveLength(0);
});
test('late public profile response cannot overwrite a newer profile',async({page})=>{
  const errors=await setup(page);await page.locator('.nav [data-tab="collection"]').click();
  await page.evaluate(({A,B})=>{window.testLeaders=[{user_id:A,display_name:'利用者A',unique_species:1},{user_id:B,display_name:'利用者B',unique_species:2}];window.testQueryHook=({table,filters,head})=>{if(table==='insect_posts'&&!head&&filters.some(([key,id])=>key==='user_id'&&id===A))return new Promise(resolve=>{window.testReleaseProfile=()=>resolve({data:[{insect_name:'古いAの記録'}],error:null})})}}, {A,B});
  await page.locator('#mv104Refresh').click();await page.locator('#mv104List button').filter({hasText:'利用者A'}).click();
  await expect.poll(()=>page.evaluate(()=>typeof window.testReleaseProfile)).toBe('function');
  await page.locator('#mv105PublicProfile button').first().click();
  await page.locator('#mv104List button').filter({hasText:'利用者B'}).click();
  await page.evaluate(()=>window.testReleaseProfile());
  await expect(page.locator('#mv105PublicProfile h2')).toContainText('利用者B');
  await expect(page.locator('#mv105PublicProfile')).not.toContainText('古いAの記録');expect(errors).toEqual([]);
});
test('hiding a post removes it from collection, map and popular record links',async({page})=>{
  await setup(page);await page.locator('#feed [data-detail]').click();
  await page.locator('[data-hide-post]').click();
  await expect(page.locator('#ranking')).not.toContainText('カブトムシ');
  await page.locator('.nav [data-tab="collection"]').click();await expect(page.locator('#collectionList')).not.toContainText('カブトムシ');
  await page.locator('.nav [data-tab="map"]').click();await expect(page.locator('#insectMap .leaflet-marker-icon')).toHaveCount(0);
});

test('startup post fetch failure does not break authentication updates',async({page})=>{
  const errors=await setup(page,{initialLoadFailure:true});
  await page.evaluate(B=>window.testSwitchUser(B),B);
  await expect.poll(()=>page.evaluate(()=>window.user?.id)).toBe(B);
  await page.locator('.nav [data-tab="profile"]').click();await expect(page.locator('#mv86Name')).toHaveText('昆虫採集家');
  expect(errors).toEqual([]);
});
test('a post response from before account switching is discarded',async({page})=>{
  await setup(page);
  await page.evaluate(()=>{window.testQueryHook=({table,filters,head})=>{if(table==='insect_posts'&&!head&&!filters.length)return new Promise(resolve=>{window.testReleasePosts=()=>resolve({data:[{id:'late',user_id:'old',insect_name:'古いアカウントの応答'}],error:null})})};document.getElementById('loadMore').click()});
  await expect.poll(()=>page.evaluate(()=>typeof window.testReleasePosts)).toBe('function');
  await page.evaluate(B=>{window.testSwitchUser(B);window.testReleasePosts()},B);
  await expect(page.locator('#feed')).not.toContainText('古いアカウントの応答');
});

for (const name of ['__proto__','constructor']) test('reserved species name does not crash rendering: '+name,async({page})=>{
  const errors=await setup(page,{insectName:name});
  await expect(page.locator('#feed')).toContainText(name);
  await page.locator('.nav [data-tab="collection"]').click();
  await expect(page.locator('#collectionList')).toContainText(name);
  expect(errors).toEqual([]);
});
test('paid draw controls stay disabled regardless of local tampering',async({page})=>{
 const errors=await setup(page);await page.locator('.nav [data-tab="gacha"]').click();
 await expect(page.locator('#paidDrawControls')).toBeVisible();
 await page.evaluate(()=>{localStorage.setItem('APPLE_PAID_DRAWS_ENABLED','true');window.PURCHASED_DRAWS_RELEASE_APPROVED=true});
 for(const button of await page.locator('#paidDrawControls button').all())await expect(button).toBeDisabled();
 expect(errors).toEqual([]);
});
