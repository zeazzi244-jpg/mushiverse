(() => {
  'use strict';
  const byRarity = {
    N: 'gacha-n.webp', R: 'gacha-r.webp', SR: 'gacha-sr.webp', SSR: 'gacha-ssr.webp',
    LR: 'albaseraph.webp'
  };
  const reported = new Set();
  // Resolve assets from this script, not the current page URL. This also works
  // when the WebView is opened through a nested route or a custom app origin.
  const scriptUrl = document.currentScript?.src || document.baseURI;
  const cardBase = new URL('../assets/cards/', scriptUrl);
  const rootCardBase = new URL('assets/cards/', document.baseURI);
  const tried = new Set();

  window.mushiverseCardArt = (rarity, eager = false) => {
    const art = document.createElement('div');
    art.className = 'mvSharedCardArt';
    const image = document.createElement('img');
    const imageName = byRarity[rarity] || byRarity.N;
    image.alt = rarity === 'LR' ? '創世の白蝶・アルバセラフ' : rarity + 'のイメージイラスト';
    image.loading = eager ? 'eager' : 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      // Older installed WebViews may retain a stale script URL after an update.
      // Try the app document's asset root once before displaying an error.
      const alternative = new URL(imageName, rootCardBase).href;
      if (image.src !== alternative && !tried.has(image.src + ' -> ' + alternative)) {
        tried.add(image.src + ' -> ' + alternative);
        image.src = alternative;
        return;
      }
      if (!reported.has(imageName)) {
        reported.add(imageName);
        console.warn('MUSHIVERSE card illustration failed:', imageName);
      }
      art.textContent = 'イラストを表示できません';
      art.classList.add('mvCardArtUnavailable');
    }, {once:true});
    image.src = new URL(imageName, cardBase).href;
    art.append(image);
    return art;
  };
})();
