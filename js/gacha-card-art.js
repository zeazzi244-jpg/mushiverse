(() => {
  'use strict';
  const reported = new Set();
  const svgPrefix = 'data:image/svg+xml;charset=UTF-8,';
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const scriptUrl = document.currentScript?.src || document.baseURI;
  const albaseraphUrl = new URL('../assets/cards/albaseraph.webp', scriptUrl);
  let nextArtId = 0;

  function renderSpecies(name, rarity) {
    const source = window.mushiverseSpeciesIllustration?.(name, rarity);
    if (typeof source !== 'string' || !source.startsWith(svgPrefix) || source.length >= 100000) return null;

    // Inline the bundled drawing so WKWebView never has to load a data URL.
    // Each card needs its own gradient IDs, including repeat pulls of the same species.
    const idPrefix = 'mvSpeciesArt-' + ++nextArtId + '-';
    const markup = decodeURIComponent(source.slice(svgPrefix.length))
      .replace(/id="(forest|shell)"/g, (_, id) => 'id="' + idPrefix + id + '"')
      .replace(/url\(#(forest|shell)\)/g, (_, id) => 'url(#' + idPrefix + id + ')');
    const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
    if (svg.localName !== 'svg' || svg.namespaceURI !== svgNamespace ||
        svg.querySelector('script,foreignObject,image,use,style,a,animate,set')) return null;
    const unsafe = [svg, ...svg.querySelectorAll('*')].some(node =>
      [...node.attributes].some(attr => /^on/i.test(attr.name) || /(?:href|src|style)$/i.test(attr.name)));
    if (unsafe) return null;
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', name + 'のイラスト');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.display = 'block';
    return document.importNode(svg, true);
  }

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

    const isLegendary = rarity === 'LR' && name === '創世の白蝶・アルバセラフ';
    if (!isLegendary) try {
      const svg = renderSpecies(name, rarity);
      if (svg) {
        art.append(svg);
        return art;
      }
    } catch (error) {
      console.warn('MUSHIVERSE species illustration rendering failed:', error);
    }

    if (isLegendary) {
      const image = document.createElement('img');
      image.alt = name + 'のイラスト';
      image.loading = eager ? 'eager' : 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => {
        image.remove();
        showUnavailable();
      }, { once: true });
      art.append(image);
      image.src = albaseraphUrl.href;
    } else {
      showUnavailable();
    }
    return art;
  };
})();
