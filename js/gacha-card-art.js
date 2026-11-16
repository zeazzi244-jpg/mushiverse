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
    let speciesUrl = '';
    try {
      speciesUrl = window.mushiverseSpeciesIllustration?.(name, rarity) || '';
    } catch (error) {
      console.warn('MUSHIVERSE species illustration lookup failed:', error);
    }
    const legacyUrl = rarity === 'LR' ? new URL('albaseraph.webp', scriptCardBase).href : '';
    // Missing species art must not leave ordinary N/R/SR/SSR cards blank.
    // Use the bundled tier illustration even when the species resolver is absent.
    const tierName = ['N', 'R', 'SR', 'SSR'].includes(rarity) ? 'gacha-' + rarity.toLowerCase() + '.webp' : 'albaseraph.webp';
    const tierFallback = new URL(tierName, scriptCardBase).href;
    const rootFallback = new URL(tierName, rootCardBase).href;
    const source = speciesUrl || legacyUrl || tierFallback;
    const image = document.createElement('img');
    image.alt = name ? name + 'のイラスト' : 'LRカードのイラスト';
    image.loading = eager ? 'eager' : 'lazy';
    image.decoding = 'async';
    let fallbackStage = 0;
    image.addEventListener('error', () => {
      // Older installed WebViews may retain a stale script URL after an update.
      // Try the app document's asset root once before displaying an error.
      // Some iOS WebViews reject data: SVG images even though inline SVG works.
      // Render only the locally generated SVG as a last-resort illustration.
      if (source.startsWith('data:image/svg+xml;charset=UTF-8,') && source.length < 100000) {
        try {
          const markup = decodeURIComponent(source.slice('data:image/svg+xml;charset=UTF-8,'.length));
          const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
          if (svg.localName === 'svg' && svg.namespaceURI === 'http://www.w3.org/2000/svg' && !svg.querySelector('script,foreignObject,image,use')) {
            const unsafe = [...svg.querySelectorAll('*'), svg].some(node =>
              [...node.attributes].some(attr => /^on/i.test(attr.name) || /(?:href|src)$/i.test(attr.name)));
            if (!unsafe) {
              svg.setAttribute('role', 'img');
              svg.setAttribute('aria-label', image.alt);
              image.replaceWith(document.importNode(svg, true));
              return;
            }
          }
        } catch (error) {
          console.warn('MUSHIVERSE inline illustration fallback failed:', error);
        }
      }
      // Prefer the species illustration, then the bundled rarity artwork.
      // Both asset roots are tried to recover from stale iOS WebView bases.
      if (fallbackStage === 0 && source !== tierFallback) {
        fallbackStage = 1;
        image.src = tierFallback;
        return;
      }
      if (fallbackStage <= 1 && image.src !== rootFallback && tierFallback !== rootFallback) {
        fallbackStage = 2;
        image.src = rootFallback;
        return;
      }
      image.remove();
      showUnavailable();
    });
    art.append(image);
    image.src = source;
    return art;
  };
})();
