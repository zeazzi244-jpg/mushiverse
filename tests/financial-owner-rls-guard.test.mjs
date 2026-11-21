import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const paid=read('supabase/migrations/20261121195500_lock_paid_wallet_owner_rls.sql');
const financial=read('supabase/migrations/20261121200000_financial_owner_rls_hardening.sql');

test('paid-wallet, paid-draw and purchase ledger never rely on account-wide SELECT policies',()=>{
  for(const table of ['gacha_coin_wallets','gacha_paid_draws','gacha_coin_purchase_credits']){
    assert.ok(paid.includes('DROP POLICY IF EXISTS account_active_v21 ON public.'+table),table);
    assert.ok(paid.includes('public.'+table),table);
  }
  assert.match(paid,/REVOKE INSERT, UPDATE, DELETE/);
});

test('premium, referral, spend and report data strip broad account active rules',()=>{
  for(const table of ['gacha_coin_spends','premium_entitlements','premium_waitlist',
    'referral_claims','monetization_events','community_reports'])
    assert.ok(financial.includes('DROP POLICY IF EXISTS account_active_v21 ON public.'+table),table);
  assert.match(financial,/user_id = \(select auth\.uid\(\)\) AND status = 'waiting'/);
  assert.match(financial,/REVOKE UPDATE, DELETE/);
});

test('post-migration roles keep an authenticated owner-only waitlist insert',()=>{
  assert.match(financial,/CREATE POLICY premium_waitlist_owner_signup/);
  assert.match(financial,/FOR INSERT TO authenticated/);
  assert.match(financial,/REVOKE INSERT ON public\.gacha_coin_spends, public\.premium_entitlements/);
  assert.doesNotMatch(financial,/GRANT ALL ON/);
});
