import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const ui=readFileSync(new URL('../js/paid-gacha-wallet.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const api=readFileSync(new URL('../supabase/functions/paid-gacha-wallet/index.ts',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/20261121185500_server_only_paid_draw_permission.sql',import.meta.url),'utf8');

test('existing gacha screen loads syntactically valid paid wallet interface',()=>{
  const result=spawnSync(process.execPath,['--check','js/paid-gacha-wallet.js'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.match(html,/<script src="js\/paid-gacha-wallet\.js"><\/script>/);
  assert.match(ui,/getSession\(\)/);
  assert.match(ui,/window\.user\?\.id !== data\.session\.user\.id/);
  assert.match(ui,/window\.crypto\.randomUUID\(\)/);
  assert.match(ui,/localStorage\.setItem/);
  assert.match(ui,/mushiverse:profile-account/);
});

test('paid draws use server-owned wallet and never mutate free coins in client storage',()=>{
  assert.match(ui,/functions\.invoke\(SERVICE, \{body\}\)/);
  assert.match(ui,/action:'draw'/);
  assert.match(ui,/action:'status'/);
  assert.match(ui,/insufficient_balance/);
  assert.match(ui,/pendingSave\(null\)/);
  assert.match(ui,/mushiverseClassicCards/);
  assert.doesNotMatch(ui,/state\.coins\s*[+\-]=/);
});

test('paid draw endpoint binds buyer to JWT identity and server-authoritative RPC',()=>{
  assert.match(api,/auth\.getUser\(\)/);
  assert.match(api,/\.eq\("user_id",user\.id\)/);
  assert.match(api,/p_user_id:user\.id/);
  assert.match(api,/draw_with_purchased_gacha_coins_and_lr/);
  assert.match(api,/Number\.isInteger\(page\)/);
  assert.match(api,/uuid\.test\(body\.draw_id\)/);
  assert.match(api,/!\[1,10\]\.includes\(body\.count as number\)/);
  assert.match(api,/cache-control":"no-store"/);
});

test('paid draw RPC cannot be called directly by anonymous or logged-in app roles',()=>{
  assert.match(migration,/FROM PUBLIC, anon, authenticated/);
  assert.match(migration,/TO service_role/);
});

test('an unfinished draw survives relaunch, preserves legacy requests and stays account-scoped',()=>{
  const persistent = new Map(), session = new Map();
  const storage = map => ({
    getItem:key=>map.get(key) ?? null,
    setItem:(key,value)=>map.set(key,value),
    removeItem:key=>map.delete(key)
  });
  function launch(account, tab) {
    const context={localStorage:storage(persistent),sessionStorage:storage(tab)};
    const functions=ui.slice(ui.indexOf('  function pendingKey'),ui.indexOf('  const message'));
    return vm.runInNewContext("const STORAGE='mushiverse-paid-draw-pending:', account="+JSON.stringify(account)+";"+functions+";({pendingRead,pendingSave})",context);
  }
  const key='mushiverse-paid-draw-pending:alice';
  const pending={id:'12345678-1234-4123-a456-426614174000',count:10};
  session.set(key,JSON.stringify(pending));
  assert.equal(launch('alice',session).pendingRead().id,pending.id);
  assert.equal(session.has(key),false);
  assert.equal(launch('bob',new Map()).pendingRead(),null);
  const reopened=launch('alice',new Map());
  assert.equal(reopened.pendingRead().count,10);
  reopened.pendingSave(null);
  assert.equal(reopened.pendingRead(),null);
  reopened.pendingSave({...pending,balance:999});
  assert.equal(persistent.get(key),JSON.stringify(pending));
});
