(() => {
  'use strict';
  const reported = new Set();
  // Resolve assets from this script, not the current page URL. This also works
  // when the WebView is opened through a nested route or a custom app origin.
  const scriptUrl = document.currentScript?.src || document.baseURI;
  const cardBase = new URL('../assets/cards/', scriptUrl);
  const rootCardBase = new URL('assets/cards/', document.baseURI);
  // Resolve against the actual script directory first. A custom WebView base
  // element must not silently redirect artwork to an unrelated route.
  const scriptCardBase = document.currentScript?.src
    ? new URL('../assets/cards/', document.currentScript.src)
    : cardBase;

  window.mushiverseCardArt = (name, rarity, eager = false) => {
    const art = document.createElement('div');
    art.className = 'mvSharedCardArt';
    const showUnavailable = () => {
      if (!reported.has(name)) {
        reported.add(name);
        console.warn('MUSHIVERSE card illustration unavailable:', name);
      }
      art.textContent = 'イラストを表示できません';
      art.classList.add('mvCardArtUnavailable');
    };
    const speciesUrl = window.mushiverseSpeciesIllustration?.(name,rarity);
    const legacyUrl = rarity === 'LR' ? new URL('albaseraph.webp', scriptCardBase).href : '';
    const source = speciesUrl || legacyUrl;
    if (!source) {
      showUnavailable();
      return art;
    }
    const image = document.createElement('img');
    image.alt = name ? name + 'のイラスト' : 'LRカードのイラスト';
    image.loading = eager ? 'eager' : 'lazy';
    image.decoding = 'async';
    let fallbackAttempted = false;
    image.addEventListener('error', () => {
      // Older installed WebViews may retain a stale script URL after an update.
      // Try the app document's asset root once before displaying an error.
      const alternative = legacyUrl && new URL('albaseraph.webp', rootCardBase).href;
      if (alternative && !fallbackAttempted && image.src !== alternative) {
        fallbackAttempted = true;
        image.src = alternative;
        return;
      }
      showUnavailable();
    });
    image.src = source;
    art.append(image);
    return art;
  };
})();
