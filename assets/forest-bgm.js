(() => {
  const button = document.getElementById('mvForestBgm');
  const audio = document.getElementById('mvForestAudio');
  if (!button || !audio) return;

  let enabled = false;
  function update() {
    button.setAttribute('aria-pressed', String(enabled));
    if (enabled && !document.hidden) {
      audio.play().catch(error => {
        if (!enabled || document.hidden || error.name === 'AbortError') return;
        enabled = false;
        update();
      });
    } else {
      audio.pause();
    }
  }

  button.addEventListener('click', () => {
    enabled = !enabled;
    update();
  });
  document.addEventListener('visibilitychange', update);
  window.addEventListener('pagehide', () => audio.pause());
  window.addEventListener('pageshow', update);
})();
