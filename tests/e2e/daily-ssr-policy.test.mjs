import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const source=readFileSync(fileURLToPath(new URL('../../index.html',import.meta.url)),'utf8');
const game=source.match(/<script id="mv-v77-game">([\s\S]*?)<\/script>/)?.[1];
test('daily game script exists and parses',()=>{
 assert.ok(game,'daily game missing');
 new Function(game);
});
test('login rewards are coins only and contain no SSR ticket grant',()=>{
 assert.match(game,/REWARDS=\[100,150,150,200,300,300,500\]/);
 assert.match(game,/state\.coins\+=REWARDS\[day-1\]/);
 assert.doesNotMatch(game,/state\.tickets\s*\+=/);
 assert.doesNotMatch(game,/SSR確定券/);
});
test('ticket draw excludes SSR while coin draw keeps 0.1% SSR',()=>{
 assert.match(game,/function pick\(allowSSR=true\)/);
 assert.match(game,/allowSSR&&roll<1\?'SSR'/);
 assert.match(game,/const useTicket=n===1&&state\.tickets>0/);
 assert.match(game,/Array\.from\(\{length:n\},\(\)=>pick\(!useTicket\)\)/);
});
