import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Release safety interlock: until a trusted Apple JWS verifier is deployed,
// the purchase-credit HTTP endpoint must remain fail-closed. This intentionally
// fails when the endpoint is changed; replace with end-to-end signed-transaction
// tests before removing the interlock.
test('unverified Apple IAP endpoint cannot grant gacha coins', () => {
  const source = readFileSync('supabase/functions/credit-apple-gacha-coins/index.ts', 'utf8');
  assert.match(source, /auth\.getUser\s*\(/, 'Authenticated caller must be checked');
  assert.match(source, /fulfillment: "disabled_pending_sandbox_proof"/);
  assert.match(source, /credited_or_previously_credited:\s*false/);
  assert.match(source, /\}\s*,\s*422\)/, 'Invalid signature must return HTTP 422');
  assert.doesNotMatch(source, /\.rpc\s*\(|\.insert\s*\(|\.upsert\s*\(|\.update\s*\(/,
    'Fail-closed endpoint must not write purchase credits or balances');
});
