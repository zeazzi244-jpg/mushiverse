import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Release gate for the core forest design tokens. This is not a full WCAG
// audit of every computed element or gradient; it catches palette regressions.
const css = readFileSync(new URL('../css/adventure-ui.css', import.meta.url), 'utf8');
const tokens = Object.fromEntries(
  [...css.matchAll(/(--mv-(?:surface|surface-raised|text|muted))\s*:\s*(#[0-9a-f]{6})\b/gi)]
    .map((match) => [match[1], match[2]])
);
function luminance(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
test('core forest foreground tokens meet WCAG AA normal-text contrast on dark surfaces', () => {
  for (const background of ['--mv-surface', '--mv-surface-raised']) {
    for (const foreground of ['--mv-text', '--mv-muted']) {
      assert.ok(tokens[foreground] && tokens[background], 'Missing color token: ' + foreground + ' / ' + background);
      assert.ok(contrast(tokens[foreground], tokens[background]) >= 4.5,
        foreground + ' on ' + background + ' must meet 4.5:1');
    }
  }
});
