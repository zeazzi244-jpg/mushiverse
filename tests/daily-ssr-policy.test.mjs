import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('<script id="mv-v77-game">');
const end=source.indexOf('</script>',start);
const game=source.slice(start,end);
test('daily rewards are coins only',()=>{assert.ok(start>0);assert.match(game,/REWARDS=\[100,150,150,200,300,300,500\]/);assert.doesNotMatch(game,/state\.tickets\s*\+=/);});
test('SSR is excluded from ticket draws',()=>{assert.match(game,/allowSSR&&roll<1/);assert.match(game,/pick\(!useTicket\)/);});
