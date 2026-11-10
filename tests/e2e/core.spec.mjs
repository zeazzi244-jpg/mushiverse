import { test, expect } from '@playwright/test';
import {A,B,setup} from './helpers.mjs';
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
  await setup(page,{cards:300});await page.waitForFunction(()=>window.MushiverseIllustratedCards?.N?.length===40);await page.locator('.nav [data-tab="gacha"]').click();
  await page.locator('#mv77Draw').click();
  await expect.poll(()=>page.evaluate(A=>JSON.parse(localStorage.getItem('mushiverse-v77-game:user:'+A)).cards.length,A)).toBe(301);
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await page.locator('.nav [data-tab="collection"]').click();await page.locator('#mv90GachaTab').click();
  await expect(page.locator('#mv90CardList')).toHaveCount(0);
  await expect(page.locator('#aiInsectStatus')).toContainText('所持 1種類');
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
  await expect(page.locator('#mv77Coins')).toContainText('505');await expect(second.locator('#mv77Coins')).toContainText('505');
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
 await expect(page.locator('#paidDrawControls')).toBeHidden();
 await page.locator('#mv134CoinStore > summary').click();
 await expect(page.locator('#paidDrawControls')).toBeVisible();
 await page.evaluate(()=>{localStorage.setItem('APPLE_PAID_DRAWS_ENABLED','true');window.PURCHASED_DRAWS_RELEASE_APPROVED=true});
 for(const button of await page.locator('#paidDrawControls button').all())await expect(button).toBeDisabled();
 expect(errors).toEqual([]);
});

test('adventure home actions open the record and gacha tabs', async ({page}) => {
  const errors = await setup(page);
  const nav = page.locator('.nav');
  await expect(page.locator('#home .mvAdventureHero')).toBeVisible();
  await page.locator('#home .mvAdventurePrimary').click();
  await expect(page.locator('#recordForm')).toBeVisible();
  await nav.locator('[data-tab="home"]').click();
  await page.locator('#home .mvAdventureSecondary').click();
  await expect(page.locator('#gacha')).toBeVisible();
  expect(errors).toEqual([]);
});

test('discovery trail opens only your real sightings and resets on sign-out', async ({page}) => {
  const errors = await setup(page);
  await expect(page.locator('#mvDiscoveryCount')).toHaveText('1 / 3');
  await page.evaluate(B => {
    window.records.push({...window.records[0], id: 'other', user_id: B, insect_name: 'トンボ'});
  }, B);
  const nav = page.locator('.nav');
  await nav.locator('[data-tab="collection"]').click();
  await page.locator('#mv90GachaTab').click();
  await nav.locator('[data-tab="home"]').click();
  await page.locator('#mvDiscoveryGuide').click();
  await expect(page.locator('#mv90Wild')).toBeVisible();
  await expect(page.locator('#collectionMine')).toBeChecked();
  await expect(page.locator('#collectionList')).toContainText('カブトムシ');
  await expect(page.locator('#collectionList')).not.toContainText('トンボ');
  await page.evaluate(() => window.testSwitchUser(null));
  await expect(page.locator('#collectionMine')).not.toBeChecked();
  await expect(page.locator('#collectionMineLabel')).toBeHidden();
  await expect(page.locator('#mvDiscoveryCount')).toHaveText('0 / 3');
  expect(errors).toEqual([]);
});

test('Gemini receives a photo only after explicit confirmation',async({page})=>{
  const errors=await setup(page);
  await page.evaluate(()=>{
    window.testAiCalls=[];
    const originalInvoke=window.db.functions.invoke;
    window.db.functions.invoke=async function(name,options){
      if(name!=='identify-insect-gemini')return originalInvoke.call(this,name,options);
      window.testAiCalls.push({name,hasPhoto:options.body.image.startsWith('data:image/jpeg;base64,')});
      return {data:{result:'最も可能性が高い虫の名前：カブトムシ'},error:null};
    };
  });
  await page.locator('.nav [data-tab="post"]').click();
  await page.locator('#species').fill('手入力の名前');
  await page.locator('#photo').setInputFiles({
    name:'test.png',mimeType:'image/png',
    buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'),
  });
  const identify=page.locator('#aiIdentify');
  let prompt='';
  page.once('dialog',async dialog=>{prompt=dialog.message();await dialog.dismiss()});
  await identify.click();
  expect(prompt).toContain('Google Gemini');
  expect(await page.evaluate(()=>window.testAiCalls)).toEqual([]);
  await expect(page.locator('#species')).toHaveValue('手入力の名前');

  page.once('dialog',dialog=>dialog.accept());
  await identify.click();
  await expect(page.locator('#species')).toHaveValue('カブトムシ');
  expect(await page.evaluate(()=>window.testAiCalls)).toEqual([
    {name:'identify-insect-gemini',hasPhoto:true},
  ]);
  expect(errors).toEqual([]);
});

test('a background map failure leaves observation pins usable',async({page})=>{
  const errors=await setup(page);
  await page.route('https://server.arcgisonline.com/**',route=>route.fulfill({status:503}));
  const tile=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  await page.route('https://tile.openstreetmap.org/**',route=>route.fulfill({contentType:'image/png',body:tile}));
  await page.locator('.nav [data-tab="map"]').click();
  const status=page.locator('#mapTileStatus');
  await expect(status).toContainText('地図の一部を読み込めませんでした');
  await expect(status).toBeVisible();
  await page.locator('#insectMap .leaflet-marker-icon').first().click();
  await expect(page.locator('#mapPostList')).toContainText('カブトムシ');

  await page.locator('#insectMap .leaflet-control-layers-base label').filter({hasText:'通常地図'}).click();
  await expect(status).toBeHidden();
  await expect(page.locator('#mapPostList')).toContainText('カブトムシ');
  expect(errors).toEqual([]);
});

test('kids mode blocks hidden home shortcuts and direct record or map tab clicks', async ({page}) => {
  const errors = await setup(page);
  await page.evaluate(() => {
    document.body.classList.add('mv128Kids');
    document.querySelector('.mvAdventurePrimary').click();
    document.querySelector('.nav [data-tab="map"]').click();
  });
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#home .mvAdventurePrimary')).toBeHidden();
  await expect(page.locator('#post')).toBeHidden();
  await expect(page.locator('#map')).toBeHidden();
  expect(errors).toEqual([]);
});
