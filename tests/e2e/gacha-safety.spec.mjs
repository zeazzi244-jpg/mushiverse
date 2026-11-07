import {test,expect} from '@playwright/test';import {A,B,setup} from './helpers.mjs';
const key='mushiverse-v77-game:user:'+A;
const wallet=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const open=page=>page.locator('nav.nav [data-tab="gacha"]').click();
test('seven daily rewards total 65, repeat clicks and reload do not grant twice',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-01T12:00:00+09:00'));await setup(page,{coins:0});await open(page);
 let sum=0;for(const [i,reward] of [5,5,10,5,10,10,20].entries()){
  await page.clock.setFixedTime(new Date('2026-11-'+String(i+1).padStart(2,'0')+'T12:00:00+09:00'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.locator('#mv77Claim').click();sum+=reward;await expect.poll(async()=>(await wallet(page)).coins).toBe(sum);await expect(page.locator('#mv77Claim')).toBeDisabled();
  await page.evaluate(()=>document.getElementById('mv77Claim').click());expect((await wallet(page)).coins).toBe(sum);
 }
 await page.reload();expect((await wallet(page)).coins).toBe(65);await expect(page.locator('#mv77Claim')).toBeDisabled();
});
test('two tabs draw from fresh shared balance without losing old or newly awarded cards',async({page,context})=>{
 await setup(page,{coins:100,cards:300});await open(page);const second=await context.newPage();await setup(second);await open(second);
 await Promise.all([page.evaluate(()=>document.getElementById('mv77Draw').click()),second.evaluate(()=>document.getElementById('mv77Draw').click())]);
 await expect.poll(async()=>(await wallet(page)).cards.length).toBe(302);expect((await wallet(page)).coins).toBe(0);
});
test('draw save failure never consumes coins, tickets or cards',async({page})=>{
 await setup(page,{coins:500,tickets:2,cards:3,failSave:true});await open(page);await page.locator('#mv77Draw').click();expect((await wallet(page)).coins).toBe(500);expect((await wallet(page)).cards.length).toBe(3);expect((await wallet(page)).tickets).toBe(2);await expect(page.locator('#mv88Reveal')).toHaveCount(0);await expect(page.locator('#mv77Result')).toContainText('保存に失敗');
});
for(const raw of ['{broken',JSON.stringify({coins:500,cards:'broken'}),JSON.stringify({coins:'Infinity',cards:[]})])test('invalid wallet is preserved without claims or draws: '+raw,async({page})=>{
 await setup(page,{rawWallet:raw});await open(page);await expect(page.locator('#mv77Claim')).toBeDisabled();await expect(page.locator('#mv77Draw')).toBeDisabled();await expect(page.locator('#mv77Result')).toContainText('データは変更せず');expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(raw);
});
test('unknown legacy cards survive a later draw and reload unchanged',async({page})=>{
 const unknown={name:'旧版のカード',rarity:'LEGACY',id:'legacy-123',custom:{keep:true}};await setup(page,{extraCards:[unknown,null]});await open(page);await page.locator('#mv77Draw').click();await expect.poll(async()=>(await wallet(page)).cards.length).toBe(3);expect((await wallet(page)).cards.slice(0,2)).toEqual([unknown,null]);await page.reload();expect((await wallet(page)).cards.slice(0,2)).toEqual([unknown,null]);
});
test('account change dismisses reveal and releases its keyboard handler',async({page})=>{
 await setup(page,{coins:500});await open(page);await page.locator('#mv77Draw').click();await expect(page.locator('#mv88Reveal')).toBeVisible();await page.evaluate(B=>window.testSwitchUser(B),B);await expect(page.locator('#mv88Reveal')).toHaveCount(0);await page.locator('nav.nav [data-tab="profile"]').click();await page.locator('#mv86ProfileEdit').click();await page.locator('#mv86EditName').focus();await page.keyboard.press('Tab');await expect(page.locator('#mv86EditBio')).toBeFocused();expect((await wallet(page)).coins).toBe(450);
});
test('no Web Locks fails closed without modifying the saved wallet',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'locks',{value:undefined}));await setup(page);await open(page);await expect(page.locator('#mv77Claim')).toBeDisabled();await expect(page.locator('#mv77Draw')).toBeDisabled();expect((await wallet(page)).coins).toBe(500);
});

test('reward overflow leaves the previous balance and claim date untouched',async({page})=>{await setup(page,{coins:Number.MAX_SAFE_INTEGER});await open(page);await page.locator('#mv77Claim').click();expect((await wallet(page)).coins).toBe(Number.MAX_SAFE_INTEGER);expect((await wallet(page)).lastClaim).toBe('');await expect(page.locator('#mv77Result')).toContainText('安全な保存範囲')});
