(() => {
  'use strict';
  const reported = new Set();
  const svgPrefix = 'data:image/svg+xml;charset=UTF-8,';
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const scriptUrl = document.currentScript?.src || document.baseURI;
  const albaseraphUrl = new URL('../assets/cards/albaseraph.webp', scriptUrl);
  let nextArtId = 0;

  function renderSpecies(name, rarity) {
    const source = window.mushiverseSpeciesIllustration?.(window.mushiverseClassicCard?.(name)?.legacyName ?? name, rarity);
    if (typeof source !== 'string' || !source.startsWith(svgPrefix) || source.length >= 100000) return null;

    // Inline the bundled drawing so WKWebView never has to load a data URL.
    // Each card needs its own gradient IDs, including repeat pulls of the same species.
    const markup = decodeURIComponent(source.slice(svgPrefix.length));
    const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
    if (svg.localName !== 'svg' || svg.namespaceURI !== svgNamespace ||
        svg.querySelector('parsererror,script,foreignObject,image,use,style,a,animate,set')) return null;
    const unsafe = [svg, ...svg.querySelectorAll('*')].some(node =>
      [...node.attributes].some(attr => /^on/i.test(attr.name) || /(?:href|src|style)$/i.test(attr.name)));
    if (unsafe) return null;
    // Rewrite every local SVG ID, not only known gradient names. Different
    // species can use different filter, mask or clip-path IDs in the future.
    const prefix = 'mvSpeciesArt-' + ++nextArtId + '-';
    for (const node of [svg, ...svg.querySelectorAll('*')]) {
      const id = node.getAttribute('id');
      if (id) node.setAttribute('id', prefix + id);
      for (const attr of [...node.attributes]) {
        if (attr.value.includes('url(#')) {
          node.setAttribute(attr.name, attr.value.replace(/url\(#([^)]+)\)/g,
            (_, id) => 'url(#' + prefix + id + ')'));
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
    const classicPhoto = window.mushiverseClassicCard?.(name)?.photo;
    if (!isLegendary && !original && !archived && !classicPhoto) try {
      const svg = renderSpecies(name, rarity);
      if (svg) {
        art.append(svg);
        return art;
      }
    } catch (error) {
      console.warn('MUSHIVERSE species illustration rendering failed:', error);
    }

    if (isLegendary || original || archived || classicPhoto) {
      const image = document.createElement('img');
      image.alt = name + 'のイラスト';
      // Card artwork is frequently built off-DOM; lazy loading can leave it blank.
      image.loading = 'eager';
      image.decoding = 'async';
      // Archived artwork can disappear after a catalog migration. Try the
      // original card's photo and SVG before declaring the card unavailable.
      // Preserve each card's own URLs; never substitute a shared placeholder.
      const candidates = [...new Set([
        classicPhoto,
        archived?.image,
        original?.photo,
        original?.image,
        isLegendary ? albaseraphUrl.href : null
      ].filter(url => typeof url === 'string')
        .map(url => url.trim())
        .filter(url => url && !/^(?:javascript|data|vbscript):/i.test(url)))];
      if (!candidates.length) {
        showSpeciesFallback();
        return art;
      }
      let candidateIndex = 0;
      let fallbackStarted = false;
      let loadTimeout;
      const clearLoadTimeout = () => {
        if (loadTimeout !== undefined) clearTimeout(loadTimeout);
        loadTimeout = undefined;
      };
      const armLoadTimeout = () => {
        clearLoadTimeout();
        // A stalled request may never fire load/error in an embedded WebView.
        // Move to the next species-specific source rather than leaving a blank card.
        loadTimeout = setTimeout(() => {
          if (!fallbackStarted && (image.naturalWidth === 0 || image.naturalHeight === 0)) onImageError();
        }, 12000);
      };
      const onImageError = () => {
        clearLoadTimeout();
        // An already-failed image may emit another error after a source swap.
        // Start the asynchronous SVG fallback only once per card.
        if (fallbackStarted) return;
        candidateIndex++;
        if (candidateIndex < candidates.length) {
          armLoadTimeout();
          image.src = candidates[candidateIndex];
          return;
        }
        fallbackStarted = true;
        image.removeEventListener('error', onImageError);
        image.remove();
        // Only SVG files can be parsed as inline artwork. WebP/PNG/JPEG
        // candidates must fall back to the species illustration instead of
        // being fetched and parsed as XML after an image-load failure.
        const svgCandidates = candidates.filter(url => /\.svg(?:[?#]|$)/i.test(url));
        if (!svgCandidates.length) return showSpeciesFallback();
        // Card nodes may be detached; still finish loading before insertion.
        // Try all SVG candidates, not only original.image.
        const tryInlineSvg = async () => {
          for (const url of svgCandidates) {
            try {
              const svg = await inlineOriginalArt(url, name);
              art.classList.remove('mvCardArtUnavailable');
              art.replaceChildren(svg);
              return;
            } catch (error) {
              console.warn('MUSHIVERSE SVG fallback failed:', name, url, error);
            }
          }
          showSpeciesFallback();
        };
        void tryInlineSvg();
      };
      image.addEventListener('error', onImageError);
      image.addEventListener('load', () => {
        if (fallbackStarted) return;
        // A WebView may emit load for a decoded-but-empty image. Do not
        // clear the recovery timer until the artwork has real dimensions.
        if (image.naturalWidth > 0 && image.naturalHeight > 0) {
          clearLoadTimeout();
        } else {
          onImageError();
        }
      });
      art.append(image);
      armLoadTimeout();
      image.src = candidates[0];
    } else {
      showSpeciesFallback();
    }
    return art;
  };
})();
