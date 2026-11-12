import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../capacitor.config.json', import.meta.url), 'utf8'));

test('App Store release uses bundled local content, not a remote origin', () => {
  assert.equal(config.webDir, 'www');
  assert.equal(config.server?.url, undefined, 'Remote server.url must not be used in App Store builds');
  assert.notEqual(config.server?.cleartext, true, 'Cleartext WebView traffic must not be enabled');
  assert.equal(config.server?.allowNavigation?.length ?? 0, 0, 'Unrestricted navigation must not be enabled');
});

test('App Store release keeps the approved application identity', () => {
  assert.equal(config.appId, 'com.rikuto.mushiverse');
  assert.equal(config.appName, 'MUSHIVERSE');
});
