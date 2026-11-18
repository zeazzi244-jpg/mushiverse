(() => {
  'use strict';
  // First-series roster recovered from 0a89fdc, with its original card IDs.
  const roster = [
    ["AI-001","アオシズクムシ","N"],
    ["AI-002","コハクコガネ","N"],
    ["AI-003","モリカゲムシ","N"],
    ["AI-004","シロハネホタル","N"],
    ["AI-005","クロガネシズクカミキリ","N"],
    ["AI-006","ミドリツノムシ","N"],
    ["AI-007","ハナシズクチョウ","N"],
    ["AI-008","ベニスジシズクコガネ","N"],
    ["AI-009","キリハネムシ","N"],
    ["AI-010","ツキイロガ","N"],
    ["AI-011","ヤマホシムシ","N"],
    ["AI-012","スナツノコガネ","N"],
    ["AI-013","ミズアオトンボ","N"],
    ["AI-014","コケイロカマキリ","N"],
    ["AI-015","チャカゲホシコガネ","N"],
    ["AI-016","シモフリホタル","N"],
    ["AI-017","ハルカゼチョウ","N"],
    ["AI-018","ヒメツノムシ","N","角雫ピュリア"],
    ["AI-019","クロモリクワガタ","N"],
    ["AI-020","アサツユコモレビムシ","N"],
    ["AI-021","キイロハネガ","N"],
    ["AI-022","ホソツノカミキリ","N","糸角セレーヌ"],
    ["AI-023","シラユキコガネ","N"],
    ["AI-024","アオモリバッタ","N"],
    ["AI-025","カゲボシホタル","N"],
    ["AI-026","ヤマシロチョウ","N"],
    ["AI-027","アカネツノムシ","N"],
    ["AI-028","コガネハネムシ","N"],
    ["AI-029","ミズカゲトンボ","N"],
    ["AI-030","ヒスイコオロギ","N"],
    ["AI-031","クサイロカマキリ","N","草燐の鎌ラフィル"],
    ["AI-032","ホシスジカミキリ","N","星譜ルシオン"],
    ["AI-033","ツチイロコガネ","N"],
    ["AI-034","アオハネセミ","N"],
    ["AI-035","コモレビチョウ","N"],
    ["AI-036","ヨルシズクムシ","N"],
    ["AI-037","シロツノコガネ","N"],
    ["AI-038","ヤマカゼガ","N"],
    ["AI-039","クロシズクホタル","N"],
    ["AI-040","キンイロハナムグリ","N","蜜金リンデル"],
    ["AI-041","ルリカゲクワガタ","R"],
    ["AI-042","アカツキコガネ","R"],
    ["AI-043","ギンセツホタル","R"],
    ["AI-044","ムラサキツノムシ","R"],
    ["AI-045","コハクハネチョウ","R"],
    ["AI-046","アオホシカミキリ","R","蒼刻の角アンセラ"],
    ["AI-047","ヒカリツノカブト","R"],
    ["AI-048","シロガネトンボ","R"],
    ["AI-049","ベニシズクガ","R"],
    ["AI-050","ツキカゲコガネ","R"],
    ["AI-051","ハクギンカマキリ","R"],
    ["AI-052","ヒスイハネムシ","R"],
    ["AI-053","クロホシクワガタ","R"],
    ["AI-054","キンモンチョウ","R","金紋シェルヴァ"],
    ["AI-055","アオツキホタル","R"],
    ["AI-056","シンジュコガネ","R"],
    ["AI-057","ベニツノカブト","R"],
    ["AI-058","セイランカミキリ","R"],
    ["AI-059","ヨゾラハネガ","R"],
    ["AI-060","コガネシズクトンボ","R"],
    ["AI-061","スミレクワガタ","R"],
    ["AI-062","ハクヨウホタル","R"],
    ["AI-063","ルリツノコガネ","R"],
    ["AI-064","アカホシカマキリ","R","朱星の鎌ネフェラ"],
    ["AI-065","ギンハネチョウ","R"],
    ["AI-066","クロガネカブト","R"],
    ["AI-067","シロツキコガネ","R"],
    ["AI-068","ミカヅキトンボ","R","弧月リュネット"],
    ["AI-069","アオギンハナムグリ","R"],
    ["AI-070","コハクツノクワガタ","R"],
    ["AI-071","蒼晶クワガタ","SR"],
    ["AI-072","紅蓮カブト","SR"],
    ["AI-073","月光モルフォ","SR"],
    ["AI-074","紫電オオツノ","SR"],
    ["AI-075","翠玉ハナムグリ","SR"],
    ["AI-076","白銀ホタル","SR"],
    ["AI-077","琥珀オオカマキリ","SR"],
    ["AI-078","蒼月トンボ","SR"],
    ["AI-079","黒曜カブト","SR"],
    ["AI-080","星霜オサムシ","SR"],
    ["AI-081","氷晶クワガタ","SR"],
    ["AI-082","金剛カミキリ","SR"],
    ["AI-083","緋晶ハネムシ","SR"],
    ["AI-084","天青モルフォ","SR"],
    ["AI-085","幻月ホタル","SR"],
    ["AI-086","紫晶カブト","SR"],
    ["AI-087","翠嵐オオカマキリ","SR"],
    ["AI-088","銀河トンボ","SR"],
    ["AI-089","白虹クワガタ","SR"],
    ["AI-090","蒼炎コガネ","SR"],
    ["AI-091","天晶カブト","SSR"],
    ["AI-092","虹皇モルフォ","SSR"],
    ["AI-093","神威クワガタ","SSR"],
    ["AI-094","星帝オオカブト","SSR"],
    ["AI-095","幻煌ホタル","SSR"],
    ["AI-096","天雷オオツノ","SSR"],
    ["AI-097","黒皇クワガタ","SSR"],
    ["AI-098","聖晶モルフォ","SSR"],
    ["AI-099","銀天オオカマキリ","SSR"],
    ["AI-100","創世カブト","SSR"],
  ];
  const artBase = new URL('../assets/ai-insects/', document.currentScript?.src || document.baseURI);
  const byName = new Map();
  const byId = new Map();
  const cards = roster.map(([id, legacyName, rarity, name = legacyName]) => {
    const card = Object.freeze({ id, name, rarity, image: new URL(id + '.webp', artBase).href });
    byName.set(legacyName, card);
    byName.set(name, card);
    byId.set(id, card);
    return card;
  });

  window.mushiverseArchivedCards = Object.freeze(cards);
  window.mushiverseArchivedCard = key => byId.get(key) ?? byName.get(key);

  window.mushiverseDisplayGachaCards = entries => {
    const displayed = entries.map(entry => {
      const card = byId.get(entry?.id) ?? window.mushiverseOriginalCardById?.(entry?.id)
        ?? window.mushiverseClassicCard?.(entry?.id ?? entry?.name)
        ?? (!entry?.id ? byName.get(entry?.name) : undefined);
      return card && (card.name !== entry.name || card.rarity !== entry.rarity || card.id !== entry.id)
        ? { ...entry, id: card.id, name: card.name, rarity: card.rarity }
        : entry;
    });
    // Early builds also supported a separate AI-only collection for this account.
    // Read that source for display, while the wallet and its history stay intact.
    try {
      const account = window.user?.id ? 'user:' + window.user.id : 'guest';
      const data = JSON.parse(localStorage.getItem('mushiverse-ai-collection-v1:' + account) || '[]');
      const saved = Array.isArray(data) ? data : data?.cards;
      if (Array.isArray(saved)) {
        for (const entry of saved) {
          const card = byId.get(typeof entry === 'string' ? entry : entry?.id);
          if (card) displayed.push({ id: card.id, name: card.name, rarity: card.rarity });
        }
      }
    } catch {
      // An unavailable or malformed legacy collection must not hide wallet cards.
    }
    return displayed;
  };
})();
