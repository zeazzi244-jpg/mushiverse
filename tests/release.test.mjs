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

test('gacha reveal uses longer three-stage variants without rerolling rewards', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /id="mvGachaMultiStage"/, 'Multi-stage styles missing');
  assert.match(html, /森の共鳴.*星屑の召喚.*古代遺跡の覚醒.*月光の羽化/, 'Four presentation variants missing');
  assert.match(html, /top==='SSR'\?10500:top==='SR'\?8500/, 'Extended rare reveal duration missing');
  assert.match(html, /const updatePhase=\(\)=>/, 'Three-stage reveal controller missing');
  assert.match(html, /clearInterval\(phaseTimer\)/, 'Animation timer cleanup missing');
});

test('gacha presentation supports skip, reduced motion and transparent rewards', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /演出をスキップして結果を見る/, 'Skip control missing');
  assert.match(html, /抽選時に確定済み/, 'Fixed-result disclosure missing');
  assert.match(html, /if\(reduced\)reveal\(\)/, 'Reduced-motion immediate reveal missing');
  assert.match(html, /id="mvGachaReviewSafety"/, 'Accessibility styles missing');
  assert.doesNotMatch(html, /overlay\.addEventListener\('click',e=>\{if\(e\.target===overlay\)/, 'Accidental backdrop dismissal remains');
});

test('gacha avoids early rarity audio spoilers and cleans up replaced overlays', () => {
  const html = readFileSync('index.html', 'utf8');
  const start = html.indexOf('function showGachaReveal(got){');
  const end = html.indexOf('\nfunction start(){ensure();render();', start);
  assert.ok(start >= 0 && end > start, 'Gacha reveal implementation missing');
  const reveal = html.slice(start, end);
  assert.match(reveal, /window\.mvCloseGachaReveal=close/, 'Overlay cleanup hook missing');
  assert.match(reveal, /window\.mvCloseGachaReveal\(\)/, 'Prior reveal is not cleaned up');
  assert.match(reveal, /const reveal=\(\)=>\{[^\n]*mushiverse:rarity-reveal/, 'Rarity signal must occur at reveal');
  assert.doesNotMatch(reveal.split('const reveal=()=>')[0], /dispatchEvent\(new CustomEvent\('mushiverse:rarity-reveal'/, 'Rarity leaked before reveal');
});

test('SSR reverse awakening appears only for a genuinely awarded SSR', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /id="mvGachaAwakening"/, 'Awakening CSS missing');
  assert.match(html, /const awakening=top==='SSR' && !reduced/, 'Awakening must require SSR and motion permission');
  assert.match(html, /phaseIndex===2/, 'Awakening should be the final phase');
  assert.match(html, /mvAwakeningBurst/, 'Final transformation class missing');
  assert.match(html, /prefers-reduced-motion:reduce/, 'Reduced-motion support missing');
});

test('gacha does not expose rarity via initial overlay CSS', () => {
  const html = readFileSync('index.html', 'utf8');
  const start = html.indexOf('function showGachaReveal(got){');
  const end = html.indexOf('\nfunction start(){ensure();render();', start);
  assert.ok(start >= 0 && end > start);
  const reveal = html.slice(start, end);
  assert.match(reveal, /overlay\.className='mv88Reveal';/, 'Initial reveal must be rarity-neutral');
  assert.match(reveal, /revealed=true;overlay\.classList\.add\('mv88-'\+top\)/, 'Rarity colors should appear only at result reveal');
  assert.match(html, /id="mvGachaSpoilerGuard"/, 'Spoiler protection CSS missing');
});

test('third gacha phase gets screen time before final result', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /phaseTimer=setInterval\(\(\)=>\{phaseIndex=Math\.min\(phaseIndex\+1,2\);updatePhase\(\);if\(phaseIndex===2\)clearInterval\(phaseTimer\)\},duration\/4\)/, 'Final phase must play before automatic reveal');
});

