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

function readExpansion() {
  const window = {};
  const context = { window, URL, document: { currentScript: { src: 'capacitor://localhost/js/gacha-original-cards.js' } } };
  runInNewContext(readFileSync('www/js/gacha-original-cards.js', 'utf8'), context);
  return context;
}

test('the offline bundle includes 200 distinct, named originals and keeps the legacy catalogue intact', () => {
  const { window } = readExpansion();
  const html = readFileSync('www/index.html', 'utf8');
  const legacy = JSON.parse(html.match(/const INSECTS=(\[\[.*?\]\]);/u)[1].replaceAll("'", '"'));
  const cards = window.mushiverseOriginalCards;
  assert.equal(legacy.length, 100);
  assert.equal(cards.length, 200);
  assert.deepEqual(Object.fromEntries(['N', 'SR'].map(tier => [tier, cards.filter(card => card.rarity === tier).length])), { N: 195, SR: 5 });
  assert.equal(new Set([...legacy.map(row => row[0]), ...cards.map(card => card.name)]).size, 300);
  const drawings = new Set();
  for (const card of cards) {
    assert.match(card.slug, /^[a-z]+(?:-[a-z]+)+$/);
    assert.equal(card.id, 'mv-original-' + card.slug);
    assert.equal(window.mushiverseOriginalCard(card.name), card);
    assert.equal(new URL(card.image).pathname, '/assets/cards/original/' + card.slug + '.svg');
    const svg = readFileSync('www' + new URL(card.image).pathname, 'utf8');
    assert.ok(svg.includes('<title>' + card.name + '</title>'), card.name);
    assert.equal(svg.includes('stroke-dasharray="2 6"'), card.rarity === 'SR', card.name);
    drawings.add(svg.replace(/<title>.*?<\/title>/u, ''));
  }
  assert.equal(new Set(cards.map(card => card.id)).size, 200);
  assert.equal(new Set(cards.map(card => card.image)).size, 200);
  assert.equal(drawings.size, 200);
});

test('the live draw function can award every original and preserves all existing tier thresholds', () => {
  const context = readExpansion();
  const html = readFileSync('www/index.html', 'utf8');
  const catalogue = html.match(/const INSECTS=\[\[.*?\]\];[\s\S]*?(?=\nconst MV80_INFO)/u)[0];
  const pick = html.match(/function pick\(\)\{[^\n]+/u)[0];
  let rolls = [];
  context.Math = { floor: Math.floor, random: () => rolls.shift() };
  const draw = runInNewContext(catalogue + '\n' + pick + '\npick', context);
  const sizes = { N: 0, R: 0, SR: 0, SSR: 0 };
  for (let slot = 0; slot < 1000; slot++) {
    rolls = [(slot + 0.5) / 1000, 0];
    sizes[draw().rarity]++;
  }
  assert.deepEqual(sizes, { N: 800, R: 180, SR: 19, SSR: 1 });
  assert.equal(context.window.mushiverseGachaCatalogue.length, 300);
  const seen = new Set();
  for (const [rarity, size] of [['N', 235], ['SR', 25]]) {
    for (let i = 0; i < size; i++) {
      rolls = [rarity === 'N' ? 0.5 : 0.01, (i + 0.5) / size];
      const pulled = draw();
      const original = context.window.mushiverseOriginalCard(pulled.name);
      if (original) {
        assert.equal(pulled.id, original.id);
        assert.equal(pulled.rarity, original.rarity);
        seen.add(pulled.id);
      }
    }
  }
  assert.equal(seen.size, 200);
});
