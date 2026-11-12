import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const releaseGate = resolve('scripts/check-ios-release.mjs');

function runGate({ appName = 'MUSHIVERSE', html, css } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'mushiverse-packaged-ui-'));
  try {
    writeFileSync(join(cwd, 'capacitor.config.json'), JSON.stringify({
      appId: 'com.rikuto.mushiverse', appName, webDir: 'www'
    }));
    mkdirSync(join(cwd, 'www', 'css'), { recursive: true });
    writeFileSync(join(cwd, 'www', 'index.html'), html ??
      '<!doctype html><html><head><link rel="stylesheet" href="css/adventure-ui.css"></head><body><script src="app.js"></script></body></html>');
    writeFileSync(join(cwd, 'www', 'css', 'adventure-ui.css'), css ?? ':root { --mv-surface: #123; }');
    return spawnSync(process.execPath, [releaseGate], { cwd, encoding: 'utf8', timeout: 15000 });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('release gate rejects truncated packaged HTML even if theme link is present', () => {
  const result = runGate({ html: '<!doctype html><html><head><link href="adventure-ui.css"></head><body><script src="app.js"></script>' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Bundled index\.html is incomplete/);
});

test('release gate rejects bundled HTML missing forest theme reference', () => {
  const result = runGate({ html: '<!doctype html><html><head></head><body><script src="app.js"></script></body></html>' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not reference the forest theme/);
});

test('release gate rejects missing palette token in packaged stylesheet', () => {
  const result = runGate({ css: 'body { color: white; }' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /empty or missing its palette/);
});

test('release gate rejects incorrect App Store display name', () => {
  const result = runGate({ appName: 'MUSHIVERSE beta' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /App display name must be MUSHIVERSE/);
});
