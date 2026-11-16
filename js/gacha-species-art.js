(() => {
  'use strict';

  // Body shape, colors, markings and proportions for each named card.
  const species = new Map([
    ['ナナホシテントウ', ['lady', '#c52f24', '#171619', '7', 1]],
    ['モンシロチョウ', ['butterfly', '#f6f1d9', '#30342c', 'dots', .92]],
    ['アブラゼミ', ['cicada', '#91552c', '#51301b', 'amber', 1]],
    ['ミンミンゼミ', ['cicada', '#6e9156', '#254538', 'clear', 1.06]],
    ['ツクツクボウシ', ['cicada', '#bc904f', '#504231', 'clear', .87]],
    ['クマゼミ', ['cicada', '#323632', '#9da960', 'clear', 1.16]],
    ['ニイニイゼミ', ['cicada', '#867d71', '#453730', 'mottled', .78]],
    ['ショウリョウバッタ', ['grass', '#7e9b47', '#435228', 'slant', 1]],
    ['オンブバッタ', ['grass', '#98aa59', '#7d4e43', 'slant', .8]],
    ['トノサマバッタ', ['grass', '#94a459', '#604941', 'bands', 1.15]],
    ['エンマコオロギ', ['cricket', '#543a2a', '#c49561', 'large', 1.05]],
    ['スズムシ', ['cricket', '#292b32', '#50576d', 'large', .85]],
    ['マツムシ', ['cricket', '#907542', '#d4c379', 'light', .88]],
    ['カネタタキ', ['cricket', '#93694b', '#402b24', 'small', .68]],
    ['オオカマキリ', ['mantis', '#7b9d46', '#d3bd85', 'long', 1.12]],
    ['ハラビロカマキリ', ['mantis', '#91a64c', '#e3d89b', 'broad', 1]],
    ['コカマキリ', ['mantis', '#a67b58', '#c89e77', 'patch', .85]],
    ['ナミテントウ', ['lady', '#ec7b29', '#251e22', '12', 1.12]],
    ['アオスジアゲハ', ['swallow', '#292939', '#76e5d1', 'band', 1.04]],
    ['キアゲハ', ['swallow', '#eac991', '#342a28', 'stripes', 1.13]],
    ['モンキチョウ', ['butterfly', '#e9d442', '#423c36', 'edge', 1]],
    ['ヤマトシジミ', ['butterfly', '#9eaed0', '#575f91', 'edge', .72]],
    ['ベニシジミ', ['butterfly', '#d67338', '#29232a', 'spots', .78]],
    ['オツネントンボ', ['dragon', '#c6a780', '#7d613e', 'amber', .78]],
    ['シオカラトンボ', ['dragon', '#8daec5', '#2d3739', 'clear', 1.02]],
    ['オオシオカラトンボ', ['dragon', '#5189af', '#243344', 'clear', 1.09]],
    ['アキアカネ', ['dragon', '#c0472b', '#393235', 'red', .96]],
    ['ナツアカネ', ['dragon', '#e57537', '#aa2c20', 'red', 1.03]],
    ['コシアキトンボ', ['dragon', '#24212c', '#f2ead7', 'belt', .93]],
    ['ハグロトンボ', ['dragon', '#2e8065', '#292335', 'dark', .88]],
    ['クロアゲハ', ['swallow', '#32303a', '#9f504d', 'tail', 1.1]],
    ['カナブン', ['scarab', '#5c895c', '#ba8862', 'smooth', .99]],
    ['コガネムシ', ['scarab', '#71a346', '#a7ba56', 'smooth', .92]],
    ['シロテンハナムグリ', ['scarab', '#6d6656', '#ece5bf', 'flecks', 1.05]],
    ['マメコガネ', ['scarab', '#397551', '#b7794d', 'tuft', .81]],
    ['ゴマダラカミキリ', ['longhorn', '#252936', '#efeddf', 'flecks', .99]],
    ['アメンボ', ['skater', '#4d4036', '#936857', 'slender', .96]],
    ['ゲンゴロウモドキ', ['water', '#2f3935', '#c8ae65', 'oval', 1]],
    ['オケラ', ['cricket', '#8e6b4b', '#dbac7d', 'shovel', 1.02]],
    ['クビキリギス', ['grass', '#89ad56', '#58583e', 'long', 1.1]],
    ['アゲハチョウ', ['swallow', '#f4de9f', '#38362c', 'stripes', 1]],
    ['カブトムシ', ['horn', '#82472c', '#4c251c', 'fork', 1]],
    ['ミヤマカラスアゲハ', ['swallow', '#356f73', '#8bf3d6', 'sheen', 1.12]],
    ['ナガサキアゲハ', ['swallow', '#2f293c', '#dcd2b0', 'pale', 1.13]],
    ['ジャコウアゲハ', ['swallow', '#342a40', '#e36c64', 'tail', .95]],
    ['オオムラサキ', ['butterfly', '#6552ab', '#f2e3b2', 'spots', 1.14]],
    ['ルリタテハ', ['butterfly', '#392a45', '#78aee7', 'band', .98]],
    ['アサギマダラ', ['butterfly', '#8cc5c4', '#422f31', 'lattice', 1.07]],
    ['キタテハ', ['butterfly', '#cb7d3d', '#523629', 'jagged', .94]],
    ['ツマグロヒョウモン', ['butterfly', '#db803b', '#302838', 'tips', 1.04]],
    ['ヒオドシチョウ', ['butterfly', '#b96036', '#513030', 'trim', 1]],
    ['ミドリヒョウモン', ['butterfly', '#d3954b', '#533c31', 'spots', 1.1]],
    ['オニヤンマ', ['dragon', '#2e3532', '#e9c647', 'striped', 1.16]],
    ['ギンヤンマ', ['dragon', '#77c2c5', '#758d55', 'clear', 1.09]],
    ['ウチワヤンマ', ['dragon', '#383e36', '#e6b850', 'paddle', 1.03]],
    ['チョウトンボ', ['dragon', '#384f94', '#9dadd8', 'broad', .94]],
    ['ルリボシヤンマ', ['dragon', '#54a5ca', '#514533', 'striped', 1.12]],
    ['タガメ', ['water', '#6e533c', '#9d7649', 'raptor', 1.14]],
    ['タイコウチ', ['water', '#987f59', '#5e4a38', 'tube', .95]],
    ['ミズカマキリ', ['water', '#958c6e', '#544738', 'needle', .83]],
    ['ヤマトタマムシ', ['jewel', '#48876d', '#c85a67', 'stripes', 1.12]],
    ['ウバタマムシ', ['jewel', '#655749', '#d9a373', 'flecks', .98]],
    ['ノコギリカミキリ', ['longhorn', '#664634', '#a69b75', 'smooth', 1.12]],
    ['キボシカミキリ', ['longhorn', '#4d4133', '#d6a967', 'flecks', .9]],
    ['センチコガネ', ['scarab', '#4b4b69', '#9388be', 'shine', .93]],
    ['オオセンチコガネ', ['scarab', '#76518a', '#d28bb1', 'shine', 1.11]],
    ['ミヤマクワガタ', ['stag', '#775841', '#cb995f', 'crown', 1.11]],
    ['コクワガタ', ['stag', '#48434a', '#796a66', 'stub', .85]],
    ['ヒラタクワガタ', ['stag', '#3d383b', '#97706a', 'flat', 1.06]],
    ['アオカナブン', ['scarab', '#3b975a', '#96d69a', 'smooth', 1.04]],
    ['ノコギリクワガタ', ['stag', '#9b5840', '#de9a62', 'saw', 1.08]],
    ['オオクワガタ', ['stag', '#40383b', '#8b7875', 'heavy', 1.12]],
    ['ネブトクワガタ', ['stag', '#674838', '#b5865a', 'tooth', .83]],
    ['スジクワガタ', ['stag', '#503c39', '#9c7960', 'grooves', .86]],
    ['アカアシクワガタ', ['stag', '#52443b', '#a74229', 'redlegs', .96]],
    ['ヒメオオクワガタ', ['stag', '#3d343a', '#685d61', 'wide', 1]],
    ['オオゴマダラ', ['butterfly', '#efebd9', '#313136', 'lattice', 1.14]],
    ['ミカドアゲハ', ['swallow', '#72523a', '#86cbd4', 'broken', .91]],
    ['ギフチョウ', ['swallow', '#e3c16b', '#39302e', 'striped', .95]],
    ['ヒメギフチョウ', ['swallow', '#f1d995', '#393139', 'striped', .86]],
    ['ウスバシロチョウ', ['butterfly', '#e7e3d8', '#655c5a', 'translucent', .95]],
    ['クジャクチョウ', ['butterfly', '#a65c4e', '#74bbd3', 'eyes', 1.07]],
    ['コムラサキ', ['butterfly', '#956e47', '#bb78dc', 'violet', 1.02]],
    ['ムラサキシジミ', ['butterfly', '#5f4989', '#a096e3', 'violet', .83]],
    ['ミドリシジミ', ['butterfly', '#5ab4a6', '#345a54', 'edge', .8]],
    ['ハンミョウ', ['scarab', '#45685c', '#e6cc9d', 'tiger', 1.03]],
    ['ニワハンミョウ', ['scarab', '#745743', '#dcb890', 'tiger', .97]],
    ['ルリボシカミキリ', ['longhorn', '#6b9aba', '#272a38', 'blue', .99]],
    ['ゴマダラチョウ', ['butterfly', '#e9eccf', '#39333b', 'spots', 1.02]],
    ['アオヤンマ', ['dragon', '#73b889', '#406448', 'green', 1.08]],
    ['ニジイロクワガタ', ['stag', '#72a879', '#dc926e', 'rainbow', .92]],
    ['ヘラクレスオオカブト', ['horn', '#b19155', '#554231', 'long', 1.13]],
    ['コーカサスオオカブト', ['horn', '#695239', '#a18059', 'triple', 1.09]],
    ['アトラスオオカブト', ['horn', '#815f38', '#d1a46b', 'triple', .98]],
    ['エレファスゾウカブト', ['horn', '#988364', '#c8ad7b', 'elephant', 1.15]],
    ['ネプチューンオオカブト', ['horn', '#4f3742', '#b88f81', 'long', 1.04]],
    ['サタンオオカブト', ['horn', '#4e423e', '#c1a475', 'fuzzy', 1]],
    ['ギラファノコギリクワガタ', ['stag', '#51392f', '#916c51', 'giraffe', 1.11]],
    ['パラワンオオヒラタクワガタ', ['stag', '#36323e', '#877a81', 'flat', 1.14]],
    ['マンディブラリスフタマタクワガタ', ['stag', '#674745', '#a58368', 'split', 1.02]],
  ]);

  const path = (d, fill, stroke = '#171d22', width = 2.4) =>
    `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const oval = (x, y, rx, ry, fill, stroke = 'none') =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
  const pair = shape => shape + `<g transform="scale(-1 1)">${shape}</g>`;

  function wings(family, marking, accent) {
    const tail = family === 'swallow';
    const upper = 'M0 -6 C-15 -46 -69 -78 -82 -57 C-91 -38 -75 -9 -60 5 Q-25 24 0 9Z';
    const lower = tail
      ? 'M-3 2 Q-48 -8 -66 12 Q-69 37 -49 45 L-50 61 Q-46 70 -42 59 L-36 43 Q-13 48 -1 20Z'
      : 'M-3 2 Q-46 -8 -66 12 Q-73 37 -46 49 Q-15 60 -1 20Z';
    const dots = [[-60,-38,5],[-48,-29,4],[-36,-21,3],[-52,20,4],[-37,28,3]];
    const veins = path('M-1 5 Q-32 -21 -74 -51 M-5 5 Q-48 -9 -78 -22 M-5 10 L-55 36 M-5 12 L-30 44','none','#fff3d0',0.8);
    const edge = path('M-32 -35 Q-68 -76 -82 -57 Q-91 -43 -79 -28 Q-70 -51 -57 -47Z',accent);
    const band = path('M-26 -17 Q-44 -47 -63 -49 L-71 -40 Q-46 -34 -35 -7 L-51 22 L-41 30 Q-27 16 -20 -4Z',accent,'none');
    const stripes = path('M-11 -19 L-22 -32 -36 -10 -49 -50 -57 -51 -52 -20 -67 -37 -73 -34 -67 -11 -59 -3 -53 -10 -45 2 -39 -1 -36 -16 -23 2Z',accent,'none');
    const marks = {
      dots: oval(-66,-27,6,5,accent)+oval(-50,-14,4,3,accent),
      spots: dots.map(([x,y,r])=>oval(x,y,r,r+1,accent)).join(''),
      edge, stripes: edge+stripes, striped: stripes+path('M-52 32 Q-32 41 -18 29','none',accent,5),
      band, broken: band+path('M-52 -27 L-34 -37','none','#553628',4),
      jagged: edge+path('M-69 22 L-59 27 -58 34 -46 35 -43 45','none',accent,5),
      trim: edge+path('M-61 36 Q-44 55 -23 42','none',accent,6),
      tips: edge+oval(-67,-37,4,6,'#fff4dc')+oval(-53,18,5,4,accent),
      lattice: veins+path('M-76 -43 Q-53 -29 -49 -4 M-61 11 Q-41 15 -32 43','none',accent,4),
      tail: path('M-60 29 Q-46 23 -38 33 Q-55 45 -60 29Z',accent,'none'),
      sheen: band+path('M-58 22 Q-42 36 -28 28','none',accent,3),
      pale: oval(-38,23,18,12,accent),
      eyes: oval(-65,-35,12,11,'#34262c')+oval(-65,-35,7,6,accent)+oval(-50,27,10,8,accent),
      translucent: veins+oval(-57,-29,8,6,accent),
      violet: oval(-43,-21,22,11,accent)+oval(-42,20,15,9,accent)
    };
    return pair(path(lower,'url(#shell)')+path(upper,'url(#shell)')+veins+(marks[marking]??''))
      +oval(0,1,5,33,'#29272b')+oval(0,-27,6,7,'#302a2c')
      +pair(path('M-2 -32 Q-7 -43 -18 -52','none','#302a2c',2)+oval(-18,-52,2,2,'#302a2c'));
  }

  function dragon(marking, accent) {
    const broad = marking === 'broad';
    const wingColor = marking === 'dark' ? '#333049' : broad ? '#727fc0' : '#dce8e2';
    const wing = d => path(d,wingColor,'#556d72',1.8);
    const veins = path('M-6 -12 Q-46 -39 -81 -32 M-5 -7 Q-40 12 -81 13','none','#698d91',1);
    const abdomen = marking === 'paddle'
      ? 'M-7 -1 Q-3 32 -10 49 Q-14 62 0 64 Q14 62 10 49 Q3 32 7 -1Z'
      : 'M-8 -5 Q-7 30 -3 67 Q0 72 3 67 Q7 30 8 -5Z';
    const width = broad ? 22 : 12;
    const bands = [9,20,31,42,53].map(y=>oval(0,y,y>40?4.5:6,2,accent)).join('');
    return pair(wing(`M-3 -11 Q-56 -${40+width} -86 -33 Q-90 -22 -59 -15 L-3 -3Z`)
      +wing(`M-3 -7 Q-45 -6 -85 5 Q-92 21 -60 ${width+7} Q-23 10 -3 1Z`)+veins)
      +path(abdomen,'url(#shell)')+bands+(marking==='belt'?oval(0,17,7.5,6,'#fff3e0'):'')
      +oval(0,-10,12,15,'url(#shell)')+pair(oval(-7,-24,7,6,accent,'#25343a'));
  }

  function beetle(family, marking, accent) {
    const lady = family === 'lady';
    const long = family === 'longhorn' || family === 'jewel';
    const stag = family === 'stag';
    const horn = family === 'horn';
    const width = lady ? 40 : long ? 23 : stag && ['flat','wide','heavy'].includes(marking) ? 36 : 31;
    const bodyLength = lady ? 35 : long ? 49 : 42;
    const leg = marking === 'redlegs' ? accent : '#3b2c28';
    const legs = pair(path(`M-10 -18 L-${width+10} -28 -${width+19} -19 M-12 4 L-${width+15} -1 -${width+20} 11 M-12 22 L-${width+12} 29 -${width+16} 43`,'none',leg,4));
    const flecks = [[-12,-6],[-22,9],[-9,18],[-23,27],[-13,36],[-18,17]];
    let marks='';
    if(lady) {
      const count=Number(marking);
      marks=pair(flecks.slice(0,Math.floor(count/2)).map(([x,y])=>oval(x,y,5,5,accent)).join(''))+(count%2?oval(0,-13,5,4,accent):'');
    } else if(['flecks','tuft','tiger','blue'].includes(marking)) {
      marks=pair(flecks.slice(0,marking==='tiger'?3:6).map(([x,y],i)=>oval(x,y,i%2?3:4,3,marking==='blue'?'#343748':marking==='tuft'?'#fff4d8':accent)).join(''));
    } else if(marking==='stripes' || marking==='grooves') {
      marks=pair(path('M-14 -10 Q-21 11 -12 45','none',accent,marking==='stripes'?4:1.2));
    } else {
      marks=pair(path('M-13 -11 Q-24 3 -16 30','none',accent,2.2));
    }
    const antennas = pair(path(long?'M-7 -31 Q-20 -65 -52 -68 L-66 -59':'M-6 -29 Q-15 -42 -22 -40','none',leg,long?3:2));
    const jaws = {
      crown:'M-19 -26 Q-35 -53 -23 -68 L-17 -60 -22 -50 -13 -52 -7 -32Z',
      saw:'M-19 -27 Q-41 -52 -24 -70 L-22 -58 -17 -56 -20 -50 -12 -49 -16 -40 -8 -34Z',
      giraffe:'M-18 -27 Q-32 -63 -13 -80 L-13 -66 -7 -64 -15 -56 -8 -32Z',
      split:'M-19 -25 Q-28 -55 -12 -72 L-11 -57 -7 -61 -7 -49 -14 -35Z',
      stub:'M-16 -26 Q-25 -38 -16 -49 L-10 -45 -8 -31Z',
      flat:'M-20 -27 Q-31 -51 -21 -64 L-14 -57 -17 -48 -11 -47 -8 -31Z',
      heavy:'M-20 -27 Q-33 -50 -19 -66 L-11 -61 -17 -51 -8 -44 -9 -31Z',
      tooth:'M-17 -26 Q-25 -44 -13 -56 L-13 -45 -6 -43 -8 -31Z'
    };
    const horns = {
      fork:'M-9 -27 L-7 -53 -20 -61 -17 -68 -5 -62 0 -70 5 -62 17 -68 20 -61 7 -53 9 -27Z',
      long:'M-10 -25 Q-11 -49 -5 -69 L3 -81 10 -78 Q3 -65 7 -44 L15 -34Z',
      triple:'M-10 -25 L-15 -46 -26 -58 -18 -63 -8 -53 0 -74 8 -53 18 -63 26 -58 15 -46 10 -25Z',
      elephant:'M-12 -22 Q-6 -38 -6 -53 L-14 -61 -9 -65 0 -61 5 -66 13 -62 Q5 -54 10 -40 L16 -25Z',
      fuzzy:'M-9 -24 Q-14 -54 0 -70 Q10 -66 6 -53 L12 -25Z'
    };
    return legs+antennas+oval(0,-26,lady?16:22,13,'url(#shell)','#212122')
      +(stag?pair(path(jaws[marking]??'M-16 -24 Q-32 -47 -16 -60 L-9 -58 -17 -43 -7 -32Z','url(#shell)')):'')
      +oval(0,13,width,bodyLength,'url(#shell)','#242027')+marks
      +path(`M0 -20 L0 ${12+bodyLength}`,'none','#30232a',1.6)
      +(horn?path(horns[marking]??horns.fork,accent):'');
  }

  function other(family, marking, accent) {
    const cicada = family === 'cicada';
    const mantis = family === 'mantis';
    const skater = family === 'skater';
    const water = family === 'water';
    const grass = family === 'grass';
    const broad = marking === 'broad' || marking === 'raptor';
    const width = skater?7:mantis?10:water&&broad?29:grass?16:22;
    const legs = cicada
      ? 'M-8 -18 L-38 -26 -48 -15 M-12 5 L-39 7 -49 19 M-12 24 L-34 35 -33 47'
      : skater
        ? 'M-5 -13 Q-19 -33 -54 -47 M-5 0 Q-48 -18 -83 0 M-4 19 Q-45 32 -70 62'
        : mantis || broad
          ? 'M-7 -19 L-36 -39 -48 -60 -31 -48 -27 -33 M-5 4 L-36 4 -47 18 M-5 25 L-33 37 -39 62'
          : 'M-7 -18 L-30 -21 -39 -9 M-9 1 L-36 7 -47 21 M-10 18 L-34 8 -51 43 -42 60';
    const legWidth = skater?2.3:marking==='shovel'?7:3.5;
    const wing = cicada
      ? pair(path('M-6 -12 Q-47 -8 -48 27 Q-52 55 -13 65 Q-3 45 -6 -12Z',marking==='amber'?'#c8915b':marking==='mottled'?'#aa9785':'#ced9cc','#6b5b47',1.8)
        +path('M-7 -6 Q-37 12 -35 51 M-11 14 L-44 29 M-14 33 L-37 50 M-24 14 L-27 54','none','#7f6d5c',1))
      : skater?'':pair(path(`M-2 -7 Q-${width+3} -4 -${width} 26 Q-${width-4} 48 -3 60Z`,'url(#shell)','#473d31',1.4)
        +path('M-6 3 Q-15 22 -7 46','none',accent,1.4));
    const antenna = cicada ? '' : pair(path(marking==='small'||mantis?'M-3 -43 Q-8 -59 -20 -63':'M-4 -39 Q-23 -67 -51 -67','none','#4b3b30',1.8));
    const head = mantis?path('M-14 -31 L-13 -44 Q0 -52 13 -44 L14 -31 0 -25Z',accent):oval(0,-30,cicada?18:width*.72,13,'url(#shell)','#292e28');
    const lift = grass || family==='cricket' ? pair(path('M-11 11 Q-33 -7 -42 28 L-53 47 Q-38 47 -28 28 L-14 20Z','url(#shell)','#514531',2)):'';
    const marks = marking==='bands'||marking==='mottled'
      ? pair(path('M-14 12 L-30 20 M-14 29 L-29 37','none',accent,3)):'';
    const tube = water&&['needle','tube'].includes(marking)?path('M0 47 L0 74','none',accent,2):'';
    return pair(path(legs,'none','#403b2b',legWidth))+lift+oval(0,13,width,40,'url(#shell)','#34322a')
      +wing+marks+head+antenna+tube+pair(oval(-width*.43,-36,3.4,3.5,'#181b22'));
  }

  const terrain = {
    N:['#172f32','#55694d'], R:['#182841','#516787'],
    SR:['#241d3f','#755985'], SSR:['#362622','#98734c']
  };
  const cache = new Map();
  window.mushiverseSpeciesIllustration = (name, rarity) => {
    const spec = species.get(name);
    if (!spec) return '';
    // Background gradients depend on rarity; a name-only cache leaks the first
    // rendered rarity into later card previews for the same species.
    const cacheKey = `${name}\u0000${rarity}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const [family, color, accent, marking, size] = spec;
    const [shade, light] = terrain[rarity] ?? terrain.N;
    let insect;
    if (family === 'butterfly' || family === 'swallow') insect = wings(family,marking,accent);
    else if (family === 'dragon') insect = dragon(marking,accent);
    else if (['lady','longhorn','scarab','stag','horn','jewel'].includes(family)) insect = beetle(family,marking,accent);
    else insect = other(family,marking,accent);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
      <defs>
        <radialGradient id="forest" cx=".48" cy=".42" r=".68"><stop stop-color="${light}"/><stop offset="1" stop-color="${shade}"/></radialGradient>
        <linearGradient id="shell" x2=".85" y2="1"><stop stop-color="${color}"/><stop offset=".48" stop-color="${color}"/><stop offset="1" stop-color="#3c3636"/></linearGradient>
      </defs>
      <rect width="240" height="240" fill="url(#forest)"/>
      <circle cx="120" cy="113" r="92" fill="none" stroke="#f5e6b2" opacity=".25"/>
      <circle cx="120" cy="113" r="100" fill="none" stroke="#f5e6b2" stroke-dasharray="1 6" opacity=".36"/>
      <path d="M0 211 Q43 197 60 220 Q30 223 14 215 M240 212 Q202 198 184 221 Q210 224 230 215" fill="#e9e0a1" opacity=".3"/>
      <ellipse cx="123" cy="186" rx="66" ry="14" fill="#121820" opacity=".24"/>
      <g transform="translate(120 118) scale(${size})">${insect}</g>
    </svg>`;
    const url = 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
    cache.set(cacheKey,url);
    return url;
  };
})();
