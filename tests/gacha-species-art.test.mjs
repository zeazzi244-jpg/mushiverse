import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

test('every shipped gacha species has a distinct offline illustration', () => {
  const html = readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../www/js/gacha-species-art.js', import.meta.url), 'utf8');
  const catalogue = html.match(/const INSECTS=(\[\[.*?\]\]);/u)[1];
  const cards = JSON.parse(catalogue.replaceAll("'", '"'));
  const window = {};
  runInNewContext(source, { window });
  const urls = cards.map(([name, rarity]) => {
    const url = window.mushiverseSpeciesIllustration(name, rarity);
    assert.match(url, /^data:image\/svg\+xml;/, name);
    return url;
  });
  assert.equal(cards.length, 100);
  assert.equal(new Set(urls).size, cards.length);
  assert.equal(window.mushiverseSpeciesIllustration('unknown card', 'N'), '');
});
