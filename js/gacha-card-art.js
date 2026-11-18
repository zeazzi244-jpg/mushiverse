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
        svg.querySelector('parsererror,script,foreignObject,image,use,style,a,animate,set')) return null;
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

  // Some WKWebView versions reject SVG in <img> while accepting inline SVG.
  // Keep this fallback local to bundled original-card artwork.
  async function inlineOriginalArt(url, name) {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) throw new Error('Original artwork unavailable');
    const markup = await response.text();
    if (markup.length > 100000) throw new Error('Original artwork too large');
    const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
    if (svg.localName !== 'svg' || svg.namespaceURI !== svgNamespace ||
        svg.querySelector('parsererror,script,foreignObject,image,use,style,a,animate,set')) {
      throw new Error('Invalid original artwork');
    }
    if ([svg, ...svg.querySelectorAll('*')].some(node =>
      [...node.attributes].some(attr => /^on/i.test(attr.name) || /(?:href|src|style)$/i.test(attr.name)))) {
      throw new Error('Unsafe original artwork');
    }
    // Gradients from separate cards must not share document-global IDs.
    const prefix = 'mvOriginalArt-' + ++nextArtId + '-';
    for (const node of [svg, ...svg.querySelectorAll('*')]) {
      const id = node.getAttribute('id');
      if (id) node.setAttribute('id', prefix + id);
      for (const attr of [...node.attributes]) {
        if (/url\(#([^)]+)\)/.test(attr.value)) {
          node.setAttribute(attr.name, attr.value.replace(/url\(#([^)]+)\)/g, (_, id) => 'url(#' + prefix + id + ')'));
        }
      }
    }
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
    const showSpeciesFallback = () => {
      try {
        const svg = renderSpecies(name, rarity);
        if (svg) {
          art.classList.remove('mvCardArtUnavailable');
          art.replaceChildren(svg);
          return;
        }
      } catch (error) {
        console.warn('MUSHIVERSE species fallback failed:', name, error);
      }
      showUnavailable();
    };
    const showUnavailable = () => {
      if (!reported.has(name)) {
        reported.add(name);
        console.warn('MUSHIVERSE card illustration unavailable:', name);
      }
      art.textContent = 'イラストを表示できません';
      art.classList.add('mvCardArtUnavailable');
    };

    const isLegendary = rarity === 'LR' && name === '創世の白蝶・アルバセラフ';
    const original = window.mushiverseOriginalCard?.(name);
    const archived = window.mushiverseArchivedCard?.(name);
    if (!isLegendary && !original && !archived) try {
      const svg = renderSpecies(name, rarity);
      if (svg) {
        art.append(svg);
        return art;
      }
    } catch (error) {
      console.warn('MUSHIVERSE species illustration rendering failed:', error);
    }

    if (isLegendary || original || archived) {
      const image = document.createElement('img');
      image.alt = name + 'のイラスト';
      image.loading = eager ? 'eager' : 'lazy';
      image.decoding = 'async';
      // Archived artwork can disappear after a catalog migration. Try the
      // original card's photo and SVG before declaring the card unavailable.
      // Preserve each card's own URLs; never substitute a shared placeholder.
      const candidates = [...new Set([
        archived?.image,
        original?.photo,
        original?.image,
        isLegendary ? albaseraphUrl.href : null
      ].filter(Boolean))];
      if (!candidates.length) {
        showSpeciesFallback();
        return art;
      }
      let candidateIndex = 0;
      const onImageError = () => {
        candidateIndex++;
        if (candidateIndex < candidates.length) {
          image.src = candidates[candidateIndex];
          return;
        }
        image.remove();
        if (!original?.image) return showSpeciesFallback();
        inlineOriginalArt(original.image, name)
          .then(svg => { if (art.isConnected) art.append(svg); })
          .catch(error => {
            console.warn('MUSHIVERSE original illustration fallback failed:', name, error);
            if (art.isConnected) showSpeciesFallback();
          });
      };
      image.addEventListener('error', onImageError);
      art.append(image);
      image.src = candidates[0];
    } else {
      showSpeciesFallback();
    }
    return art;
  };
})();
