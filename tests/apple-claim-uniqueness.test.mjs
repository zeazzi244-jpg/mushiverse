import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20261112033800_apple_purchase_claim_global_transaction_uniqueness.sql', 'utf8');
const handler = readFileSync('supabase/functions/submit-apple-purchase-claim/index.ts', 'utf8');

test('Apple transaction IDs are unique globally, not just per account', () => {
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS apple_purchase_claims_transaction_id_global_unique/);
  assert.match(migration, /ON public\.apple_purchase_claims \(transaction_id\)/);
  assert.doesNotMatch(migration, /ON public\.apple_purchase_claims \(user_id,\s*transaction_id\)/);
});

test('a competing claim cannot take ownership after unique constraint collision', () => {
  assert.match(handler, /error\.code==="23505"/);
  assert.match(handler, /winner\[0\]\.user_id===user\.id/);
  assert.match(handler, /winner\[0\]\.product_id===productId/);
  assert.match(handler, /winner\[0\]\.original_transaction_id===originalTransactionId/);
  assert.match(handler, /transaction_already_claimed/);
});

test('claim submission never credits coins or activates premium', () => {
  assert.match(handler, /status:"pending"/);
  assert.match(handler, /environment:null/);
  assert.doesNotMatch(handler, /from\(["'](?:gacha_coin_wallets|gacha_coin_purchase_credits|premium_entitlements)["']\)\.\s*(?:insert|upsert|update)/);
});
