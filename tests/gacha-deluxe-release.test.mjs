import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { Script } from 'node:vm';

const scripts = [
  'js/gacha-immersive-stage.js',
  'js/gacha-spectacle-effects.js',
  'js/gacha-deluxe-reveal.js',
];
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('cinematic gacha layers are shipped in the existing app', () => {
  const order = scripts.map(file => {
    const tag = '<script src="' + file + '"></script>';
    const first = html.indexOf(tag);
    assert.notEqual(first, -1, file + ' missing from main HTML');
    assert.equal(html.indexOf(tag, first + tag.length), -1, file + ' loaded twice');
    assert.ok(existsSync(new URL('../' + file, import.meta.url)), file + ' missing');
    return first;
  });
  assert.ok(order[0] < order[1] && order[1] < order[2], 'effects must load after fullscreen stage');
});

test('all cinematic presentation scripts parse independently', () => {
  for (const file of scripts) {
    const text = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.doesNotThrow(() => new Script(text, { filename: file }));
    assert.match(text, /prefers-reduced-motion:reduce/, file + ' must respect reduced motion');
  }
});

test('presentation scripts do not duplicate reward or payment logic', () => {
  for (const file of scripts) {
    const text = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /\b(?:state\.coins\s*[-+]?=|state\.cards\.push|state\.tickets\s*[-+]?=)\b/, file + ' mutates rewards');
    assert.doesNotMatch(text, /\b(?:StoreKit|purchaseProduct|createPayment|verifyTransaction)\s*\(/, file + ' contains purchase operations');
  }
  assert.match(html, /function showGachaReveal\(got\)/);
  assert.match(html, /function draw\(n\)/);
});

test('fullscreen stage retains an obvious exit and safe focus handling', () => {
  const stage = readFileSync(new URL('../js/gacha-immersive-stage.js', import.meta.url), 'utf8');
  assert.match(stage, /mvImmersiveClose/);
  assert.match(stage, /key==='Escape'/);
  assert.match(stage, /lastFocus/);
});
