import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const api=readFileSync(new URL('../supabase/functions/purchased-gacha-draw/index.ts',import.meta.url),'utf8');
const ui=readFileSync(new URL('../js/purchased-gacha-ui.js',import.meta.url),'utf8');

test('billing shutdown permits owner-scoped read-only wallet access',()=>{
  const start=api.indexOf('if(req.method==="GET")');
  const gate=api.indexOf('if(!drawsEnabled) return reply({error:"paid_draws_disabled"}');
  const spend=api.indexOf('admin.rpc("draw_with_purchased_gacha_coins_and_lr"');
  assert.ok(start>0 && gate>start && spend>gate);
  assert.match(api,/\.eq\("user_id",user\.id\)\.maybeSingle\(\)/);
  assert.match(api,/\.eq\("user_id",user\.id\)\.order\("created_at"/);
  assert.match(api,/draws_enabled:drawsEnabled/);
});
test('billing shutdown still refuses paid-draw POST',()=>{
  assert.match(api,/if\(!drawsEnabled\) return reply\(\{error:"paid_draws_disabled"\},503\)/);
  assert.match(api,/p_user_id:user\.id/);
});
test('UI displays owned history but disables draws during billing pause',()=>{
  assert.match(ui,/result\.data\.draws_enabled===true/);
  assert.match(ui,/\('（有料ガチャは現在停止中）'\)/);
  assert.match(ui,/!enabled\|\|coins<50/);
  assert.match(ui,/!enabled\|\|coins<450/);
  assert.match(ui,/result\.data\.history/);
  assert.doesNotThrow(()=>new Function(ui));
});
