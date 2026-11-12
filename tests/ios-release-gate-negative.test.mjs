import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const releaseCheck = resolve('scripts/check-ios-release.mjs');

test('iOS release gate rejects incomplete native builds even when appId is valid', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mushiverse-release-gate-'));
  try {
    writeFileSync(join(directory, 'capacitor.config.json'), JSON.stringify({
      appId: 'com.rikuto.mushiverse',
      webDir: 'www'
    }));
    mkdirSync(join(directory, 'www'));
    writeFileSync(join(directory, 'www', 'index.html'), '<!doctype html><title>Test</title>');
    const result = spawnSync(process.execPath, [releaseCheck], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 15000
    });
    assert.equal(result.error, undefined, result.error?.message);
    assert.notEqual(result.status, 0, 'incomplete iOS build must never pass release gate');
    assert.match(result.stderr, /NOT READY FOR iOS RELEASE/);
    assert.match(result.stderr, /Native Xcode project not generated/);
    assert.match(result.stderr, /Approved AppIcon assets are missing/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('iOS release gate rejects remote server URL and missing offline assets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mushiverse-release-remote-'));
  try {
    writeFileSync(join(directory, 'capacitor.config.json'), JSON.stringify({
      appId: 'com.rikuto.mushiverse',
      webDir: 'www',
      server: { url: 'https://example.invalid' }
    }));
    const result = spawnSync(process.execPath, [releaseCheck], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 15000
    });
    assert.equal(result.error, undefined, result.error?.message);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Remote server.url is not allowed/);
    assert.match(result.stderr, /Bundled web assets missing/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
