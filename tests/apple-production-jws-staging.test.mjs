import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateProductionAppleCoinTransaction as validate } from '../supabase/functions/_shared/apple-coin-transaction-policy.mjs';

// This is a structural check of the staged verifier. A real Apple-signed
// Production JWS and live iOS purchase remain required before activation.
const verifier = readFileSync(new URL('../supabase/functions/_shared/apple-production-coin-verifier.ts', import.meta.url),'utf8');
const credit = readFileSync(new URL('../supabase/functions/credit-apple-gacha-coins/index.ts', import.meta.url),'utf8');
const claim = readFileSync(new URL('../supabase/functions/submit-apple-purchase-claim/index.ts', import.meta.url),'utf8');
const native = readFileSync(new URL('../ios/App/App/MushiverseCoinStore.swift', import.meta.url),'utf8');

test("staged Production verifier uses Apple's signed verification before policy", () => {
  assert.match(verifier, /SignedDataVerifier/);
  assert.match(verifier, /Environment\.PRODUCTION/);
  assert.match(verifier, /"com\.rikuto\.mushiverse", appAppleId/);
  assert.match(verifier, /verifyAndDecodeTransaction\(signedTransaction\)/);
  assert.ok(verifier.indexOf('verifyAndDecodeTransaction(signedTransaction)') <
    verifier.lastIndexOf('validateProductionAppleCoinTransaction(transaction, expected)'));
  assert.match(verifier, /apple_app_id_required/);
  assert.match(verifier, /production_environment_required/);
  assert.match(verifier, /APPLE_G3_ROOT_DER_BASE64/);
});

test('staged verifier cannot silently enable purchases or modify existing balances', () => {
  assert.doesNotMatch(verifier, /\.rpc\(|\.insert\(|\.update\(|\.upsert\(|service_role/i);
  assert.doesNotMatch(credit, /apple-production-coin-verifier/);
  assert.doesNotMatch(claim, /apple-production-coin-verifier/);
  assert.match(native, /static let purchasesEnabled = false/);
  assert.match(credit, /sandbox_test_wallet/);
});

test('Production policy enforces signed user and product ownership', () => {
  const signed = {
    bundleId:'com.rikuto.mushiverse', environment:'Production',
    productId:'mushiverse.coins.100', transactionId:'1234567', originalTransactionId:'1234567',
    appAccountToken:'123e4567-e89b-42d3-a456-426614174000',
    purchaseDate:1730000000000, signedDate:1730000001000,
    type:'Consumable', quantity:1, inAppOwnershipType:'PURCHASED',
  };
  const expected = {
    environment:'Production', productId:signed.productId,
    transactionId:signed.transactionId, originalTransactionId:signed.originalTransactionId,
    appAccountToken:signed.appAccountToken,
  };
  assert.equal(validate(signed, expected).coins,100);
  assert.throws(()=>validate({...signed, appAccountToken:'123e4567-e89b-42d3-a456-426614174001'},expected),/app_account_token_mismatch/);
  assert.throws(()=>validate({...signed,revocationDate:1730000001000},expected),/revoked/);
});
