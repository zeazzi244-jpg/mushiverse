import { test, expect } from '@playwright/test';
test.describe('AI insect gallery preview',()=>{
 test.beforeEach(async({page})=>{await page.goto('/ai-insect-gallery-preview.html');});
 test('renders 100 catalog entries without missing JSON',async({page})=>{
  await expect(page.locator('#error')).toBeEmpty();
  await expect(page.locator('.card')).toHaveCount(100);
  await expect(page.locator('#stats')).toContainText('100 / 100');
  await expect(page.locator('.card').first()).toContainText('AI-001');
  await expect(page.locator('.card').last()).toContainText('AI-100');
 });
 test('filters rarity accurately',async({page})=>{
  for(const [rarity,count] of [['N',40],['R',30],['SR',20],['SSR',10]]){
   await page.getByRole('button',{name:rarity,exact:true}).click();
   await expect(page.locator('.card')).toHaveCount(count);
   await expect(page.locator('#stats')).toContainText(count+' / 100');
  }
 });
 test('searches canonical names and IDs',async({page})=>{
  const search=page.getByRole('searchbox',{name:'名前・番号で検索'});
  await search.fill('AI-005');
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card')).toContainText('クロガネシズクカミキリ');
  await search.fill('AI-999');
  await expect(page.locator('.card')).toHaveCount(0);
 });
 test('mobile layout does not overflow viewport',async({page})=>{
  await expect(page.locator('.card')).toHaveCount(100);
  const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport);
 });
});
