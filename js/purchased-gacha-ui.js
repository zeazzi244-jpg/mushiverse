(() => {
  'use strict';
  // Paid coins are server-owned. Never merge them with local free coins.
  const endpoint = 'https://jhowxtdemlsmetcwhekr.supabase.co/functions/v1/purchased-gacha-draw';
  const storagePrefix = 'mushiverse-purchased-draw-pending:';
  let busy = false;
  let accountGeneration = 0;
  function clearAccountView() {
    accountGeneration++;
    if ($('mvPaidBalance')) $('mvPaidBalance').textContent = 'ログイン状態を確認してください。';
    if ($('mvPaidHistory')) $('mvPaidHistory').replaceChildren();
    for (const id of ['mvPaidOne','mvPaidTen']) if ($(id)) $(id).disabled = true;
    if ($('mvPaidStatus')) $('mvPaidStatus').textContent = '';
  }
  const $ = id => document.getElementById(id);
  const kids = () => document.body.classList.contains('mv128Kids') ||
    localStorage.getItem('mushiverse-display-mode-v1') === 'kids';
  const cardName = (item) => {
    if (item?.rarity === 'LR' && item?.card_id === 101) return 'アルバセラフ';
    const n = Number(item?.card_id);
    const all = window.mushiverseClassicCards;
    return Number.isInteger(n) && n >= 1 && n <= 100 && Array.isArray(all) &&
      all[n-1]?.name ? all[n-1].name : 'カード #'+String(item?.card_id ?? '?');
  };

  function mount() {
    if ($('mvPaidGacha') || $('mvPaidCoinPanel') || !$('gacha')) return;
    const panel = document.createElement('section');
    panel.id = 'mvPaidGacha';
    panel.setAttribute('aria-label','購入コイン専用ガチャ');
    panel.innerHTML = `<h2>購入コイン専用ガチャ</h2>
      <p>購入したコインはサーバーに保存され、無料コインとは別に管理されます。</p>
      <p id="mvPaidBalance" aria-live="polite">残高を確認中…</p>
      <div class="mvPaidActions">
        <button id="mvPaidRefresh" type="button">購入コイン残高を更新</button>
        <button id="mvPaidOne" type="button" disabled>購入コインで1回 · 50コイン</button>
        <button id="mvPaidTen" type="button" disabled>購入コインで10回 · 450コイン</button>
      </div>
      <p id="mvPaidStatus" role="status" aria-live="polite"></p>
      <h3>購入コインガチャの履歴</h3>
      <ul id="mvPaidHistory"></ul>`;
    const style = document.createElement('style');
    style.textContent = `#mvPaidGacha{margin:16px 0;padding:16px;border-radius:16px;background:#102b22;border:1px solid #6d9379;color:#f5f8ee}
      #mvPaidGacha :is(h2,h3,p){color:#f5f8ee}
      #mvPaidGacha .mvPaidActions{display:flex;flex-wrap:wrap;gap:8px}
      #mvPaidGacha button{min-height:44px;border-radius:10px;padding:10px 12px;border:1px solid #f0dfaa;background:#edd69a;color:#203325;font-weight:700}
      #mvPaidGacha button:disabled{background:#c4d0c2;color:#36493d;opacity:1}
      #mvPaidGacha li{margin:8px 0;line-height:1.5}
      body.mv128Kids #mvPaidGacha{display:none!important}`;
    document.head.append(style);
    $('gacha').append(panel);
    $('mvPaidRefresh').addEventListener('click',refresh);
    $('mvPaidOne').addEventListener('click',()=>draw(1));
    $('mvPaidTen').addEventListener('click',()=>draw(10));
    refresh();
  }

  async function session() {
    const {data,error} = await window.db?.auth?.getSession?.() ?? {};
    const current=data?.session;
    if(error || !current?.access_token || !current?.user?.id ||
       window.user?.id!==current.user.id) return null;
    return current;
  }
  const buttonsDisabled = disabled => {
    for(const id of ['mvPaidRefresh','mvPaidOne','mvPaidTen']) if($(id)) $(id).disabled=disabled;
  };
  async function request(method, token, body) {
    const res=await fetch(endpoint, {
      method,headers:{Authorization:'Bearer '+token,'content-type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'
    });
    const data=await res.json();
    return {status:res.status,data};
  }
  async function refresh() {
    if(busy || !$('mvPaidBalance')) return;
    busy=true; buttonsDisabled(true);
    const generation = accountGeneration;
    try {
      if(kids()) { $('mvPaidBalance').textContent='キッズモードでは利用できません。';return; }
      const active=await session();
      if(!active){$('mvPaidBalance').textContent='ログイン後に利用できます。';return;}
      const result=await request('GET',active.access_token);
      if (generation !== accountGeneration) return;
      if(result.status!==200 || result.data?.ok!==true){
        $('mvPaidBalance').textContent='本番課金は準備中です。購入コインの利用はまだできません。';
        return;
      }
      const coins=result.data.balance;
      if(!Number.isSafeInteger(coins)||coins<0)throw Error('invalid_balance');
      const enabled=result.data.draws_enabled===true;
      $('mvPaidBalance').textContent='購入コイン残高：'+coins.toLocaleString('ja-JP')+' コイン'+
        (enabled?'':'（有料ガチャは現在停止中）');
      $('mvPaidOne').disabled=!enabled||coins<50;
      $('mvPaidTen').disabled=!enabled||coins<450;
      const list=$('mvPaidHistory');list.replaceChildren();
      const history=Array.isArray(result.data.history)?result.data.history:[];
      if(!history.length){const li=document.createElement('li');li.textContent='有料ガチャの履歴はありません。';list.append(li);}
      for(const entry of history){
        const li=document.createElement('li');
        const items=Array.isArray(entry.results)?entry.results:[];
        li.textContent=String(entry.draw_count??items.length)+'回 · '+items.map(c=>String(c.rarity??'?')+' '+cardName(c)).join('、');
        list.append(li);
      }
    } catch {
      $('mvPaidBalance').textContent='購入コイン残高を読み込めませんでした。';
    } finally {
      busy=false;
      $('mvPaidRefresh').disabled=false;
      if(generation !== accountGeneration) queueMicrotask(refresh);
    }
  }

  async function draw(count){
    if(busy || kids())return;
    busy=true; buttonsDisabled(true);
    const status=$('mvPaidStatus');
    try {
      const active=await session();
      if(!active){status.textContent='ログインが必要です。';return;}
      const key=storagePrefix+active.user.id;
      let pending;
      try {pending=JSON.parse(localStorage.getItem(key)??'null');}catch{pending=null;}
      if(pending && pending.count!==count){
        status.textContent='未完了の抽選があります。最初の回数のボタンで再確認してください。';
        return;
      }
      if(!pending) {
        pending={draw_id:crypto.randomUUID(),count};
        localStorage.setItem(key,JSON.stringify(pending));
      }
      const generation = accountGeneration;
      const response=await request('POST',active.access_token,pending);
      if(generation !== accountGeneration) return;
      if(response.status===409 && response.data.error==='insufficient_balance'){
        localStorage.removeItem(key);
        status.textContent='購入コインが足りません。';
        return;
      }
      if(response.status!==200||response.data?.ok!==true){
        status.textContent='抽選は確定できませんでした。同じボタンでもう一度確認してください。';
        return;
      }
      if(!Array.isArray(response.data.results)||response.data.results.length!==count){
        status.textContent='結果の確認に失敗しました。再確認してください。';
        return;
      }
      localStorage.removeItem(key);
      status.textContent='獲得：'+response.data.results.map(c=>String(c.rarity??'?')+' '+cardName(c)).join('、');
      document.dispatchEvent(new CustomEvent('mushiverse:purchased-gacha-drawn',{detail:{count}}));
    }catch{
      status.textContent='通信が中断しました。同じボタンで購入コインの抽選結果を再確認してください。';
    }finally{
      busy=false;await refresh();
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
  document.addEventListener('mushiverse:profile-account',()=>{clearAccountView();if($('mvPaidGacha'))queueMicrotask(refresh);});
  document.addEventListener('click',e=>{if(e.target?.closest?.('[data-tab="gacha"]'))queueMicrotask(refresh);},true);
})();
