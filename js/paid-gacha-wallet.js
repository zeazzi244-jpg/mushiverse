(() => {
  'use strict';
  const SERVICE = 'paid-gacha-wallet';
  const STORAGE = 'mushiverse-paid-draw-pending:';
  const byID = id => document.getElementById(id);
  const kids = () => document.body.classList.contains('mv128Kids') ||
    localStorage.getItem('mushiverse-display-mode-v1') === 'kids';
  let busy = false, account = '', balance = 0, page = 0, hasMore = false, draws = [], drawsEnabled = false, refundHeld = false;

  function pendingKey() { return STORAGE + account; }
  function pendingRead() {
    const key = pendingKey();
    const saved = localStorage.getItem(key);
    if (saved !== null) return JSON.parse(saved);
    const legacy = sessionStorage.getItem(key);
    if (legacy === null) return null;
    const pending = JSON.parse(legacy);
    localStorage.setItem(key, legacy);
    sessionStorage.removeItem(key);
    return pending;
  }
  function pendingSave(value) {
    const key = pendingKey();
    if (value) localStorage.setItem(key, JSON.stringify({id:value.id, count:value.count}));
    else {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    }
  }
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
    const name = id === 101 ? '創世の白蝶・アルバセラフ' : roster[id-1]?.name;
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
    byID('mvPaidCoinBalance').textContent = balance.toLocaleString('ja-JP') + ' 購入コイン' +
      (refundHeld ? '（Apple返金の精算確認中）' : drawsEnabled ? '' : '（有料ガチャは現在停止中）');
    let pending, storageFailed = false;
    try { pending = pendingRead(); }
    catch { storageFailed = true; message('未完了の抽選を読み込めません。アプリを開き直してください。'); }
    byID('mvPaidCoinSingle').disabled = !drawsEnabled || busy || balance < 50 || storageFailed || !!pending;
    byID('mvPaidCoinTen').disabled = !drawsEnabled || busy || balance < 450 || storageFailed || !!pending;
    byID('mvPaidCoinRetry').hidden = !pending;
    byID('mvPaidCoinRetry').disabled = !drawsEnabled || busy;
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
    if (busy) return;
    if(!user) {
      account=''; balance=0; draws=[]; drawsEnabled=false; refundHeld=false; render(); return;
    }
    if(account !== user.id) { account=user.id; balance=0; draws=[]; drawsEnabled=false; refundHeld=false; page=0; reset=true; }
    busy=true; render();
    try {
      const requestPage=reset?0:page+1;
      const result=await invoke({action:'status',page:requestPage});
      if(!result.ok || !Number.isSafeInteger(result.balance) || result.balance<0 || !Array.isArray(result.draws))
        throw Error('残高情報を確認できませんでした。');
      // Never show one user's wallet after an asynchronous account switch.
      if((await sessionUser())?.id!==user.id) { account=''; balance=0; draws=[]; drawsEnabled=false; refundHeld=false; return; }
      balance=result.balance;
      drawsEnabled=result.draws_enabled===true;
      refundHeld=result.refund_reconciliation_required===true;
      draws=reset?result.draws:[...draws,...result.draws];
      page=requestPage; hasMore=result.has_more===true;
      const pending=pendingRead();
      if(pending && draws.some(row=>row.draw_id===pending.id)) pendingSave(null);
      message(refundHeld
        ? 'Appleの返金を確認しました。購入コインの精算が必要なため、有料ガチャは一時停止しています。獲得カードと履歴は残ります。'
        : drawsEnabled
          ? '購入コインはサーバーで管理されます。無料コインとは別残高です。'
          : '購入コインの残高と獲得履歴は確認できます。有料ガチャは現在停止中です。');
    } catch(error) { message(error?.message || '残高情報を取得できませんでした。'); }
    finally { busy=false; render(); }
  }

  async function draw(count, retry=false) {
    if(busy || kids() || !account || !drawsEnabled) return;
    const user=await sessionUser();
    if(busy) return;
    if(!user || user.id!==account) { account='';render();return; }
    let pending;
    try { pending=pendingRead(); } catch { message('未完了の抽選を確認できません。アプリを開き直してください。'); return; }
    if(pending && !retry) { message('未確認の購入コインガチャがあります。再確認を押してください。');render();return; }
    if(!pending && retry) { await refresh(); return; }
    if(!pending) {
      if(!window.crypto?.randomUUID) { message('安全な抽選IDを生成できませんでした。');return; }
      pending={id:window.crypto.randomUUID(),count};
      try { pendingSave(pending); } catch { message('抽選IDを保存できません。もう一度お試しください。'); return; }
    }
    if(![1,10].includes(pending.count) || typeof pending.id!=='string') { pendingSave(null);return; }
    busy=true;render();
    try {
      const receipt=await invoke({action:'draw',draw_id:pending.id,count:pending.count});
      if ((await sessionUser())?.id !== user.id || account !== user.id) { account=''; render(); return; }
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
    const odds=document.createElement('p');
    odds.textContent='1枚ごとの排出率：SSR 0.1%、SR 1.9%、R 18%。残り80%はNで、限定LRの在庫がある間はそのうち全抽選の0.01%がLRになります。10回とも同じ条件です。';
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
    panel.append(heading,intro,odds,amount,actions,status,history);
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
