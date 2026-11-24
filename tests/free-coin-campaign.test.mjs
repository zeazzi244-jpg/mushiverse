import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('function empty(){return {coins:0'),html.indexOf('function save(){try{localStorage.setItem(storageKey(),JSON.stringify(state))'));
function fixture(metadata,initial,fail=false){
  const context={window:{user:metadata===null?null:{id:'account',app_metadata:metadata}},BONUS_DAYS:365,storageKey:()=> 'user:account',localStorage:{getItem:()=>JSON.stringify(initial)},save:()=>!fail};
  const run=code=>runInNewContext(code,context);
  run('let state;'+source+'\nstate=read()');
  return {run};
}
test('campaign credits the existing free wallet once without altering cards or earlier grant',()=>{
  const f=fixture({mushiverse_free_coin_grant_v1:1000000,mushiverse_free_coin_grant_v2:1000},{coins:123,cards:[{id:'old'}],freeCoinGrantV1:true});
  f.run('applyFreeCoinGrant();applyFreeCoinGrant()');
  assert.equal(f.run('state.coins'),1123);
  assert.equal(f.run('state.cards[0].id'),'old');
  assert.equal(f.run('state.freeCoinGrantV2'),true);
  assert.equal(f.run('state.freeCoinGrantV1'),true);
});
test('campaign does not credit guests, unselected accounts or failed local writes',()=>{
  for(const metadata of [null,{}, {mushiverse_free_coin_grant_v2:999}]){
    const f=fixture(metadata,{coins:10});f.run('applyFreeCoinGrant()');assert.equal(f.run('state.coins'),10);
  }
  const f=fixture({mushiverse_free_coin_grant_v2:1000},{coins:10},true);f.run('applyFreeCoinGrant()');assert.equal(f.run('state.coins'),10);assert.equal(f.run('state.freeCoinGrantV2'),false);
});
test('a persisted campaign receipt prevents another credit on the same local wallet',()=>{
  const f=fixture({mushiverse_free_coin_grant_v2:1000},{coins:777,freeCoinGrantV2:true});f.run('applyFreeCoinGrant()');assert.equal(f.run('state.coins'),777);
});
test('individual 10000-coin grant is independent from the earlier campaign',()=>{
  const f=fixture({mushiverse_free_coin_grant_v2:1000,mushiverse_free_coin_grant_v3:10000},{coins:2000,freeCoinGrantV2:true});
  f.run('applyFreeCoinGrant();applyFreeCoinGrant()');assert.equal(f.run('state.coins'),12000);assert.equal(f.run('state.freeCoinGrantV3'),true);
  const previous=fixture({mushiverse_free_coin_grant_v3:10000},{coins:3000,freeCoinGrantV3:true});previous.run('applyFreeCoinGrant()');assert.equal(previous.run('state.coins'),3000);
});
