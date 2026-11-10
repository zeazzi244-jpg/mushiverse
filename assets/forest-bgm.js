(() => {
  const button = document.getElementById('mvForestBgm');
  const audio = document.getElementById('mvForestAudio');
  if (!button || !audio) return;

  const stop = document.createElement('button');
  stop.id = 'mvBgmStop';
  stop.type = 'button';
  stop.hidden = true;
  stop.innerHTML = '<span lang="ja">BGMを止める</span><span lang="en">Stop BGM</span>';
  const status = document.createElement('span');
  status.id = 'mvBgmStatus';
  status.setAttribute('role', 'status');
  button.insertAdjacentElement('afterend', status);
  document.body.append(stop);

  let enabled = false;
  let generation = 0;
  const english = () => document.body.classList.contains('lang-en');
  function sync() {
    button.setAttribute('aria-pressed', String(enabled));
    stop.hidden = !enabled;
  }
  function fail(request) {
    if (request !== generation || !enabled || document.hidden) return;
    enabled = false;
    generation++;
    audio.pause();
    sync();
    status.textContent = english()
      ? 'BGM could not play. Tap again to retry.'
      : 'BGMを再生できませんでした。もう一度タップしてお試しください。';
  }
  function update() {
    const request = ++generation;
    sync();
    if (enabled && !document.hidden) {
      status.textContent = english() ? 'Loading music…' : 'BGMを準備中…';
      audio.play().catch(error => {
        if (error.name !== 'AbortError') fail(request);
      });
    } else {
      audio.pause();
      status.textContent = '';
    }
  }

  button.addEventListener('click', () => {
    enabled = !enabled;
    update();
  });
  stop.addEventListener('click', () => {
    enabled = false;
    update();
  });
  audio.addEventListener('playing', () => {
    status.textContent = '';
  });
  audio.addEventListener('error', () => fail(generation));
  document.addEventListener('visibilitychange', update);
  window.addEventListener('pagehide', () => {
    generation++;
    audio.pause();
  });
  window.addEventListener('pageshow', update);
})();

// Capsule sounds follow the actual visible stages, including skipped reveals.
(() => {
  let context;
  let overlay;
  const heard = new Set();
  const voices = new Set();
  function volume() {
    try {
      if (localStorage.getItem('mushiverse-tap-sounds-enabled') === 'false') return 0;
      const raw = localStorage.getItem('mushiverse-gacha-volume');
      const value = raw === null ? .35 : Number(raw);
      return Number.isFinite(value) ? Math.max(0, Math.min(.6, value)) : .35;
    } catch { return .35; }
  }
  function unlock(event) {
    if (!event.target.closest?.('#mv77Draw,#mv77Ten,#mv77TicketDraw')) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio || !volume()) return;
    try {
      context ||= new Audio();
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch {}
  }
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') unlock(event);
  }, true);
  function silence() {
    for (const voice of voices) {
      try { voice.stop(); } catch {}
    }
    voices.clear();
  }
  function sound(stage) {
    if (heard.has(stage)) return;
    heard.add(stage);
    const level = volume();
    if (!level || document.hidden || context?.state !== 'running') return;
    const patterns = {
      drop: [[180, 0, .14], [95, .12, .14]],
      charge: [[330, 0, .18], [440, .12, .18]],
      open: [[660, 0, .15], [990, .1, .2]],
      result: [[523, 0, .2], [659, .09, .22], [784, .18, .3]],
    };
    for (const [frequency, delay, duration] of patterns[stage]) {
      const voice = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + delay;
      voice.type = 'sine';
      voice.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(level * .07, start + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      voice.connect(gain).connect(context.destination);
      voices.add(voice);
      voice.onended = () => {
        voices.delete(voice);
        voice.disconnect();
        gain.disconnect();
      };
      voice.start(start);
      voice.stop(start + duration + .02);
    }
  }
  const observer = new MutationObserver(() => {
    const current = document.getElementById('mv88Reveal');
    if (current !== overlay) {
      silence();
      overlay = current;
      heard.clear();
    }
    if (!overlay) return;
    if (overlay.classList.contains('mvRevealSettled')) {
      sound('result');
      return;
    }
    const stage = overlay.querySelector('.mv88Stage');
    if (stage?.classList.contains('mvCapsuleOpening')) sound('open');
    else if (stage?.classList.contains('mvCapsuleCharged')) sound('charge');
    else sound('drop');
  });
  observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
  document.addEventListener('visibilitychange', () => { if (document.hidden) silence(); });
  window.addEventListener('pagehide', silence);
})();
