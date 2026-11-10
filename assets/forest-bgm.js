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
