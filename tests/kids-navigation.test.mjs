import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('kids mode prevents record and map navigation through home buttons', () => {
  const tabSource = html.split('\n').find((line) => line.startsWith('function tab(name)'));
  const body = { dataset: { screen: 'home' }, classList: { contains: () => true } };
  const document = { body };
  runInNewContext(tabSource + "\n tab('post'); tab('map');", { document });
  assert.equal(body.dataset.screen, 'home');
  assert.match(html, /body\.mv128Kids #home > :not\(\.mvAdventureHero\)/);
  assert.match(html, /body\.mv128Kids #home \.mvAdventurePrimary\{display:none!important\}/);
});
