import {test,expect} from '@playwright/test';
import {A,B,setup} from './helpers.mjs';
const POST='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function otherPost(page){
 const errors=await setup(page);
 await page.evaluate(B=>{window.testRows[0].user_id=B},B);
 await page.locator('#loadMore').click();
 await page.locator('#feed [data-detail]').first().click();
 await expect(page.locator('[data-report-post]')).toBeVisible();
 return errors;
}
test('cancelled or too-short report never writes or hides the post',async({page})=>{
 const errors=await otherPost(page);
 page.once('dialog',d=>d.dismiss());
 await page.locator('[data-report-post]').click();
 page.once('dialog',d=>d.accept('短'));
 await page.locator('[data-report-post]').click();
 await expect(page.locator('#toast')).toContainText('3〜500文字');
 expect(await page.evaluate(()=>window.testWrites.filter(x=>x.table==='content_reports'))).toHaveLength(0);
 await expect(page.locator('#feed')).toContainText('カブトムシ');
 expect(errors).toEqual([]);
});
test('failed report preserves the visible post and a retry submits the authenticated payload',async({page})=>{
 const errors=await otherPost(page);
 await page.evaluate(()=>{window.testQueryHook=({table})=>table==='content_reports'?{data:null,error:{message:'test rejected'}}:null});
 page.once('dialog',d=>d.accept('テスト通報の理由'));
 await page.locator('[data-report-post]').click();
 await expect(page.locator('#toast')).toContainText('通報の送信に失敗');
 await expect(page.locator('#detailModal')).toHaveClass(/open/);
 await expect(page.locator('#feed')).toContainText('カブトムシ');
 await page.evaluate(()=>{window.testQueryHook=null});
 page.once('dialog',d=>d.accept('テスト通報の理由'));
 await page.locator('[data-report-post]').click();
 await expect(page.locator('#toast')).toContainText('運営への通報を受け付けました');
 await expect(page.locator('#feed')).not.toContainText('カブトムシ');
 const writes=await page.evaluate(()=>window.testWrites.filter(x=>x.table==='content_reports'));
 expect(writes).toHaveLength(2);
 expect(writes[1]).toMatchObject({action:'insert',payload:{reporter_id:A,post_id:POST,reason:'テスト通報の理由'}});
 expect(errors).toEqual([]);
});
test('author hiding removes records and persists after reload without server deletion',async({page})=>{
 const errors=await otherPost(page);
 await page.locator('[data-block-user]').click();
 await expect(page.locator('#feed')).not.toContainText('カブトムシ');
 await page.locator('.nav [data-tab="collection"]').click();
 await expect(page.locator('#collectionList')).not.toContainText('カブトムシ');
 await page.locator('.nav [data-tab="map"]').click();
 await expect(page.locator('#insectMap .leaflet-marker-icon')).toHaveCount(0);
 expect(await page.evaluate(()=>window.testWrites.filter(x=>x.action==='delete'))).toHaveLength(0);
 await page.reload();
 await expect.poll(()=>page.evaluate(()=>window.records?.length)).toBe(1);
 await expect(page.locator('#feed')).not.toContainText('カブトムシ');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('mushiverse-blocked-users-v1')))).toContain(B);
 expect(errors).toEqual([]);
});
test('deletion requires typed confirmation and cancelling never contacts the server',async({page})=>{
 const errors=await setup(page);
 await expect(page.locator('#v34DeleteConfirm')).toHaveCount(1);
 await page.evaluate(async()=>{
  window.testDeleteCalls=0;
  window.db.functions.invoke=async()=>{window.testDeleteCalls++;return {data:{deleted:true},error:null}};
  document.getElementById('v34DeleteConfirm').value='';
  await v34DeleteAccount();
  document.getElementById('v34DeleteConfirm').value='削除';
  window.confirm=()=>false;
  await v34DeleteAccount();
 });
 expect(await page.evaluate(()=>window.testDeleteCalls)).toBe(0);
 expect(await page.evaluate(A=>localStorage.getItem('mushiverse-v77-game:user:'+A),A)).not.toBeNull();
 expect(await page.evaluate(()=>window.user?.id)).toBe(A);
 expect(errors).toEqual([]);
});
test('unconfirmed or failed deletion never clears saved data or signs the user out',async({page})=>{
 const errors=await setup(page);
 await expect(page.locator('#v34DeleteConfirm')).toHaveCount(1);
 const before=await page.evaluate(A=>localStorage.getItem('mushiverse-v77-game:user:'+A),A);
 for(const response of [{data:{deleted:false},error:null},{data:null,error:{message:'test unavailable'}}]){
  await page.evaluate(async response=>{
   window.db.functions.invoke=async()=>response;
   document.getElementById('v34DeleteConfirm').value='削除';
   window.confirm=()=>true;
   await v34DeleteAccount();
  },response);
  await expect(page.locator('#toast')).toContainText('削除済み扱いにはしません');
  expect(await page.evaluate(A=>localStorage.getItem('mushiverse-v77-game:user:'+A),A)).toBe(before);
  expect(await page.evaluate(()=>window.user?.id)).toBe(A);
 }
 expect(errors).toEqual([]);
});
