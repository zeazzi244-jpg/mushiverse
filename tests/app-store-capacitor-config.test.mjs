import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const readJson = (name) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));

test('iOS App Store bundle identity and offline entry are stable', () => {
  const config = readJson('capacitor.config.json');
  assert.equal(config.appId, 'com.rikuto.mushiverse');
  assert.equal(config.appName, 'MUSHIVERSE');
  assert.equal(config.webDir, 'www');
  assert.equal(config.bundledWebRuntime, false);
});

test('native WebView does not opt into unrestricted navigation or cleartext', () => {
  const config = readJson('capacitor.config.json');
  const server = config.server ?? {};
  assert.notEqual(server.cleartext, true, 'Cleartext traffic must not be enabled');
  assert.equal(server.url, undefined, 'Release builds must use bundled local assets');
  assert.ok(!Array.isArray(server.allowNavigation) || !server.allowNavigation.includes('*'),
    'Do not allow unrestricted WebView navigation');
  assert.notEqual(config.ios?.allowsLinkPreview, true,
    'Avoid unintentionally exposing external link previews in the native WebView');
});

test('release test command includes build and node test suite', () => {
  const pkg = readJson('package.json');
  assert.match(pkg.scripts['test:release'] ?? '', /npm run build:web/);
  assert.match(pkg.scripts['test:release'] ?? '', /node --test tests\/\*\.test\.mjs/);
  assert.ok(pkg.scripts['ios:check'], 'iOS release validation must remain available');
});
