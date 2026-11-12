import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Runs after build:web via npm run test:release. Inspect the actual offline
// payload rather than source files excluded by the release packager.
const root = join(process.cwd(), 'www');
const sensitiveNames = /(?:^|[._-])(?:\.env|credentials?|secrets?|private|id_rsa)(?:$|[._-])/i;
const forbiddenExtensions = /\.(?:pem|p8|p12|mobileprovision|key|map|log|bak)$/i;
const privateKeyHeader = /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/;

test('iOS offline bundle excludes credentials and private key material', () => {
  const pending = [root];
  let inspected = 0;
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const name = relative(root, path);
      assert.equal(entry.isSymbolicLink(), false, 'Symlink in release payload: ' + name);
      assert.equal(sensitiveNames.test(entry.name), false, 'Sensitive filename: ' + name);
      assert.equal(forbiddenExtensions.test(entry.name), false, 'Forbidden extension: ' + name);
      if (entry.isDirectory()) { pending.push(path); continue; }
      assert.equal(entry.isFile(), true, 'Unexpected file type: ' + name);
      inspected++;
      if (/\.(?:html|js|css|json|svg|webmanifest)$/i.test(entry.name)) {
        const source = readFileSync(path, 'utf8');
        assert.equal(privateKeyHeader.test(source), false, 'Private key header in: ' + name);
      }
    }
  }
  assert.ok(inspected > 0, 'Release bundle must contain files');
});
