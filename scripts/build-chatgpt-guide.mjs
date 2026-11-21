import { readFile, writeFile, access } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const site = new URL('https://zeazzi244-jpg.github.io/mushiverse/');
const cards = [];
for (const series of ['Classic', 'Archived', 'Original']) {
  const script = 'js/gacha-' + series.toLowerCase() + '-cards.js';
  const window = {};
  vm.runInNewContext(await readFile(new URL(script, root), 'utf8'), {
    URL, window, document: { currentScript: { src: new URL(script, site).href } },
  });
  for (const card of window['mushiverse' + series + 'Cards']) {
    const image = card.photo || card.image;
    if (!image?.startsWith(site.href)) throw Error('Unexpected artwork for ' + card.id);
    await access(new URL(image.slice(site.href.length), root));
    cards.push({ id: card.id, name: card.name, rarity: card.rarity, habitat: card.habitat || '', description: card.description || '', image });
  }
}
await access(new URL('assets/cards/albaseraph.webp', root));
cards.push({id:'albaseraph',name:'アルバセラフ',rarity:'LR',habitat:'',description:'',image:new URL('assets/cards/albaseraph.webp',site).href});
if (new Set(cards.map(card => card.id)).size !== cards.length) throw Error('Duplicate card ID');
await writeFile(new URL('supabase/functions/mushiverse-guide/cards.json',root),JSON.stringify(cards,null,2)+'\n');
console.log(cards.length + ' cards and artwork paths verified');
