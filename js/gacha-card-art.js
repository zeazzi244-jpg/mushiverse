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
    // A hanging SVG request must not block the remaining artwork candidates.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let markup;
    try {
      const response = await fetch(url, { cache: 'force-cache', signal: controller.signal });
      if (!response.ok) throw new Error('Original artwork unavailable');
      markup = await response.text();
    } finally {
      clearTimeout(timeout);
    }
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
      art.textContent = name + ' のイラストを表示できません';
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
        .map(url => {
          // Invalid catalogue URLs must not throw from load/error callbacks,
          // leaving an empty card and a permanently armed watchdog.
          try {
            const trimmed = url.trim();
            if (!trimmed) return null;
            const parsed = new URL(trimmed, document.baseURI);
            // Keep Capacitor's bundled file/app origins, but reject active
            // schemes and unexpected protocols from catalogue data.
            if (!['http:', 'https:', 'file:', 'capacitor:', 'ionic:'].includes(parsed.protocol)) return null;
            return parsed.href;
          } catch {
            return null;
          }
        })
        .filter(Boolean))];
      if (!candidates.length) {
        showSpeciesFallback();
        return art;
      }
      let candidateIndex = 0;
      let fallbackStarted = false;
      let loadTimeout;
      let loadSettled = false;
      const clearLoadTimeout = () => {
        if (loadTimeout !== undefined) clearTimeout(loadTimeout);
        loadTimeout = undefined;
      };
      const armLoadTimeout = () => {
        clearLoadTimeout();
        // A timeout queued for an earlier candidate must never skip the
        // currently loading image after the source has changed.
        const timedCandidate = candidateIndex;
        // A stalled request may expose dimensions before its load event.
        // Timeout recovery must advance even if the incomplete image has dimensions.
        // Move to the next species-specific source rather than leaving a blank card.
        loadTimeout = setTimeout(() => {
          if (fallbackStarted || loadSettled || candidateIndex !== timedCandidate) return;
          // Cached WKWebView images can decode successfully without dispatching
          // a load event to a detached card. Keep a fully decoded image.
          if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0 &&
              (!image.currentSrc || image.currentSrc === new URL(candidates[timedCandidate], document.baseURI).href)) {
            loadSettled = true;
            clearLoadTimeout();
            if (preview) { preview.remove(); preview = null; image.style.display = ''; }
            image.removeEventListener('error', handleImageError);
            image.removeEventListener('load', handleImageLoad);
            return;
          }
          onImageError(true);
        }, 12000);
      };
      const onImageError = (timedOut = false) => {
        // WKWebView can deliver an error from a previous source after the
        // replacement has already decoded. Never discard valid current art.
        // Only accept dimensions for the active candidate: a delayed event
        // from the previous source must not settle the replacement request.
        const activeUrl = new URL(candidates[candidateIndex], document.baseURI).href;
        // A delayed error from the previous source must not consume the
        // replacement candidate. Watchdog expiry is tied to its own index.
        if (!timedOut && image.currentSrc && image.currentSrc !== activeUrl) return;
        const decodedCurrent = image.complete && image.naturalWidth > 0 &&
          image.naturalHeight > 0 && (!image.currentSrc || image.currentSrc === activeUrl);
        if (!timedOut && decodedCurrent) {
          loadSettled = true;
          clearLoadTimeout();
          if (preview) { preview.remove(); preview = null; image.style.display = ''; }
          image.removeEventListener('error', handleImageError);
          image.removeEventListener('load', handleImageLoad);
          return;
        }
        clearLoadTimeout();
        // An already-failed image may emit another error after a source swap.
        // Start the asynchronous SVG fallback only once per card.
        if (fallbackStarted || loadSettled) return;
        candidateIndex++;
        loadSettled = false;
        if (candidateIndex < candidates.length) {
          image.src = candidates[candidateIndex];
          armLoadTimeout();
          decodeActiveCandidate();
          return;
        }
        fallbackStarted = true;
        image.removeEventListener('error', handleImageError);
        image.removeEventListener('load', handleImageLoad);
        image.remove();
        // Only SVG files can be parsed as inline artwork. WebP/PNG/JPEG
        // candidates must fall back to the species illustration instead of
        // being fetched and parsed as XML after an image-load failure.
        const svgCandidates = candidates.filter(url => /\.svg(?:[?#]|$)/i.test(url));
        if (!svgCandidates.length) {
          // No SVG recovery is possible: keep species-specific artwork visible.
          return showSpeciesFallback();
        }
        // Show species-specific artwork immediately while inline SVG recovery runs.
        // Otherwise a stalled fetch leaves the card empty for up to eight seconds
        // per SVG candidate, especially noticeable on iPhone WKWebView.
        showSpeciesFallback();
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
          // Species-specific artwork is already visible while SVG recovery
          // runs; do not replace it again after all fetches fail.
        };
        void tryInlineSvg();
      };
      // DOM error listeners receive an Event, not the timeout boolean.
      // Keep ordinary errors distinct from explicit watchdog expiry.
      const handleImageError = () => onImageError(false);
      image.addEventListener('error', handleImageError);
      const handleImageLoad = () => {
        if (fallbackStarted || loadSettled || !image.complete) return;
        // A late load event from an earlier source must not mark the next
        // candidate as successful. Compare the resolved active URL before
        // accepting dimensions, especially on WKWebView cache transitions.
        const expectedUrl = new URL(candidates[candidateIndex], document.baseURI).href;
        if (image.currentSrc && image.currentSrc !== expectedUrl) return;
        // A WebView may emit load for a decoded-but-empty image. Do not
        // clear the recovery timer until the artwork has real dimensions.
        if (image.naturalWidth > 0 && image.naturalHeight > 0) {
          loadSettled = true;
          clearLoadTimeout();
          if (preview) { preview.remove(); preview = null; image.style.display = ''; }
          image.removeEventListener('error', handleImageError);
          image.removeEventListener('load', handleImageLoad);
        } else {
          // A load event with zero dimensions is a failed decode even when
          // WKWebView still reports a stale currentSrc from the previous URL.
          // Advance the candidate now instead of leaving the card blank until
          // the 12-second watchdog expires.
          onImageError(true);
        }
      };
      image.addEventListener('load', handleImageLoad);
      // Every replacement candidate needs the same detached-WKWebView decode
      // recovery as the first candidate. Guard against late decode completions.
      function decodeActiveCandidate() {
        if (typeof image.decode !== 'function') return;
        const decodingCandidate = candidateIndex;
        const decodingUrl = candidates[decodingCandidate];
        // Some WKWebView implementations throw synchronously from decode()
        // (rather than returning a rejected promise). Preserve the watchdog
        // and the visible preview instead of aborting card construction.
        let decodePromise;
        try {
          decodePromise = image.decode();
        } catch (error) {
          console.warn('MUSHIVERSE image decode could not start:', name, error);
          return;
        }
        if (!decodePromise || typeof decodePromise.then !== 'function') return;
        void decodePromise.then(() => {
          if (fallbackStarted || loadSettled || candidateIndex !== decodingCandidate ||
              image.src !== decodingUrl || !image.complete ||
              image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
          handleImageLoad();
        }).catch(() => {
          // WKWebView can reject decode() for a fully failed cached image
          // without dispatching an error event. Advance immediately only
          // when this exact candidate has finished with no decoded pixels.
          if (fallbackStarted || loadSettled || candidateIndex !== decodingCandidate ||
              image.src !== decodingUrl || !image.complete ||
              image.naturalWidth > 0 || image.naturalHeight > 0) return;
          onImageError(true);
        });
      }

      // Render a species-specific preview immediately instead of leaving a
      // blank card during a slow or stalled WKWebView image request.
      // Keep the real image hidden until decoded; then replace the preview.
      let preview = null;
      try {
        preview = renderSpecies(name, rarity);
      } catch (error) {
        console.warn('MUSHIVERSE card preview failed:', name, error);
      }
      if (!preview) {
        // The illustration catalogue can load before its species renderer.
        // Keep a readable card label rather than a blank rectangle while
        // WKWebView waits for the real image or its recovery timeout.
        preview = document.createElement('span');
        preview.className = 'mvCardArtLoadingLabel';
        preview.textContent = name + ' のイラストを読み込み中';
        preview.setAttribute('role', 'status');
      }
      art.append(preview);
      image.style.display = 'none';
      art.append(image);
      image.src = candidates[0];
      armLoadTimeout();
      decodeActiveCandidate();
    } else {
      showSpeciesFallback();
    }
    return art;
  };
})();
