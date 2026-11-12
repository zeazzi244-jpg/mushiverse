import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVerifiedAppleCoinTransaction as validate } from '../supabase/functions/_shared/apple-coin-transaction-policy.mjs';

const base = {
  bundleId: 'com.rikuto.mushiverse', productId: 'mushiverse.coins.100',
  environment: 'Sandbox', transactionId: '1234567890', originalTransactionId: '1234567890',
  purchaseDate: 1730000000000, type: 'Consumable',
  appAccountToken: '123e4567-e89b-42d3-a456-426614174000',
};
const expected = {
  productId: base.productId, environment: base.environment,
  transactionId: base.transactionId, originalTransactionId: base.originalTransactionId,
  appAccountToken: base.appAccountToken,
};
test('valid post-verification consumable returns catalog amount', () => {
  assert.equal(validate(base, expected).coins, 100);
  assert.equal(validate({...base, productId:'mushiverse.coins.500'}, {...expected, productId:'mushiverse.coins.500'}).coins, 500);
  assert.equal(validate({...base, productId:'mushiverse.coins.1200'}, {...expected, productId:'mushiverse.coins.1200'}).coins, 1200);
});
for (const [name, change, match] of [
  ['wrong bundle', {bundleId:'com.other.app'}, /bundle_mismatch/],
  ['wrong environment', {environment:'Production'}, /environment_mismatch/],
  ['unknown product', {productId:'mushiverse.coins.999'}, /product_mismatch/],
  ['subscription', {type:'Auto-Renewable Subscription'}, /type_mismatch/],
  ['revoked', {revocationDate:1730000000001}, /revoked/],
  ['future purchase', {purchaseDate:Date.now()+86400000}, /invalid_purchase_date/],
  ['missing transaction', {transactionId:''}, /invalid_transaction_id/],
  ['wrong original transaction', {originalTransactionId:'999999'}, /original_transaction_mismatch/],
]) test('rejects '+name, () => assert.throws(() => validate({...base,...change},expected), match));
test('rejects mismatched transaction ownership', () =>
  assert.throws(() => validate(base,{...expected,transactionId:'987654321'}),/transaction_mismatch/));

test('binds signed transaction to trusted app account token when required', () => {
  const appAccountToken = '123e4567-e89b-42d3-a456-426614174000';
  assert.equal(validate({...base, appAccountToken}, {...expected, appAccountToken}).coins, 100);
  assert.throws(() => validate({...base, appAccountToken:undefined}, {...expected, appAccountToken}), /app_account_token_mismatch/);
  assert.throws(() => validate({...base, appAccountToken:'123e4567-e89b-42d3-a456-426614174001'}, {...expected, appAccountToken}), /app_account_token_mismatch/);
  assert.throws(() => validate({...base, appAccountToken}, {...expected, appAccountToken:'not-a-uuid'}), /app_account_token_mismatch/);
});

test('refuses a purchase if the trusted account binding is missing', () => {
  assert.throws(() => validate(base, {...expected, appAccountToken:undefined}), /app_account_token_mismatch/);
});
