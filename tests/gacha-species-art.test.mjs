import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
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
  context.document.currentScript.src = 'capacitor://localhost/js/gacha-archived-cards.js';
  runInNewContext(readFileSync('www/js/gacha-archived-cards.js', 'utf8'), context);
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
  assert.equal(context.window.mushiverseGachaCatalogue.length, 400);
  const seen = new Set();
  const { window } = context;
  for (const [rarity, roll] of [['N', 0.5], ['R', 0.1], ['SR', 0.01], ['SSR', 0.0005]]) {
    const size = window.mushiverseGachaCatalogue.filter(([, tier]) => tier === rarity).length;
    for (let i = 0; i < size; i++) {
      rolls = [roll, (i + 0.5) / size];
      const pulled = draw();
      const card = window.mushiverseOriginalCard(pulled.name) ?? window.mushiverseArchivedCard(pulled.name);
      if (card) {
        assert.equal(pulled.id, card.id);
        assert.equal(pulled.rarity, card.rarity);
        seen.add(pulled.id);
      }
    }
  }
  assert.equal(seen.size, 300);
});

test('archived and new WebP images are bundled under distinct card IDs, names and URLs', () => {
  const { window } = readExpansion();
  const archived = window.mushiverseArchivedCards;
  const originals = window.mushiverseOriginalCards;
  const html = readFileSync('www/index.html', 'utf8');
  const species = JSON.parse(html.match(/const INSECTS=(\[\[.*?\]\]);/u)[1].replaceAll("'", '"'));
  assert.equal(archived.length, 100);
  assert.equal(new Set([...species.map(([name]) => name), ...[...originals, ...archived].map(c => c.name)]).size, 400);
  assert.equal(new Set([...originals, ...archived].map(c => c.id)).size, 300);
  assert.equal(window.mushiverseArchivedCard('星霜オサムシ').id, 'AI-080');
  const photos = originals.filter(card => card.photo);
  assert.equal(photos.length, 200);
  assert.deepEqual(
    Array.from(photos, c => new URL(c.photo).pathname.split('/').at(-1)).sort(),
    readdirSync('www/assets/cards/original').filter(file => file.endsWith('.webp')).sort()
  );
  const hashes = new Set();
  for (const card of [...archived, ...photos]) {
    const path = new URL(card.photo ?? card.image).pathname;
    assert.equal(path, card.photo ? '/assets/cards/original/' + card.slug + '.webp' : '/assets/ai-insects/' + card.id + '.webp');
    const data = readFileSync('www' + path);
    assert.equal(data.toString('ascii', 0, 4), 'RIFF', card.name);
    assert.equal(data.toString('ascii', 8, 12), 'WEBP', card.name);
    const hash = createHash('sha256').update(data).digest('hex');
    assert.ok(!hashes.has(hash), card.name);
    hashes.add(hash);
  }
});

test('legacy collections and conflicting old names are resolved on read without rewriting the wallet', () => {
  const context = readExpansion();
  const queried = [];
  context.window.user = { id: 'existing-player' };
  context.localStorage = {
    getItem(key) { queried.push(key); return JSON.stringify({ cards: ['AI-080'] }); }
  };
  const entries = Object.freeze([Object.freeze({
    id: 'mv-original-amethyst-rhinoceros', name: '紫晶カブト', rarity: 'N', at: 'saved'
  })]);
  const [original, archived] = context.window.mushiverseDisplayGachaCards(entries);
  assert.deepEqual(queried, ['mushiverse-ai-collection-v1:user:existing-player']);
  assert.equal(original.name, '紫晶の林カブト');
  assert.equal(original.at, 'saved');
  assert.equal(archived.name, '星霜オサムシ');
  assert.equal(entries[0].name, '紫晶カブト');
  assert.equal(entries.length, 1);
});

test('shared card rendering selects the correct WebP and retains the original SVG as a fallback', () => {
  const context = readExpansion();
  class Element extends EventTarget {
    children = [];
    append(child) { this.children.push(child); }
  }
  context.document.createElement = () => new Element();
  runInNewContext(readFileSync('www/js/gacha-card-art.js', 'utf8'), context);
  const render = context.window.mushiverseCardArt;
  for (const card of [...context.window.mushiverseArchivedCards, ...context.window.mushiverseOriginalCards]) {
    const [image] = render(card.name, card.rarity).children;
    assert.equal(image.src, card.photo ?? card.image, card.name);
    assert.equal(image.loading, 'eager', card.name); // Detached card nodes must load before insertion.
  }
  const [photograph] = render('潮玉アゲハ', 'N', true).children;
  assert.match(photograph.src, /\/assets\/cards\/original\/tide-swallowtail\.webp$/);
  assert.equal(photograph.loading, 'eager');
  photograph.dispatchEvent(new Event('error'));
  assert.match(photograph.src, /\/assets\/cards\/original\/tide-swallowtail\.svg$/);
});
