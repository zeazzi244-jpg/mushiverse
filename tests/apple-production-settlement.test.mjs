import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const api = read('supabase/functions/settle-apple-production-coins/index.ts');
const verifier = read('supabase/functions/_shared/apple-production-coin-verifier.ts');
const migration = read('supabase/migrations/20261121183000_settle_verified_apple_coin_production.sql');
const catalogGate = read('supabase/migrations/20261121182000_gate_apple_catalog_after_approved_proof.sql');
const native = read('ios/App/App/MushiverseCoinStore.swift');

test('Production endpoint requires auth, closed release gates, and Apple JWS validation before settlement',()=>{
  assert.match(api,/auth\.getUser\(\)/);
  assert.match(api,/production_fulfillment_disabled/);
  assert.match(api,/verifyAppleProductionCoinJws\(signed/);
  assert.match(api,/admin\.rpc\("settle_verified_apple_coin_production"/);
  assert.ok(api.indexOf('verifyAppleProductionCoinJws(signed')<api.indexOf('admin.rpc("settle_verified_apple_coin_production"'));
  assert.match(api,/claim\.user_id !== user\.id/);
  assert.match(api,/claim\.original_transaction_id !== transactionID/);
  assert.match(api,/appAccountToken:user\.id/);
  assert.match(api,/Apple Production credit settlement rejected/);
  assert.match(api,/settled !== true/);
  assert.match(api,/credited_or_previously_credited:true/);
  assert.match(verifier,/purchaseDate: transaction\.purchaseDate as number/);
});

test('Database settlement is atomic and only callable by trusted service-role',()=>{
  assert.match(migration,/SECURITY DEFINER SET search_path = ''/);
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.settle_verified_apple_coin_production/);
  assert.match(migration,/FROM PUBLIC, anon, authenticated/);
  assert.match(migration,/TO service_role/);
  assert.match(migration,/pg_advisory_xact_lock/);
  assert.match(migration,/apple_original_transaction_conflict/);
  assert.match(migration,/apple_verified_event_conflict/);
  assert.match(migration,/public\.credit_verified_apple_coin_transaction\(p_transaction_id\)/);
  assert.match(migration,/apple_coin_ledger_acknowledgment_missing/);
});

test('Catalog remains closed until signed transaction proof, and only reviewed 100 pack eligible',()=>{
  assert.match(catalogGate,/NEW\.product_id <> 'mushiverse\.coins\.100'/);
  assert.match(catalogGate,/NEW\.coins <> 100/);
  assert.match(catalogGate,/g\.server_jws_verified IS TRUE/);
  assert.match(catalogGate,/g\.sandbox_purchase_proven IS TRUE/);
  assert.match(catalogGate,/b\.billing_mode = 'live'/);
  assert.match(native,/static let purchasesEnabled = false/);
});

test('Production verifier cannot credit wallet without a verified Apple-signed purchase date',()=>{
  assert.match(verifier,/verifyAndDecodeTransaction\(signedTransaction\)/);
  assert.match(verifier,/validateProductionAppleCoinTransaction\(transaction, expected\)/);
  assert.ok(verifier.indexOf('verifyAndDecodeTransaction(signedTransaction)')<
    verifier.indexOf('validateProductionAppleCoinTransaction(transaction, expected)'));
  assert.match(api,/new Date\(verified\.purchaseDate\)\.toISOString\(\)/);
});
