import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Release-only check: external links that open a new tab must not retain
// access to the MUSHIVERSE WebView via window.opener.
test('shipped WebView links opening a new tab isolate their opener', () => {
  const file = join(process.cwd(), 'www', 'index.html');
  assert.ok(existsSync(file), 'run npm run build:web before release tests');
  const html = readFileSync(file, 'utf8');
  let checked = 0;
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = match[0];
    const target = tag.match(/\btarget\s*=\s*(['"])(.*?)\1/i)?.[2];
    if (target?.toLowerCase() !== '_blank') continue;
    const href = tag.match(/\bhref\s*=\s*(['"])(.*?)\1/i)?.[2] ?? '';
    if (!/^https?:\/\//i.test(href)) continue;
    checked++;
    const rel = tag.match(/\brel\s*=\s*(['"])(.*?)\1/i)?.[2] ?? '';
    const tokens = new Set(rel.toLowerCase().split(/\s+/));
    assert.ok(tokens.has('noopener') || tokens.has('noreferrer'),
      'external target=_blank link must use rel=noopener or noreferrer: ' + href);
  }
  assert.ok(checked >= 0);
});
