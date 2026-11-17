(() => {
  'use strict';
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;

  let audio;
  let output;
  let grain;
  const active = new Set();

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
    // A source may already have a scheduled stop but still be awaiting onended.
    // Repeated close/reveal events must never abort the rest of the audio handler.
    for (const source of active) {
      try { source.stop(); } catch (error) {
        if (error?.name !== 'InvalidStateError') console.warn('MUSHIVERSE audio stop failed:', error);
      }
    }
    active.clear();
  }

  function start(source, node, time, length) {
    active.add(source);
    source.onended = () => active.delete(source);
    source.connect(node);
    source.start(time);
    source.stop(time + length);
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
    filter.connect(envelope(time, length, level));
    start(source, filter, time, length);
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
    if (!gain || document.hidden || audio?.state !== 'running') return;
    output.gain.setValueAtTime(gain, audio.currentTime);
    effect(audio.currentTime + 0.016);
  }

  document.addEventListener('mushiverse:gacha-audio-start', () => {
    // Invalidate any pending resume callback from the previous draw, even if muted.
    turn++;
    stop();
    if (!volume() || document.hidden) return;
    try {
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
      if (audio.state !== 'running') void audio.resume().catch(() => {});
    } catch {
      audio = undefined;
    }
  });

  let turn = 0;
  document.addEventListener('mushiverse:gacha-audio-prelude', () => {
    const current = ++turn;
    if (audio?.state === 'running') cue(crank);
    else if (audio && volume()) void audio.resume().then(() => {
      if (current === turn) cue(crank);
    }).catch(() => {});
  });

  document.addEventListener('mushiverse:gacha-audio-phase', ({detail}) => {
    if (![0, 1, 2].includes(detail)) return;
    cue(time => {
      noise(time, 1200 + detail * 750, 0.12, 0.06);
      bell(time, [330, 493.88, 659.25][detail], 0.20, 0.10);
    });
  });

  document.addEventListener('mushiverse:rarity-reveal', ({detail}) => {
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
      void audio.resume().then(() => { if (current === turn) finish(); }).catch(() => {});
    }
  });

  function cancel() {
    turn++;
    stop();
  }
  document.addEventListener('mushiverse:gacha-audio-close', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
})();
