import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const frontend=readFileSync(new URL('../js/purchased-gacha-ui.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('paid coin UI is shipped as valid JS in existing app',()=>{
  assert.doesNotThrow(()=>new Function(frontend));
  assert.match(html, /src="js\/purchased-gacha-ui\.js"/);
  assert.match(frontend,/document\.getElementById\('gacha'\)/);
});
test('paid coin UI does not mix with local free balance',()=>{
  assert.match(frontend,/購入したコインはサーバーに保存され、無料コインとは別/);
  assert.match(frontend,/functions\/v1\/purchased-gacha-draw/);
  assert.match(frontend,/mushiverse-purchased-draw-pending:/);
  assert.match(frontend,/user\?\.id!==current\.user\.id/);
  assert.match(frontend,/pending\.count!==count/);
  assert.match(frontend,/crypto\.randomUUID\(\)/);
  assert.doesNotMatch(frontend,/state\.coins|mv77-game:|localStorage\.setItem\(storageKey/);
});
test('paid draw account switching invalidates stale responses',()=>{
  assert.match(frontend,/accountGeneration\+\+/);
  assert.match(frontend,/generation !== accountGeneration/);
  assert.match(frontend,/clearAccountView\(\)/);
  assert.match(frontend,/mvPaidHistory/);
  assert.match(frontend,/body\.mv128Kids #mvPaidGacha/);
});
