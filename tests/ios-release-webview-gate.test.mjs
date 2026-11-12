import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const releaseGate = resolve('scripts/check-ios-release.mjs');

function checkServer(server) {
  const cwd = mkdtempSync(join(tmpdir(), 'mushiverse-webview-gate-'));
  try {
    writeFileSync(join(cwd, 'capacitor.config.json'), JSON.stringify({
      appId: 'com.rikuto.mushiverse', webDir: 'www', server,
    }));
    return spawnSync(process.execPath, [releaseGate], { cwd, encoding: 'utf8' });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('iOS release gate rejects cleartext WebView configuration', () => {
  const result = checkServer({ cleartext: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cleartext WebView traffic is forbidden/);
});

test('iOS release gate rejects unrestricted WebView navigation', () => {
  const result = checkServer({ allowNavigation: ['*'] });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /WebView allowNavigation must be empty/);
});

test('iOS release gate rejects malformed navigation allowlist', () => {
  const result = checkServer({ allowNavigation: '*' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid WebView allowNavigation configuration/);
});
