import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('<script id="mv-v77-game">');
const end=source.indexOf('</script>',start);
const game=source.slice(start,end);
test('daily rewards are coins only',()=>{assert.ok(start>0);assert.match(game,/REWARDS=\[5,5,10,5,10,10,20\]/);assert.doesNotMatch(game,/state\.tickets\s*\+=/);});
test('SSR is excluded from ticket draws',()=>{assert.match(game,/allowSSR&&roll<1/);assert.match(game,/pick\(!useTicket\)/);});
test('planned first quest reward is 10 coins and not auto-granted',()=>{assert.match(source,/はじめての昆虫撮影：審査通過で10コイン（予定）/);assert.match(source,/現段階ではコインは自動付与されません/);});

test('coin and legacy ticket draws are explicitly selected',()=>{assert.match(game,/id=\"mv77Draw\">コインで1回/);assert.match(game,/id=\"mv77TicketDraw\">チケットで1回/);assert.match(game,/function draw\(n,useTicket=false\)/);assert.match(game,/if\(id==='mv77Draw'\)draw\(1,false\)/);assert.match(game,/if\(id==='mv77TicketDraw'\)draw\(1,true\)/);assert.match(game,/if\(useTicket&&n===1&&state\.tickets>0\)/);});
