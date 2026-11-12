import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join, relative } from 'node:path';

// Runs after build:web via npm run test:release. Keep this independent of
// payments and app functionality: it checks only files shipped to the WebView.
const bundle = join(process.cwd(), 'www');
const forbidden = [
  { label: 'PEM private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/ },
  { label: 'Apple App Store Connect private key', pattern: /-----BEGIN PRIVATE KEY-----/ },
  { label: 'Supabase service-role key assignment', pattern: /(?:SUPABASE_SERVICE_ROLE_KEY|service_role_key)\s*[:=]\s*['"]?[A-Za-z0-9_.-]{20,}/i },
];
const textExtensions = /\.(?:html|js|css|json|svg|webmanifest)$/i;

test('iOS bundled web assets contain no private keys or privileged service-role credentials', () => {
  assert.ok(existsSync(bundle), 'Run npm run build:web before release tests');
  const pending = [bundle];
  let checked = 0;
  while (pending.length) {
    const dir = pending.pop();
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const stat = lstatSync(path);
      assert.ok(!stat.isSymbolicLink(), 'Symlink in bundle: ' + relative(bundle, path));
      if (stat.isDirectory()) { pending.push(path); continue; }
      if (!stat.isFile() || !textExtensions.test(name)) continue;
      checked++;
      const contents = readFileSync(path, 'utf8');
      for (const { label, pattern } of forbidden) {
        assert.ok(!pattern.test(contents), label + ' exposed in ' + relative(bundle, path));
      }
    }
  }
  assert.ok(checked > 0, 'No text assets checked in bundled application');
});