test('startup recovery is non-destructive and supports all main tabs', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /id="mvStartupRecoveryScript"/);
  assert.match(html, /setTimeout\(check,12000\)/);
  assert.match(html, /window\.dispatchEvent\(new Event\('mushiverse:app-ready'\)\)/);
  assert.match(html, /window\.addEventListener\('mushiverse:app-ready'/);
  assert.doesNotMatch(html.slice(html.indexOf('id="mvStartupRecoveryScript"'), html.indexOf('</script>', html.indexOf('id="mvStartupRecoveryScript"'))), /if\(visible\)return/, 'Static markup must not conceal initialization failure');
  assert.match(html, /location\.reload\(\)/);
  const recovery = html.slice(html.indexOf('id="mvStartupRecoveryScript"'), html.indexOf('</script>', html.indexOf('id="mvStartupRecoveryScript"')));
  assert.doesNotMatch(recovery, /localStorage\.clear|indexedDB\.deleteDatabase|sessionStorage\.clear/, 'Recovery must not erase user data');
});


test('dark forest surfaces keep controls readable on iPhone', () => {
  const css = readFileSync(join('css', 'adventure-ui.css'), 'utf8');
  assert.match(css, /V16: dark forest treatment/, 'Dark surface accessibility pass missing');
  assert.match(css, /color-scheme:dark/, 'Dark surface native control theme missing');
  assert.match(css, /color-scheme:light;\s*background:#fff;\s*color:#172b21/, 'Form controls must not inherit white-on-white text');
  assert.match(css, /outline:3px solid #f3c76b/, 'Focused actions need a visible outline');
  assert.match(css, /@media\(prefers-contrast:more\)/, 'High contrast dark surface fallback missing');
});


test('web build validates HTML startup tags with word boundaries', () => {
  const build = readFileSync('scripts/build-web.mjs', 'utf8');
  const correctBody = '/' + '<body' + String.fromCharCode(92) + 'b/i';
  const correctScript = '/' + '<script' + String.fromCharCode(92) + 'b/i';
  assert.ok(build.includes(correctBody), 'Body tag check must use a regex word boundary');
  assert.ok(build.includes(correctScript), 'Script tag check must use a regex word boundary');
  assert.ok(!build.includes(correctBody.replace('b/i', String.fromCharCode(92) + 'b/i')), 'Body regex must not match a literal backslash');
  assert.ok(!build.includes(correctScript.replace('b/i', String.fromCharCode(92) + 'b/i')), 'Script regex must not match a literal backslash');
});

test('iOS release build rejects empty or incomplete adventure stylesheet', () => {
  const build = readFileSync('scripts/build-web.mjs', 'utf8');
  assert.match(build, /adventureCss\.trim\(\)/, 'Empty CSS must fail release build');
  assert.match(build, /adventureCss\.includes\('--mv-surface'\)/, 'Forest palette must be present');
  const css = readFileSync('css/adventure-ui.css', 'utf8');
  assert.ok(css.trim().length > 0);
  assert.ok(css.includes('--mv-surface'));
});


test('release preflight protects existing offline bundle on invalid source', () => {
  const build = readFileSync('scripts/build-web.mjs', 'utf8');
  const preflight = build.indexOf('// Preflight source assets before deleting');
  const stagingReset = build.indexOf('rmSync(staging, { recursive: true, force: true })');
  const swap = build.indexOf('renameSync(staging, out)');
  assert.ok(preflight >= 0 && stagingReset > preflight && swap > stagingReset,
    'Source validation must precede staging and validated staging must precede replacement');
  const checks = build.slice(preflight, stagingReset);
  for (const required of ["sourceHtml.includes('adventure-ui.css')", "sourceCss.trim()", "sourceCss.includes('--mv-surface')"]) {
    assert.ok(checks.includes(required), 'Source preflight missing: ' + required);
  }
  assert.ok(!build.includes('rmSync(out, { recursive: true, force: true })'),
    'Existing bundle must not be deleted before replacement');
});

test('source preflight recognizes valid HTML body and script tags', () => {
  const build = readFileSync('scripts/build-web.mjs', 'utf8');
  const preflight = build.slice(build.indexOf('// Preflight source assets'), build.indexOf('// Build into a fresh directory'));
  const slash = String.fromCharCode(92);
  for (const tag of ['body', 'script']) {
    const correct = '/<' + tag + slash + 'b/i.test(sourceHtml)';
    const incorrect = '/<' + tag + slash + slash + 'b/i.test(sourceHtml)';
    assert.ok(preflight.includes(correct), tag + ' must use regex word boundary');
    assert.ok(!preflight.includes(incorrect), tag + ' must not match literal backslash');
  }
});


test('web bundle uses validated staging and rollback before replacing www', () => {
  const build = readFileSync('scripts/build-web.mjs', 'utf8');
  assert.match(build, /const staging = join\(root, 'www-build-staging'\)/);
  assert.match(build, /const backup = join\(root, 'www-build-previous'\)/);
  assert.match(build, /renameSync\(staging, out\)/);
  assert.match(build, /renameSync\(backup, out\)/);
  assert.doesNotMatch(build, /rmSync\(out, \{ recursive: true, force: true \}\)/);
});

test('interrupted iOS bundle swap restores previous working app', () => {
  const build = readFileSync('scripts/build-web.mjs', 'utf8');
  const restore = "if (!existsSync(out) && existsSync(backup)) renameSync(backup, out)";
  assert.ok(build.includes(restore), 'Previous offline bundle must be restored before a new build');
  assert.ok(build.indexOf(restore) < build.indexOf('// Preflight source assets'),
    'Recovery must happen before source validation can throw');
  const swap = build.slice(build.indexOf('// Only replace the previously usable offline bundle'));
  assert.match(swap, /if \(existsSync\(out\)\)/, 'Backup must not be deleted without a current bundle');
  assert.match(swap, /renameSync\(backup, out\)/, 'Failed swap must roll back');
});

test('offline iOS bundle validates referenced local startup assets before swap', () => {
  const build = readFileSync('scripts/build-web.mjs', 'utf8');
  const validation = build.indexOf('// Validate local script and stylesheet URLs');
  const swap = build.indexOf('// Only replace the previously usable offline bundle');
  assert.ok(validation >= 0 && swap > validation, 'Dependency validation must precede bundle replacement');
  const section = build.slice(validation, swap);
  assert.match(section, /html\.matchAll/, 'Local HTML assets must be scanned');
  assert.match(section, /existsSync\(asset\)/, 'Staged asset existence must be checked');
  assert.match(section, /segments\.includes\('\.\.'\)/, 'Path traversal must not escape staged assets');
  assert.match(section, /missing referenced startup asset/, 'Missing assets must fail the build');
});

test('startup dependency scanner matches local JS/CSS URLs and ignores remote URLs', () => {
  const build = readFileSync('scripts/build-web.mjs', 'utf8');
  const line = build.split('\n').find(value => value.includes('html.matchAll('));
  assert.ok(line, 'Startup dependency scanner missing');
  const expression = line.match(/html\.matchAll\((\/.*\/gi)\)/);
  assert.ok(expression, 'Startup asset scanner must use a regex literal');
  const pattern = Function('return ' + expression[1])();
  const html = '<script src="js/app.js"></script><link href="css/theme.css?v=2"><script src="https://cdn.example.org/app.js"></script>';
  assert.deepEqual([...html.matchAll(pattern)].map(match => match[1]), [
    'js/app.js', 'css/theme.css?v=2', 'https://cdn.example.org/app.js'
  ]);
});


test('offline startup dependency validation rejects directories masquerading as JS or CSS files', () => {
  const build = readFileSync('scripts/build-web.mjs', 'utf8');
  const start = build.indexOf('// Validate local script and stylesheet URLs');
  const end = build.indexOf('// Only replace the previously usable offline bundle', start);
  assert.ok(start >= 0 && end > start);
  const validation = build.slice(start, end);
  assert.match(validation, /!lstatSync\(asset\)\.isFile\(\)/,
    'A directory with a .js or .css name must not pass startup dependency validation');
});


test('offline bundle refuses empty referenced startup scripts and stylesheets', () => {
  const build = readFileSync('scripts/build-web.mjs', 'utf8');
  const validation = build.slice(build.indexOf('// Validate local script and stylesheet URLs'), build.indexOf('// Only replace the previously usable offline bundle'));
  assert.match(validation, /!readFileSync\(asset\)\.length/, 'Empty startup JS/CSS must fail before bundle swap');
  assert.match(validation, /empty referenced startup asset/, 'Failure should identify the empty startup dependency');
});


test('gacha rarity emphasis stays readable and respects reduced motion', () => {
  const css = readFileSync('css/adventure-ui.css', 'utf8');
  assert.match(css, /V17: high-contrast/);
  assert.match(css, /data-rarity="SSR"/);
  assert.match(css, /@keyframes mvSsrGlow/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /min-height:48px/);
  assert.match(css, /quest-card/);
});

test('iOS approved icon preflight rejects truncated PNG before native changes', () => {
  const script = readFileSync('scripts/prepare-ios.mjs', 'utf8');
  assert.match(script, /hasIend/);
  assert.match(script, /type === 'IEND'/);
  assert.match(script, /end === bytes.length/);
  assert.ok(script.indexOf('if (!validIcon || !hasIend)') < script.indexOf("run('npm', ['run', 'build:web'])"));
});


test('offline release rejects syntax errors in referenced startup JavaScript', () => {
  const build = readFileSync('scripts/build-web.mjs', 'utf8');
  const validation = build.slice(build.indexOf('// Validate local script and stylesheet URLs'), build.indexOf('// Only replace the previously usable offline bundle'));
  assert.match(validation, /spawnSync\(process\.execPath, \['--check', asset\]/);
  assert.match(validation, /invalid startup JavaScript/);
  assert.ok(validation.indexOf('invalid startup JavaScript') > validation.indexOf('empty referenced startup asset'));
});


test('offline startup asset scanner rejects malformed paths before replacing www', () => {
  const build = readFileSync('scripts/build-web.mjs', 'utf8');
  const validation = build.slice(build.indexOf('// Validate local script and stylesheet URLs'), build.indexOf('// Only replace the previously usable offline bundle'));
  assert.match(validation, /malformed startup asset URL/);
  assert.match(validation, /unsafe startup asset URL/);
  assert.match(validation, /segments\.includes\('\.'\)/);
});


test('native premium checkout never falls through to Stripe', () => {
  const html = readFileSync('index.html', 'utf8');
  const start = html.indexOf("async function startPremiumCheckout(productKey='premium_annual')");
  const end = html.indexOf('async function openBillingPortal()', start);
  assert.ok(start >= 0 && end > start, 'Premium checkout route missing');
  const checkout = html.slice(start, end);
  assert.match(checkout, /if\(NATIVE_SHELL\)/, 'Native purchase must have a dedicated branch');
  assert.match(checkout, /billing\.ios_iap_ready/, 'Native purchase must require server readiness');
  assert.match(checkout, /await requestNativePurchase\(productKey\)/, 'Native checkout must use Apple bridge');
  assert.ok(checkout.indexOf('await requestNativePurchase(productKey)') < checkout.indexOf('MONETIZATION.billingEnabled'),
    'Apple purchase must be routed before Stripe gating');
  assert.match(checkout, /await requestNativePurchase\(productKey\);\s*return;/,
    'Native checkout must not fall through to Stripe');
});


test('native subscription management never opens Stripe customer portal', () => {
  const html = readFileSync('index.html', 'utf8');
  const start = html.indexOf('async function openBillingPortal()');
  const end = html.indexOf('function premiumGateLabel(', start);
  assert.ok(start >= 0 && end > start);
  const portal = html.slice(start, end);
  assert.match(portal, /if\(NATIVE_SHELL\)/);
  assert.match(portal, /manageSubscriptions/);
  assert.match(portal, /billing\.ios_iap_ready/);
  assert.match(portal, /Native subscription management failed/);
  assert.ok(portal.indexOf('manageSubscriptions') < portal.indexOf('MONETIZATION.billingEnabled'));
  assert.match(portal, /return;\s*}\s*if\(!MONETIZATION\.billingEnabled\)/);
});

test('native purchases validate product keys and handle bridge exceptions', () => {
  const html = readFileSync('index.html', 'utf8');
  const start = html.indexOf("async function requestNativePurchase(plan='premium_monthly')");
  const end = html.indexOf('const MONETIZATION=', start);
  assert.ok(start >= 0 && end > start);
  const purchase = html.slice(start, end);
  assert.match(purchase, /premium_monthly/);
  assert.match(purchase, /premium_annual/);
  assert.match(purchase, /nativePurchaseBridgeAvailable\(\)/);
  assert.match(purchase, /catch\(error\)/);
  assert.match(purchase, /return false/);
});


test('Apple claim receipt never implies purchase verification or immediate rewards', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /購入申請を受け付けました。Appleの検証完了まで特典は付与されません/);
  assert.match(html, /検証完了まで特典は付与されません/);
  assert.doesNotMatch(html, /購入情報を安全に同期しました/);
});


