(() => {
  'use strict';
  const SERVICE = 'paid-gacha-wallet';
  const STORAGE = 'mushiverse-paid-draw-pending:';
  const byID = id => document.getElementById(id);
  const kids = () => document.body.classList.contains('mv128Kids') ||
    localStorage.getItem('mushiverse-display-mode-v1') === 'kids';
  let busy = false, account = '', balance = 0, page = 0, hasMore = false, draws = [];

  function pendingKey() { return STORAGE + account; }
  function pendingRead() { try { return JSON.parse(sessionStorage.getItem(pendingKey()) || 'null'); } catch { return null; } }
  function pendingSave(value) { try { if(value) sessionStorage.setItem(pendingKey(),JSON.stringify(value)); else sessionStorage.removeItem(pendingKey()); } catch {} }
  const message = text => { const node = byID('mvPaidCoinMessage'); if (node) node.textContent = text; };

  async function sessionUser() {
    if (!window.db?.auth?.getSession || kids()) return null;
    const {data,error} = await window.db.auth.getSession();
    if(error || !data?.session?.user?.id || !data.session.access_token ||
       window.user?.id !== data.session.user.id) return null;
    return data.session.user;
  }

  async function invoke(body) {
    if (!window.db?.functions?.invoke) throw Error('課金サーバーに接続できません');
    const {data,error} = await window.db.functions.invoke(SERVICE, {body});
    if (error || !data) throw Error('通信に失敗しました。もう一度お試しください。');
    return data;
  }

  function cardElement(card) {
    const id = Number(card?.card_id);
    const rarity = String(card?.rarity || 'N');
    const roster = window.mushiverseClassicCards || [];
    const name = id === 101 ? 'アルバセラフ' : roster[id-1]?.name;
    const row = document.createElement('li');
    row.className = 'mvPaidCoinCard';
    if (!name || !['N','R','SR','SSR','LR'].includes(rarity)) {
      row.textContent = 'カード情報を取得できません';
      return row;
    }
    const art = window.mushiverseCardArt?.(name,rarity);
    if (art instanceof Element) row.append(art);
    const label = document.createElement('span');
    label.textContent = '['+rarity+'] '+name+(card.edition ? ' · 第'+card.edition+'号' : '');
    row.append(label);
    return row;
  }

  function render() {
    const panel = byID('mvPaidCoinPanel'); if (!panel) return;
    panel.hidden = !account || kids();
    if (panel.hidden) return;
    byID('mvPaidCoinBalance').textContent = balance.toLocaleString('ja-JP') + ' 購入コイン';
    byID('mvPaidCoinSingle').disabled = busy || balance < 50 || !!pendingRead();
    byID('mvPaidCoinTen').disabled = busy || balance < 450 || !!pendingRead();
    byID('mvPaidCoinRetry').hidden = !pendingRead();
    byID('mvPaidCoinMore').hidden = !hasMore;
    const list = byID('mvPaidCoinHistory');
    list.replaceChildren();
    let count = 0;
    for (const draw of draws) {
      for (const result of Array.isArray(draw.results) ? draw.results : []) {
        if (++count > 300) break;
        list.append(cardElement(result));
      }
      if(count > 300)break;
    }
    if(!list.children.length){
      const li = document.createElement('li'); li.textContent='有料ガチャの獲得カードはまだありません。'; list.append(li);
    }
  }

  async function refresh(reset=true) {
    if (busy) return;
    const user = await sessionUser();
    if(!user) {
      account=''; balance=0; draws=[]; render(); return;
    }
    if(account !== user.id) { account=user.id; balance=0; draws=[]; page=0; reset=true; }
    busy=true; render();
    try {
      const requestPage=reset?0:page+1;
      const result=await invoke({action:'status',page:requestPage});
      if(!result.ok || !Number.isSafeInteger(result.balance) || result.balance<0 || !Array.isArray(result.draws))
        throw Error('残高情報を確認できませんでした。');
      // Never show one user's wallet after an asynchronous account switch.
      if((await sessionUser())?.id!==user.id) { account=''; balance=0; draws=[]; return; }
      balance=result.balance;
      draws=reset?result.draws:[...draws,...result.draws];
      page=requestPage; hasMore=result.has_more===true;
      const pending=pendingRead();
      if(pending && draws.some(row=>row.draw_id===pending.id)) pendingSave(null);
      message('購入コインはサーバーで管理されます。無料コインとは別残高です。');
    } catch(error) { message(error?.message || '残高情報を取得できませんでした。'); }
    finally { busy=false; render(); }
  }

  async function draw(count, retry=false) {
    if(busy || kids() || !account) return;
    const user=await sessionUser();
    if(!user || user.id!==account) { account='';render();return; }
    let pending=pendingRead();
    if(pending && !retry) { message('未確認の購入コインガチャがあります。再確認を押してください。');render();return; }
    if(!pending) {
      if(!crypto?.randomUUID) { message('安全な抽選IDを生成できませんでした。');return; }
      pending={id:crypto.randomUUID(),count};
      pendingSave(pending);
    }
    if(![1,10].includes(pending.count) || typeof pending.id!=='string') { pendingSave(null);return; }
    busy=true;render();
    try {
      const receipt=await invoke({action:'draw',draw_id:pending.id,count:pending.count});
      if(receipt.error==='insufficient_balance') {
        pendingSave(null); message('購入コインが不足しています。'); return;
      }
      if(!receipt.ok || receipt.draw_id!==pending.id || !Array.isArray(receipt.results) ||
          receipt.results.length!==pending.count || !Number.isSafeInteger(receipt.balance))
        throw Error('抽選結果の確認に失敗しました。同じ抽選IDで再確認してください。');
      // Always recover from the server ledger, never fabricate paid cards locally.
      pendingSave(null);
      balance=receipt.balance;
      message('購入コインガチャ '+pending.count+'回の結果を確認しました。');
    } catch(error) {
      message(error?.message || '結果を確認できませんでした。再確認してください。');
    } finally { busy=false;render(); }
    await refresh();
  }

  function mount() {
    const gacha = byID('gacha');
    if (!gacha || byID('mvPaidCoinPanel')) return;
    const panel = document.createElement('section');
    panel.id='mvPaidCoinPanel'; panel.hidden=true;
    panel.setAttribute('aria-label','購入コイン専用ガチャ');
    const heading=document.createElement('h2');heading.textContent='購入コイン専用ガチャ';
    const intro=document.createElement('p');intro.textContent='購入コインは無料コインと別管理です。1回50コイン、10回450コイン。抽選と残高の減算はサーバーが行います。';
    const amount=document.createElement('strong');amount.id='mvPaidCoinBalance';
    const actions=document.createElement('div');actions.className='mvPaidCoinActions';
    const make=(id,label,handler)=>{
      const btn=document.createElement('button');btn.type='button';btn.id=id;btn.textContent=label;
      btn.addEventListener('click',handler);actions.append(btn);return btn;
    };
    make('mvPaidCoinSingle','1回引く · 50コイン',()=>draw(1));
    make('mvPaidCoinTen','10回引く · 450コイン',()=>draw(10));
    make('mvPaidCoinRetry','未完了の有料ガチャを再確認',()=>draw(1,true));
    make('mvPaidCoinRefresh','購入コイン残高を更新',()=>refresh());
    make('mvPaidCoinMore','過去の有料カードをもっと見る',()=>refresh(false));
    const status=document.createElement('p');status.id='mvPaidCoinMessage';status.setAttribute('role','status');
    const history=document.createElement('ul');history.id='mvPaidCoinHistory';
    panel.append(heading,intro,amount,actions,status,history);
    const shop=byID('mv134CoinStore');
    if(shop?.parentElement===gacha) shop.insertAdjacentElement('afterend',panel);
    else gacha.append(panel);
    const style=document.createElement('style');
    style.textContent='#mvPaidCoinPanel{margin:18px 0;padding:16px;border:1px solid #71967b;border-radius:16px;background:#102b22;color:#f3f9ee}#mvPaidCoinPanel h2{margin:0 0 10px;font-size:19px;color:#fff}#mvPaidCoinPanel p{line-height:1.6}#mvPaidCoinPanel strong{display:block;margin:12px 0;font-size:18px}.mvPaidCoinActions{display:flex;gap:8px;flex-wrap:wrap}.mvPaidCoinActions button{min-height:44px;border-radius:10px;border:1px solid #eadca4;background:#e3d1a5;color:#172a21;padding:10px;font-weight:700}.mvPaidCoinActions button:disabled{background:#c3cec1;color:#475949}.mvPaidCoinActions button[hidden]{display:none}#mvPaidCoinHistory{list-style:none;padding:0;display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}.mvPaidCoinCard{border:1px solid #537763;padding:8px;border-radius:12px;overflow-wrap:anywhere}.mvPaidCoinCard img{max-width:100%}body.mv128Kids #mvPaidCoinPanel{display:none!important}';
    document.head.append(style);
    render();void refresh();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
  document.addEventListener('mushiverse:profile-account',()=>{void refresh();});
  document.addEventListener('click',event=>{
    if(event.target.closest?.('[data-tab="gacha"]')) {mount();void refresh();}
  },true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
})();
