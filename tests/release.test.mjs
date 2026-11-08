import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

test('release scripts parse', () => {
  for (const path of ['scripts/build-web.mjs', 'scripts/prepare-ios.mjs', 'scripts/apply-ios-icon.mjs', 'scripts/check-ios-release.mjs']) {
    const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
    assert.equal(result.status, 0, path + ': ' + result.stderr);
  }
});
test('Capacitor release identity stays fixed', () => {
  const config = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
  assert.equal(config.appId, 'com.rikuto.mushiverse');
  assert.equal(config.webDir, 'www');
  assert.equal(config.server?.url, undefined);
});
test('web bundle contains usable entry point', () => {
  assert.ok(existsSync(join('www', 'index.html')), 'Run npm run build:web first');
  const html = readFileSync(join('www', 'index.html'), 'utf8');
  assert.match(html, /<html\b/i);
  assert.match(html, /<body\b/i);
  assert.ok(html.length > 500, 'Web entry is unexpectedly small');
});

test('adventure theme ships in offline web bundle', () => {
  const html = readFileSync(join('www', 'index.html'), 'utf8');
  const css = join('www', 'css', 'adventure-ui.css');
  assert.match(html, /href="css\/adventure-ui\.css"/);
  assert.ok(existsSync(css), 'Adventure CSS missing from web bundle');
  const style = readFileSync(css, 'utf8');
  assert.match(style, /prefers-reduced-motion/);
  for (const section of ['home', 'post', 'collection', 'gacha', 'map', 'profile']) {
    assert.ok(html.includes(`id="${section}"`), 'Missing navigation section: ' + section);
  }
});
