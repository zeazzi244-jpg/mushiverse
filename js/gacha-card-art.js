(() => {
  'use strict';
  const byRarity = {
    N: 'gacha-n.webp', R: 'gacha-r.webp', SR: 'gacha-sr.webp', SSR: 'gacha-ssr.webp',
    LR: 'albaseraph.webp'
  };
  const reported = new Set();

  window.mushiverseCardArt = (rarity, eager = false) => {
    const art = document.createElement('div');
    art.className = 'mvSharedCardArt';
    const image = document.createElement('img');
    const imageName = byRarity[rarity] || byRarity.N;
    image.alt = rarity === 'LR' ? '創世の白蝶・アルバセラフ' : rarity + 'のイメージイラスト';
    image.loading = eager ? 'eager' : 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      if (!reported.has(imageName)) {
        reported.add(imageName);
        console.warn('MUSHIVERSE card illustration failed:', imageName);
      }
      art.textContent = 'イラストを表示できません';
      art.classList.add('mvCardArtUnavailable');
    }, {once:true});
    image.src = 'assets/cards/' + imageName;
    art.append(image);
    return art;
  };
})();
