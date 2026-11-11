import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

// npm run test:release builds www before running these tests.
// Only distributable assets belong inside the offline iOS WebView bundle.
test('release bundle contains no private files, source maps or symlinks', () => {
  assert.ok(existsSync('www/index.html'), 'Run npm run build:web first');
  const allowed = new Set(['.html','.js','.css','.json','.svg','.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.mp3','.wav','.webmanifest']);
  const privateName = /(?:^|[._-])(secret|private|backup|credential|credentials)(?:[._-]|$)/i;
  let scanned = 0;
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const stat = lstatSync(path);
      const rel = relative('www', path).replaceAll('\\','/');
      assert.ok(!stat.isSymbolicLink(), 'Symlink packaged: ' + rel);
      assert.ok(!name.startsWith('.') && !privateName.test(name), 'Private path packaged: ' + rel);
      assert.ok(!['node_modules','ios','android','scripts','tests','.github'].includes(name), 'Developer folder packaged: ' + rel);
      if (stat.isDirectory()) { walk(path); continue; }
      assert.ok(stat.isFile(), 'Unexpected file type: ' + rel);
      assert.ok(allowed.has(extname(name).toLowerCase()), 'Unexpected extension: ' + rel);
      assert.ok(!/\.(?:map|pem|key|p8|p12|mobileprovision|bak|orig|log)$/i.test(name), 'Sensitive file packaged: ' + rel);
      scanned++;
    }
  };
  walk('www');
  assert.ok(scanned >= 2, 'Offline bundle unexpectedly empty');
});

test('offline app entry has accessible document metadata', () => {
  const html = readFileSync('www/index.html','utf8');
  assert.match(html, /<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i, 'Document language missing');
  assert.match(html, /<meta\b[^>]*\bname\s*=\s*["']viewport["']/i, 'Mobile viewport missing');
  assert.match(html, /<title\b[^>]*>\s*[^<\s]/i, 'Accessible document title missing');
});