test('Apple purchase claim endpoint preserves status and never grants entitlements', () => {
  const server = readFileSync('supabase/functions/submit-apple-purchase-claim/index.ts', 'utf8');
  assert.match(server, /existing\[0\]\.status/, 'Duplicate claims must preserve existing verification status');
  assert.match(server, /transaction_already_claimed/, 'Conflicting transaction owners must be rejected');
  assert.match(server, /\.insert\(\{/, 'Claims must be inserted without resetting existing records');
  assert.doesNotMatch(server, /\.upsert\(/, 'Client replay must not overwrite a verified claim');
  assert.doesNotMatch(server, /updateUserById|gacha_coin_wallets|gacha_coin_purchase_credits/,
    'Unverified claims must not grant paid privileges or coins');
});


test('coin store stays disabled until verified native crediting and spending exist', () => {
  const html = readFileSync('index.html', 'utf8');
  const start = html.indexOf('<script id="mv134-coin-store">');
  assert.ok(start >= 0, 'Coin store preview missing');
  const coinStore = html.slice(start, html.indexOf('</script>', start));
  assert.match(coinStore, /button\.disabled=true/, 'Coin purchases must not be enabled by a preview');
  assert.match(coinStore, /serverCreditEnabled===true/, 'Verified server credit gate missing');
  assert.match(coinStore, /現在は購入・請求できません/, 'Users must see clear unavailable status');
  assert.match(coinStore, /ガチャでの使用は準備中/, 'Purchased coin spending must not be implied ready');
});


test('Apple claims accept only registered subscription product identifiers', () => {
  const source = readFileSync('supabase/functions/submit-apple-purchase-claim/index.ts', 'utf8');
  assert.match(source, /jp\.mushiverse\.premium\.monthly/);
  assert.match(source, /jp\.mushiverse\.premium\.annual/);
  assert.match(source, /\.includes\(productId\)/, 'Product ID must be exact allowlist match');
  assert.ok(!source.includes('if(!/^jp'), 'Open-ended product prefix is unsafe');
});

test('Apple claim UI only acknowledges pending server claims', () => {
  const html = readFileSync('index.html', 'utf8');
  const start = html.indexOf('/* MUSHIVERSE_V60_APPLE_IAP_SERVER_SYNC */');
  const end = html.indexOf('async function submitMany(', start);
  assert.ok(start >= 0 && end > start);
  assert.match(html.slice(start, end), /data\.status==='pending'/);
});


test('Apple purchase claim responses are non-cacheable', () => {
  const source = readFileSync('supabase/functions/submit-apple-purchase-claim/index.ts', 'utf8');
  assert.match(source, /"Cache-Control":"no-store"/);
  assert.match(source, /"X-Content-Type-Options":"nosniff"/);
});


test('subscription renewal claims cannot cross user accounts', () => {
  const source = readFileSync('supabase/functions/submit-apple-purchase-claim/index.ts', 'utf8');
  assert.match(source, /subscription_already_claimed/);
  assert.match(source, /original_transaction_id",originalTransactionId/);
  assert.match(source, /chain\[0\]\.user_id!==user\.id/);
  assert.match(source, /invalid_original_transaction_id/);
  assert.ok(source.indexOf('subscription_already_claimed') < source.indexOf('.insert({'),
    'Renewal ownership must be checked before inserting a claim');
});


test('Apple claim endpoint validates untrusted payload without truncation', () => {
  const source = readFileSync('supabase/functions/submit-apple-purchase-claim/index.ts', 'utf8');
  assert.match(source, /request_too_large/);
  assert.match(source, /invalid_json/);
  assert.match(source, /invalid_original_transaction_id/);
  assert.match(source, /invalid_environment/);
  assert.match(source, /\\d\{6,120\}/);
  assert.doesNotMatch(source, /\.slice\(0,120\)/, 'Truncation can change transaction identity');
  assert.doesNotMatch(source, /\.slice\(0,160\)/, 'Truncation can change product identity');
});
