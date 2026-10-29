import {test,expect} from '@playwright/test';import {A,setup} from './helpers.mjs';
for(const size of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390}])test('iPhone navigation, collection, profile and ten-draw results remain usable '+size.width+'x'+size.height,async({page})=>{
 await page.setViewportSize(size);const errors=await setup(page,{coins:500,tickets:2,cards:1});
 for(const tab of ['home','gacha','collection','profile','home']){
  await page.locator('nav.nav [data-tab="'+tab+'"]').click();await expect(page.locator('main > section:not(.hide)')).toHaveAttribute('id',tab);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width+1);
 }
 await page.locator('nav.nav [data-tab="gacha"]').click();await page.locator('#mv77Ten').click();await expect(page.locator('#mv88Reveal .mv88Card')).toHaveCount(10);const close=page.locator('#mv88Reveal .mv88Close');await expect(close).toHaveText('ガチャに戻る');await close.click();await expect(page.locator('#mv88Reveal')).toHaveCount(0);
 await page.locator('nav.nav [data-tab="collection"]').click();await page.locator('#mv90GachaTab').click();await page.locator('#mv90CardList button:not([disabled])').first().click();await expect(page.locator('#mv90Dialog')).toBeVisible();await page.locator('#mv90Dialog .mv90Close').click();
 if(size.width===320)await page.screenshot({path:test.info().outputPath('iphone-se-collection.png')});
 expect(errors).toEqual([]);
});
test('AI master is integrated read-only with unapproved artwork and isolated ID ownership',async({page})=>{
 await setup(page);await page.evaluate(A=>localStorage.setItem('mushiverse-ai-collection-v1:user:'+A,JSON.stringify([{id:'AI-005',name:'旧名'}])),A);await page.locator('nav.nav [data-tab="collection"]').click();await page.locator('#aiInsectCollection summary').click();await expect(page.locator('#aiInsectCards article')).toHaveCount(100);await expect(page.locator('#aiInsectStatus')).toContainText('画像承認 0 / 100');await expect(page.locator('#aiInsectStatus')).toContainText('所持 1種類');await expect(page.locator('#aiInsectCards img')).toHaveCount(0);
 await page.locator('#aiInsectSearch').fill('AI-005');await expect(page.locator('#aiInsectCards article')).toHaveCount(1);await expect(page.locator('#aiInsectCards')).toContainText('クロガネシズクカミキリ');await expect(page.locator('#aiInsectCards')).toContainText('所持 1枚');
 await page.evaluate(()=>window.testSwitchUser(null));await expect(page.locator('#aiInsectStatus')).toContainText('所持 0種類');expect(await page.evaluate(A=>JSON.parse(localStorage.getItem('mushiverse-v77-game:user:'+A)).coins,A)).toBe(500);
});
test('coin SSR and ticket no-SSR behavior are deterministic at the rare boundary',async({page})=>{
 await setup(page,{coins:500,tickets:2});await page.evaluate(()=>{Math.random=()=>0});await page.locator('nav.nav [data-tab="gacha"]').click();await page.locator('#mv77Draw').click();await expect(page.locator('#mv88Reveal')).toHaveClass(/mv88-SSR/);await expect(page.locator('#mv88Reveal .mv88Card')).toHaveCount(1);await page.locator('#mv88Reveal .mv88Close').click();await page.locator('#mv77TicketDraw').click();await expect(page.locator('#mv88Reveal')).not.toHaveClass(/mv88-SSR/);expect(await page.evaluate(A=>JSON.parse(localStorage.getItem('mushiverse-v77-game:user:'+A)).cards.map(c=>c.rarity),A)).toEqual(['SSR','SR']);
});
