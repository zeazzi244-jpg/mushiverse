(() => {
  'use strict';
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;

  let audio;
  let output;
  let grain;
  // Prevent delayed phase events from restarting audio after reveal or close.
  let drawOpen = false;
  const active = new Set();
  const cleanupBySource = new WeakMap();

  function volume() {
    try {
      if (localStorage.getItem('mushiverse-tap-sounds-enabled') === 'false') return 0;
      if (localStorage.getItem('mushiverse-gacha-mute') === 'true') return 0;
      const stored = localStorage.getItem('mushiverse-gacha-volume');
      const level = stored === null ? 0.35 : Number(stored);
      return Math.min(0.6, Math.max(0, Number.isFinite(level) ? level : 0.35));
    } catch {
      return 0.35;
    }
  }

  function stop() {
    // Mute the shared output first: stopping individual scheduled sources can
    // throw in some WebViews, but a failed stop must never leave a fanfare audible.
    if (output && audio?.state === 'running') {
      try { output.gain.setValueAtTime(0, audio.currentTime); }
      catch (error) { console.warn('MUSHIVERSE audio mute failed:', error); }
    }
    // A source may already have a scheduled stop but still be awaiting onended.
    // Repeated close/reveal events must never abort the rest of the audio handler.
    for (const source of active) {
      try { source.stop(); } catch (error) {
        if (error?.name !== 'InvalidStateError') console.warn('MUSHIVERSE audio stop failed:', error);
      }
      // stop() can leave scheduled notes connected until onended fires.
      // Disconnect immediately so closing the gacha reliably silences them.
      release(source);
    }
    active.clear();
  }

  function release(source) {
    const nodes = cleanupBySource.get(source) || [];
    cleanupBySource.delete(source);
    try { source.disconnect(); } catch { /* Already disconnected. */ }
    for (const node of nodes) {
      try { node.disconnect(); } catch { /* Already disconnected. */ }
    }
  }

  function start(source, node, time, length, extraNodes = []) {
    cleanupBySource.set(source, [node, ...extraNodes]);
    source.onended = () => {
      active.delete(source);
      // Repeated draws create many short-lived nodes. Release their graph
      // connections as soon as playback finishes (including scheduled notes).
      release(source);
    };
    try {
      source.connect(node);
      source.start(time);
      active.add(source);
      source.stop(time + length);
    } catch (error) {
      active.delete(source);
      // source.start() may have succeeded before scheduling source.stop()
      // failed. Explicitly stop it before disconnecting the graph, otherwise
      // a live oscillator can survive the failed cue in iOS WebViews.
      try { source.stop(); } catch { /* Never started or already stopped. */ }
      release(source);
      throw error;
    }
  }

  function envelope(time, length, level) {
    const amp = audio.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(level, time + 0.007);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + length);
    amp.connect(output);
    return amp;
  }

  function tone(time, hz, length, level, type = 'sine', endHz = hz) {
    const oscillator = audio.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(hz, time);
    oscillator.frequency.exponentialRampToValueAtTime(endHz, time + length);
    start(oscillator, envelope(time, length, level), time, length);
  }

  function noise(time, hz, length, level) {
    const source = audio.createBufferSource();
    source.buffer = grain;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = hz;
    filter.Q.value = 0.85;
    const amp = envelope(time, length, level);
    filter.connect(amp);
    start(source, filter, time, length, [amp]);
  }

  function bell(time, hz, length, level) {
    tone(time, hz, length, level);
    tone(time, hz * 2.01, length * 0.46, level * 0.29);
    tone(time, hz * 3.98, length * 0.24, level * 0.12);
  }

  function crank(time) {
    for (const [index, offset] of [0, 0.07, 0.15, 0.25, 0.35].entries()) {
      noise(time + offset, 920 + index * 110, 0.072, 0.19);
      tone(time + offset, 240 + index * 24, 0.065, 0.15, 'triangle', 125 + index * 14);
    }
    // The visual capsule begins to fall 450 ms into the prelude.
    noise(time + 0.59, 560, 0.15, 0.25);
    tone(time + 0.59, 195, 0.16, 0.30, 'triangle', 69);
    tone(time + 0.76, 315, 0.09, 0.11, 'triangle', 130);
    tone(time + 0.88, 360, 0.07, 0.06, 'triangle', 180);
  }

  const fanfares = {
    N: [[440, 0], [587.33, 0.11]],
    R: [[523.25, 0], [659.25, 0.08], [783.99, 0.18]],
    SR: [[392, 0], [587.33, 0.08], [739.99, 0.17], [880, 0.27]],
    SSR: [[329.63, 0], [523.25, 0.07], [659.25, 0.15], [783.99, 0.23], [1046.50, 0.35], [1318.51, 0.46]],
    LR: [[261.63, 0], [523.25, 0.12], [783.99, 0.23], [1046.50, 0.34], [1318.51, 0.47], [1567.98, 0.62], [2093, 0.76]]
  };

  function cue(effect) {
    const gain = volume();
    if (!gain || document.hidden || audio?.state !== 'running' || !output) return;
    try {
      output.gain.setValueAtTime(gain, audio.currentTime);
      effect(audio.currentTime + 0.016);
    } catch (error) {
      // Audio failures must not interrupt the gacha draw or card reveal.
      stop();
      console.warn('MUSHIVERSE gacha audio cue failed:', error);
    }
  }

  document.addEventListener('mushiverse:gacha-audio-start', () => {
    // Invalidate any pending resume callback from the previous draw, even if muted.
    turn++;
    drawOpen = true;
    stop();
    if (!volume() || document.hidden) return;
    try {
      if (audio && audio.state === 'closed') {
        stop();
        audio = undefined;
        output = undefined;
        grain = undefined;
      }
      if (!audio) {
        audio = new Context();
        output = audio.createGain();
        output.connect(audio.destination);
        grain = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.23), audio.sampleRate);
        const samples = grain.getChannelData(0);
        // A separate deterministic noise source leaves the gacha RNG untouched.
        let seed = 1234567;
        for (let i = 0; i < samples.length; i++) {
          seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
          samples[i] = seed / 2147483648 - 1;
        }
      }
      if (audio.state !== 'running') {
        // Some WebViews throw synchronously rather than returning a rejected promise.
        try { void Promise.resolve(audio.resume()).catch(() => {}); } catch { /* Retry on the next gesture. */ }
      }
    } catch (error) {
      // A partially initialized AudioContext otherwise leaks across repeated draws.
      const failedContext = audio;
      audio = undefined;
      output = undefined;
      grain = undefined;
      try { if (failedContext) void Promise.resolve(failedContext.close()).catch(() => {}); } catch { /* Already closed. */ }
      console.warn('MUSHIVERSE gacha audio initialization failed:', error);
    }
  });

  let turn = 0;
  document.addEventListener('mushiverse:gacha-audio-prelude', () => {
    if (!drawOpen) return;
    const current = ++turn;
    if (audio?.state === 'running') cue(crank);
    else if (audio && volume()) {
      try {
        void Promise.resolve(audio.resume()).then(() => {
          if (drawOpen && current === turn) cue(crank);
        }).catch(() => {});
      } catch { /* Audio is optional; never interrupt the draw. */ }
    }
  });

  document.addEventListener('mushiverse:gacha-audio-phase', ({detail}) => {
    if (!drawOpen || ![0, 1, 2].includes(detail)) return;
    // iOS may suspend Web Audio between the prelude and the capsule animation.
    // Resume on this gesture when possible, but never play a stale phase after
    // a newer draw, reveal, close, or visibility change.
    // Each phase supersedes pending resume callbacks from the prelude or
    // previous phase. Otherwise iOS can play old cues out of order after resume.
    const current = ++turn;
    const play = () => {
      if (!drawOpen || current !== turn) return;
      cue(time => {
        noise(time, 1200 + detail * 750, 0.12, 0.06);
        bell(time, [330, 493.88, 659.25][detail], 0.20, 0.10);
      });
    };
    if (audio?.state === 'running') play();
    else if (audio && volume() && !document.hidden) {
      try {
        void Promise.resolve(audio.resume()).then(play).catch(() => {});
      } catch { /* Sound must never interrupt the capsule animation. */ }
    }
  });

  document.addEventListener('mushiverse:rarity-reveal', ({detail}) => {
    // Ignore delayed or duplicate reveal events after the draw was closed.
    // Otherwise an old animation can restart its fanfare after cancellation.
    if (!drawOpen) return;
    drawOpen = false;
    turn++;
    stop();
    const notes = fanfares[detail?.rarity];
    if (!notes) return;
    const finish = () => cue(time => {
      noise(time, 2270, 0.14, 0.17);
      for (const [hz, offset] of notes) bell(time + offset, hz, notes.length > 4 ? 0.65 : 0.38, 0.18);
    });
    if (audio?.state === 'running') finish();
    else if (audio && volume()) {
      const current = turn;
      try {
        void Promise.resolve(audio.resume()).then(() => { if (current === turn) finish(); }).catch(() => {});
      } catch { /* Keep the revealed card visible even if audio fails. */ }
    }
  });

  function cancel() {
    drawOpen = false;
    turn++;
    stop();
  }
  document.addEventListener('mushiverse:gacha-audio-close', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  // pagehide also fires on iOS navigation/BFCache transitions where
  // visibilitychange is not guaranteed. Do not leave queued notes playing.
  window.addEventListener('pagehide', cancel);
  // The app can mute gacha sounds mid-animation; silence already queued notes
  // immediately instead of waiting for the next cue to read the new volume.
  window.addEventListener('storage', event => {
    // Storage.clear() emits a null key and can reset all audio preferences.
    if (event.key !== null && !['mushiverse-gacha-mute', 'mushiverse-gacha-volume', 'mushiverse-tap-sounds-enabled'].includes(event.key)) return;
    // A volume change in another tab must affect sounds already playing, not
    // only the next cue. In particular, lowering the volume must not leave a
    // previously queued SSR fanfare playing at its old level.
    const level = volume();
    if (!level) {
      stop();
    }
    if (audio?.state === 'running' && output) {
      try { output.gain.setValueAtTime(level, audio.currentTime); }
      catch (error) { console.warn('MUSHIVERSE audio volume update failed:', error); }
    }
  });
})();
