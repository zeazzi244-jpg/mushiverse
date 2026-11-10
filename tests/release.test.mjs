import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';

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
test('production bundle excludes development and private artifacts', () => {
  const root = 'www';
  assert.ok(existsSync(root), 'Run npm run build:web first');
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const rel = relative(root, path);
      assert.ok(!name.startsWith('.'), 'Hidden file in bundle: ' + rel);
      assert.doesNotMatch(name, /(?:^|[._-])(secret|private|backup|credential|credentials)(?:[._-]|$)/i, rel);
      assert.doesNotMatch(name, /\.(?:map|pem|key|p12|p8|mobileprovision|bak|orig|log|md|ts|tsx)$/i, rel);
      if (statSync(path).isDirectory()) walk(path);
    }
  };
  walk(root);
});

test('mobile adventure controls remain readable and accessible', () => {
  const css = readFileSync(join('css', 'adventure-ui.css'), 'utf8');
  assert.match(css, /focus-visible/, 'Keyboard focus styling missing');
  assert.match(css, /min-height:44px/, 'Minimum adventure button tap target missing');
  assert.match(css, /prefers-reduced-motion:reduce/, 'Reduced motion support missing');
  assert.match(css, /max-width:380px/, 'Small-screen adaptation missing');
});

test('forest panels use explicit high-contrast text colors', () => {
  const css = readFileSync(join('css', 'adventure-ui.css'), 'utf8');
  assert.match(css, /--mv-surface:#102a22/, 'Forest surface token missing');
  assert.match(css, /--mv-text:#f3f8ef/, 'Light text token missing');
  assert.match(css, /#home #mv110FollowFeed\{background:linear-gradient/, 'Follow feed forest surface missing');
  assert.match(css, /#home #mv110FollowFeed h2\{color:#f5ffe8\}/, 'Follow feed title contrast missing');
  assert.match(css, /prefers-contrast:more/, 'High contrast mode missing');
});
