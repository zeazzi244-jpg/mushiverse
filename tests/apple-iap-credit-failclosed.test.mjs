import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the purchase endpoint has no path to the spendable wallet', () => {
  const source = readFileSync('supabase/functions/credit-apple-gacha-coins/index.ts', 'utf8');
  assert.match(source, /auth\.getUser\s*\(/);
  assert.match(source, /fulfillment: "disabled_pending_sandbox_proof"/);
  assert.match(source, /\}\s*,\s*422\)/);
  assert.deepEqual([...source.matchAll(/\.rpc\("([^"]+)"/g)].map(match => match[1]),
    ['get_apple_sandbox_verifier_secret', 'is_apple_sandbox_tester', 'record_apple_sandbox_coin_credit']);
  assert.doesNotMatch(source, /gacha_coin_wallets|\.insert\s*\(|\.upsert\s*\(|\.update\s*\(/);

  const migration = readFileSync('supabase/migrations/20261120031622_apple_sandbox_coin_credits_v24.sql', 'utf8');
  assert.doesNotMatch(migration, /gacha_coin_wallets|gacha_coin_purchase_credits/);
  assert.match(migration, /transaction_id text PRIMARY KEY/);
  assert.match(migration, /ON CONFLICT \(transaction_id\) DO NOTHING/);
  assert.match(migration, /REVOKE ALL ON FUNCTION .+ FROM PUBLIC, anon, authenticated/);
});
