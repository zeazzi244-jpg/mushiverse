import {test,expect} from '@playwright/test';
const key='mushiverse-v77-game:guest';
test.describe('beta gacha economy',()=>{
 test.beforeEach(async({page})=>{
  await page.addInitScript(({key})=>{
   localStorage.setItem(key,JSON.stringify({coins:500,tickets:2,streak:0,lastClaim:'',cards:[],history:[]}));
  },{key});
  await page.goto('/');
  await expect(page.locator('#mv77Draw')).toBeAttached();
 });
 test('coin draw spends 50 coins even when tickets exist',async({page})=>{
  await page.locator('#mv77Draw').click();
  await expect.poll(async()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{}').cards?.length,key)).toBe(1);
  const wallet=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  expect(wallet.coins).toBe(450);
  expect(wallet.tickets).toBe(2);
 });
 test('ticket draw spends only a ticket and never produces SSR',async({page})=>{
  await page.locator('#mv77TicketDraw').click();
  await expect.poll(async()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{}').cards?.length,key)).toBe(1);
  const wallet=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  expect(wallet.coins).toBe(500);
  expect(wallet.tickets).toBe(1);
  expect(wallet.cards[0].rarity).not.toBe('SSR');
 });
 test('ten draws cost 450 coins without spending tickets',async({page})=>{
  await page.locator('#mv77Ten').click();
  await expect.poll(async()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{}').cards?.length,key)).toBe(10);
  const wallet=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  expect(wallet.coins).toBe(50);
  expect(wallet.tickets).toBe(2);
 });
 test('first daily claim grants five coins once only',async({page})=>{
 await page.locator('#mv77Claim').click();
 await expect.poll(async()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{}').coins,key)).toBe(505);
 await expect(page.locator('#mv77Claim')).toBeDisabled();
 await page.reload();
 await expect(page.locator('#mv77Claim')).toBeDisabled();
 const wallet=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 expect(wallet.coins).toBe(505);
});

});
