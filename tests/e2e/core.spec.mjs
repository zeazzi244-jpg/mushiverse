import { test, expect } from '@playwright/test';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
async function setup(page, { cards=0, failSave=false }={}) {
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message,JSON.stringify(e),e.stack)});
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1'&&!url.pathname.endsWith('/assets/vendor/supabase.js'))return route.continue();
    if(url.pathname.endsWith('/assets/vendor/supabase.js'))return route.fulfill({contentType:'text/javascript',body:`
      (()=>{const callbacks=[];let user={id:'${A}',email:'test@example.invalid'};
      const now=new Date().toISOString();
      const rows=[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_id:user.id,insect_name:'カブトムシ',category:'甲虫',prefecture:'東京都',municipality:'',observed_at:now,created_at:now,image_url:null}];
      const auth={getUser:async()=>({data:{user},error:null}),getSession:async()=>({data:{session:user?{user,access_token:'test-token'}:null}}),onAuthStateChange:fn=>{callbacks.push(fn);return {data:{subscription:{unsubscribe(){}}}}},signOut:async()=>{window.testSwitchUser(null);return {error:null}}};
      window.testSwitchUser=id=>{user=id?{id,email:'test@example.invalid'}:null;callbacks.forEach(fn=>fn('SIGNED_IN',user?{user}:null))};
      function from(table){let single=false,head=false;const filters=[];let proxy;const q={then(resolve,reject){let data=table==='insect_posts'?rows:[];for(const [k,v] of filters)data=data.filter(r=>r[k]===v);return Promise.resolve({data:head?null:single?(data[0]||null):data,count:data.length,error:null}).then(resolve,reject)}};
      proxy=new Proxy(q,{get(o,k){if(k==='then')return o.then.bind(o);return (...args)=>{if(k==='eq')filters.push(args);if(k==='maybeSingle'||k==='single')single=true;if(k==='select'&&args[1]?.head)head=true;return proxy}}});return proxy}
      window.supabase={createClient:()=>({auth,from,functions:{invoke:async()=>({data:{plan:'free',status:'free',ok:true,features:{}},error:null})},storage:{from:()=>({})}})};})()`});
    return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
  await page.addInitScript(({A,cards,failSave})=>{
    localStorage.setItem('mushiverse-v77-game:user:'+A,JSON.stringify({coins:500,tickets:0,streak:0,lastClaim:'',history:[],cards:Array.from({length:cards},()=>({name:'ナナホシテントウ',rarity:'N',at:new Date().toISOString()}))}));
    localStorage.setItem('mushiverse-profile-v86:user:'+A,JSON.stringify({name:'採集家A'}));
    if(failSave){const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('mushiverse-v77-game:'))throw new DOMException('quota','QuotaExceededError');return original.call(this,k,v)}}
  },{A,cards,failSave});
  await page.goto('/');await expect.poll(()=>page.evaluate(()=>window.records?.length)).toBe(1);
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
