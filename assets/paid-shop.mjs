import {createPaidDrawController} from './paid-draw-controller.mjs';
// Fixed release gate. Never derive this from remote flags, query parameters or localStorage.
const PURCHASED_DRAWS_RELEASE_APPROVED=false;
let refreshGeneration=0;
const client=()=>window.db;
const controller=createPaidDrawController({
 storage:localStorage,getUserID:()=>window.user?.id||null,enabled:()=>PURCHASED_DRAWS_RELEASE_APPROVED,
 withLock:navigator.locks?.request?(name,action)=>navigator.locks.request(name,action):null,
 transport:async(operation,userID)=>{
  const {data:session,error:sessionError}=await client().auth.getSession();
  if(sessionError||session.session?.user?.id!==userID||window.user?.id!==userID)throw Error('account_changed');
  const {data,error}=await client().functions.invoke('draw-purchased-gacha',{body:operation,headers:{Authorization:'Bearer '+session.session.access_token}});
  if(!error)return {status:200,data};
  const response=error.context;if(response instanceof Response){let data=null;try{data=await response.json()}catch{};return {status:response.status,data}}
  throw Error('draw_confirmation_pending');
 },
});
function mount(){
 const host=document.getElementById('mv134CoinStore');if(!host||document.getElementById('paidDrawControls'))return;
 const panel=document.createElement('div');panel.id='paidDrawControls';
 const heading=document.createElement('h3');heading.textContent='購入コインのガチャ（準備中）';
 const note=document.createElement('p');note.textContent='無料コイン・無料カードとは別にサーバーで管理します。現在は利用できません。';
 const status=document.createElement('p');status.id='paidDrawStatus';status.setAttribute('role','status');
 const results=document.createElement('p');results.id='paidDrawResults';
 panel.append(heading,note,status,results);
 for(const count of [1,10]){const button=document.createElement('button');button.type='button';button.disabled=true;button.dataset.paidCount=String(count);button.textContent=count+'回（'+(count===1?50:450)+'購入コイン・準備中）';
  button.addEventListener('click',async()=>{if(!PURCHASED_DRAWS_RELEASE_APPROVED)return;button.disabled=true;try{const data=await controller.draw(count);results.textContent=data.results.map(card=>window.MushiverseCardCatalog?.[card.card_id-1]?.name||'昆虫カード').join(' / ');status.textContent='購入コイン残高：'+data.balance}catch(error){status.textContent=error.message==='refund_review_required'?'返金の確認が必要です。サポートへお問い合わせください。':'結果の確認が必要です。未完了の要求は同じIDで再確認します。'}finally{void refresh()}});panel.append(button)}
 const retry=document.createElement('button');retry.id='retryPaidDraw';retry.type='button';retry.disabled=true;retry.textContent='未完了のガチャを再確認（準備中）';retry.onclick=async()=>{if(!PURCHASED_DRAWS_RELEASE_APPROVED)return;const operation=controller.pending();if(operation)panel.querySelector('[data-paid-count="'+operation.count+'"]').click()};panel.append(retry);
 host.append(panel);void refresh();
}
async function refresh(){
 const status=document.getElementById('paidDrawStatus');if(!status)return;
 const generation=++refreshGeneration,id=window.user?.id;
 for(const button of document.querySelectorAll('#paidDrawControls button'))button.disabled=true;
 if(!id||!client()?.from){status.textContent='購入コイン：ログイン後に確認できます';return}
 try{const {data,error}=await client().from('gacha_coin_wallets_v2').select('balance,debt').eq('user_id',id).eq('environment','Production').maybeSingle();if(generation!==refreshGeneration||window.user?.id!==id)return;if(error)throw error;
  const debt=Number(data?.debt||0);status.textContent=debt>0?'返金の確認が必要です。購入コインのガチャは停止しています。':'購入コイン残高：'+Number(data?.balance||0).toLocaleString('ja-JP')+'（使用は準備中）';
  const pending=controller.pending();if(pending)status.textContent+=' ／ 未完了のガチャがあります';
  for(const button of document.querySelectorAll('#paidDrawControls [data-paid-count]'))button.disabled=!PURCHASED_DRAWS_RELEASE_APPROVED||(pending?Number(button.dataset.paidCount)!==pending.count:debt>0);
  document.getElementById('retryPaidDraw').disabled=!PURCHASED_DRAWS_RELEASE_APPROVED||!pending;
 }catch{if(generation===refreshGeneration)status.textContent='購入コインのサーバー機能は準備中です'}
}
document.addEventListener('DOMContentLoaded',mount,{once:true});mount();
document.addEventListener('mushiverse:auth-changed',()=>{const result=document.getElementById('paidDrawResults');if(result)result.textContent='';void refresh()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});
