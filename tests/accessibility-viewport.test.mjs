import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Pinch-to-zoom is essential for readers with low vision.
// Reject viewport directives that disable or severely limit zoom.
function viewportIssues(html) {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]);
  const viewport = metas.filter(tag => /\bname\s*=\s*["']viewport["']/i.test(tag));
  const issues = [];
  for (const tag of viewport) {
    const match = tag.match(/\bcontent\s*=\s*(["'])(.*?)\1/i);
    if (!match) continue;
    const directives = Object.fromEntries(match[2].split(/[;,]/).map(s => s.trim().split(/\s*=\s*/, 2)).filter(x => x.length === 2).map(([k,v]) => [k.toLowerCase(),v.toLowerCase()]));
    if (directives['user-scalable'] === 'no' || directives['user-scalable'] === '0') issues.push('user-scalable disables zoom');
    if ('maximum-scale' in directives && Number(directives['maximum-scale']) < 2) issues.push('maximum-scale restricts zoom');
  }
  return issues;
}
test('viewport guard catches zoom restrictions', () => {
  assert.deepEqual(viewportIssues('<meta name="viewport" content="width=device-width, user-scalable=no">'), ['user-scalable disables zoom']);
  assert.deepEqual(viewportIssues('<meta name="viewport" content="maximum-scale=1.0">'), ['maximum-scale restricts zoom']);
  assert.deepEqual(viewportIssues('<meta name="viewport" content="width=device-width, initial-scale=1">'), []);
});
test('bundled app does not block accessibility pinch zoom', () => {
  const html = readFileSync('www/index.html', 'utf8');
  assert.deepEqual(viewportIssues(html), [], 'App Store build must not disable pinch-to-zoom');
});
