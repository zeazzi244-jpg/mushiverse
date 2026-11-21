import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateVerifiedAppleCoinTransaction as validateSandbox,
  validateProductionAppleCoinTransaction as validateProduction,
} from '../supabase/functions/_shared/apple-coin-transaction-policy.mjs';

const token = '123e4567-e89b-42d3-a456-426614174000';
const signed = Object.freeze({
  bundleId: 'com.rikuto.mushiverse',
  environment: 'Production',
  productId: 'mushiverse.coins.100',
  transactionId: '1234567890',
  originalTransactionId: '1234567890',
  appAccountToken: token,
  type: 'Consumable',
  quantity: 1,
  inAppOwnershipType: 'PURCHASED',
  purchaseDate: 1730000000000,
  signedDate: 1730000001000,
});
const expected = Object.freeze({
  environment: 'Production',
  productId: signed.productId,
  transactionId: signed.transactionId,
  originalTransactionId: signed.originalTransactionId,
  appAccountToken: token,
});

test('Production transaction semantics can be validated without opening the Sandbox endpoint', () => {
  const result = validateProduction(signed, expected);
  assert.deepEqual(result, {transactionId:signed.transactionId, originalTransactionId:signed.originalTransactionId, productId:signed.productId, environment:'Production', coins:100});
  assert.throws(() => validateSandbox(signed, expected), /production_fulfillment_disabled/);
});

test('Production policy refuses Sandbox even when identifiers match', () => {
  assert.throws(() => validateProduction({...signed, environment:'Sandbox'}, {...expected, environment:'Sandbox'}), /production_environment_required/);
  assert.throws(() => validateProduction({...signed, environment:'Sandbox'}, expected), /environment_mismatch/);
});

for(const [label, changes, failure] of [
  ['wrong bundle', {bundleId:'com.other.app'}, /bundle_mismatch/],
  ['wrong product', {productId:'mushiverse.coins.500'}, /product_mismatch/],
  ['foreign buyer', {appAccountToken:'123e4567-e89b-42d3-a456-426614174001'}, /app_account_token_mismatch/],
  ['wrong transaction ID', {transactionId:'1234567891', originalTransactionId:'1234567891'}, /transaction_mismatch/],
  ['reused original', {originalTransactionId:'9999999999'}, /consumable_transaction_chain_mismatch/],
  ['revoked', {revocationDate:1730000000100}, /revoked/],
  ['revocation reason', {revocationReason:1}, /revoked/],
  ['duplicate quantity', {quantity:2}, /unsupported_quantity/],
  ['shared purchase', {inAppOwnershipType:'FAMILY_SHARED'}, /unsupported_ownership_type/],
  ['subscription metadata', {expiresDate:1730100000000}, /subscription_metadata_on_consumable/],
  ['renewal reason', {transactionReason:'RENEWAL'}, /invalid_consumable_transaction_reason/],
  ['invalid signing date', {signedDate:1730000000000-1}, /invalid_signed_date/],
]) {
  test('Production policy rejects '+label, () => {
    assert.throws(() => validateProduction({...signed,...changes}, expected), failure);
  });
}

test('Production policy is not proof of a signature and must remain outside credit endpoints', () => {
  assert.throws(() => validateProduction(undefined, expected), /invalid_transaction/);
  assert.throws(() => validateProduction(signed, {...expected, appAccountToken:undefined}), /app_account_token_mismatch/);
});
