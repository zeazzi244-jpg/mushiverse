import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const api=read('supabase/functions/purchased-gacha-draw/index.ts');
const native=read('ios/App/App/MushiverseCoinStore.swift');
const db=read('supabase/migrations/20261121185500_server_only_paid_draw_permission.sql');

test('draw API checks authenticated account and child restrictions',()=>{
  assert.match(api,/auth\.getUser\(\)/);
  assert.match(api,/user\.app_metadata\?\.kid_mode===true/);
  assert.match(api,/user\.app_metadata\?\.iap_disabled===true/);
  assert.match(api,/p_user_id:user\.id/);
});
test('production payment safety gates block draws unless validated',()=>{
  for(const part of ['billing.billing_mode==="live"','billing.checkout_enabled===true',
    'billing.ios_iap_ready===true','gate.server_jws_verified===true',
    'gate.sandbox_purchase_proven===true','pack.is_sale_enabled===true'])
    assert.ok(api.includes(part),part);
  assert.ok(api.indexOf('paid_draws_disabled')<api.indexOf('draw_with_purchased_gacha_coins_and_lr'));
  assert.match(native,/static let purchasesEnabled = false/);
});
test('draw requests are idempotent and only use the privileged server RPC',()=>{
  assert.match(api,/count!==1&&count!==10/);
  assert.match(api,/uuid\.test\(drawID\)/);
  assert.match(api,/\["draw_id","count"\]/);
  assert.match(api,/draw_with_purchased_gacha_coins_and_lr/);
  assert.match(api,/p_draw_id:drawID,p_user_id:user\.id,p_count:count/);
  assert.match(api,/replayed:data\.replayed===true/);
  assert.match(api,/data\.results\.length!==count/);
  assert.match(api,/insufficient_balance/);
});
test('direct client execution of paid draw RPC is forbidden',()=>{
  assert.match(db,/REVOKE ALL ON FUNCTION public\.draw_with_purchased_gacha_coins_and_lr/);
  assert.match(db,/FROM PUBLIC, anon, authenticated/);
  assert.match(db,/TO service_role/);
});
