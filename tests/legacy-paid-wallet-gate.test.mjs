import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const legacy = read('supabase/functions/paid-gacha-wallet/index.ts');
const modern = read('supabase/functions/purchased-gacha-draw/index.ts');
const legacyUI = read('js/paid-gacha-wallet.js');
const modernUI = read('js/purchased-gacha-ui.js');

test('both purchased-coin APIs check every server-side Production gate before drawing', () => {
  for (const api of [legacy, modern]) {
    for (const required of [
      'billing_mode', 'checkout_enabled', 'ios_iap_ready',
      'server_jws_verified', 'sandbox_purchase_proven', 'is_sale_enabled',
      'drawsEnabled', 'paid_draws_disabled', 'draw_with_purchased_gacha_coins_and_lr'
    ]) assert.ok(api.includes(required), required);
    assert.ok(api.indexOf('paid_draws_disabled') < api.indexOf('admin.rpc("draw_with_purchased_gacha_coins_and_lr"'));
    assert.match(api,/user\.app_metadata\?\.kid_mode===true/);
    assert.match(api,/user\.app_metadata\?\.minor===true/);
    assert.match(api,/user\.app_metadata\?\.iap_disabled===true/);
  }
});

test('legacy API keeps wallet status readable during billing pause', () => {
  assert.ok(legacy.indexOf('if(body.action==="status")') < legacy.indexOf('if(!drawsEnabled)'));
  assert.match(legacy,/draws_enabled:drawsEnabled/);
  assert.match(legacy,/\.eq\("user_id",user\.id\)\.maybeSingle\(\)/);
  assert.match(legacy,/p_user_id:user\.id/);
});

test('both app panels respect billing pause and do not show duplicates', () => {
  assert.doesNotThrow(()=>new Function(legacyUI));
  assert.doesNotThrow(()=>new Function(modernUI));
  assert.match(legacyUI,/drawsEnabled=result\.draws_enabled===true/);
  assert.match(legacyUI,/!drawsEnabled \|\| busy \|\| balance < 50/);
  assert.match(legacyUI,/!drawsEnabled \|\| busy \|\| balance < 450/);
  assert.match(modernUI,/\$\('mvPaidCoinPanel'\)/);
  assert.match(modernUI,/result\.data\.draws_enabled===true/);
});
