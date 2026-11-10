import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync, lstatSync } from 'node:fs';
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

test('all six app sections receive consistent legibility rules', () => {
  const css = readFileSync(join('css', 'adventure-ui.css'), 'utf8');
  assert.match(css, /font-size:16px/, 'Base font size must be readable');
  assert.match(css, /-webkit-text-size-adjust:100%/, 'iOS text scaling baseline missing');
  assert.match(css, /:is\(#home,#post,#collection,#gacha,#map,#profile\)/, 'Typography must cover all six sections');
  assert.match(css, /foregrounds are limited to known dark surfaces/, 'Contrast rules must not force white text onto light cards');
});

test('forest theme text contrast meets WCAG AA on known solid surfaces', () => {
  const css = readFileSync(join('css', 'adventure-ui.css'), 'utf8');
  const hex = token => {
    const match = css.match(new RegExp(token + ':(#[0-9a-fA-F]{6})'));
    assert.ok(match, 'Missing palette token: ' + token);
    return match[1];
  };
  const luminance = value => {
    const rgb = [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
    const linear = rgb.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const contrast = (a, b) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };
  const foreground = hex('--mv-text');
  for (const background of [hex('--mv-surface'), hex('--mv-surface-raised')]) {
    assert.ok(contrast(foreground, background) >= 4.5,
      'Forest text contrast must be at least 4.5:1 on ' + background);
  }
});

test('release bundle contains no symlinks or unsupported asset extensions', () => {
  const allowed = new Set(['.html','.js','.css','.json','.svg','.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.mp3','.wav','.webmanifest']);
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const info = lstatSync(path);
      assert.ok(!info.isSymbolicLink(), 'Symlink in release bundle: ' + path);
      if (info.isDirectory()) walk(path);
      else {
        assert.ok(info.isFile(), 'Non-file in release bundle: ' + path);
        const extension = name.slice(name.lastIndexOf('.')).toLowerCase();
        assert.ok(allowed.has(extension), 'Unsupported release asset: ' + path);
      }
    }
  };
  assert.ok(existsSync('www'), 'Run npm run build:web first');
  walk('www');
});

test('mobile forms retain readable placeholders and disabled states', () => {
  const css = readFileSync(join('css', 'adventure-ui.css'), 'utf8');
  assert.match(css, /:is\(input,textarea,select\)\{font-size:16px/, 'iPhone input font-size missing');
  assert.match(css, /:is\(input,textarea\)::placeholder\{opacity:1;color:#596b60\}/, 'Placeholder contrast missing');
  assert.match(css, /:disabled\{opacity:\.65;cursor:not-allowed\}/, 'Disabled action styling missing');
  assert.match(css, /forced-colors:active/, 'Forced-colors accessibility missing');
});

test('home quest avoids beta label and misleading coin reward promises', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /今日の撮影チャレンジ/, 'Friendly quest heading missing');
  assert.doesNotMatch(html, /採集クエスト β/, 'Outdated beta label remains');
  assert.doesNotMatch(html, /審査通過で100コイン（予定）/, 'Unimplemented reward is advertised');
  assert.match(html, /報酬機能は準備中/, 'Reward status must be explicit');
});

test('gacha machine presents an SSR preview without changing draw probabilities', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /id="mvGachaShowcaseStyle"/, 'Gacha showcase styling missing');
  assert.match(html, /mvGachaRarityHint/, 'SSR preview is missing');
  assert.match(html, /出現率 0\.1%/, 'SSR probability label missing');
  assert.match(html, /#mv101Machine\{max-width:360px/, 'Compact machine layout missing');
});
