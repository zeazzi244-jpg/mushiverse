import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionAppleCoinTransaction, validateVerifiedAppleCoinTransaction } from '../supabase/functions/_shared/apple-coin-transaction-policy.mjs';

const owner = '7d38f4c0-4c50-4c41-8e3a-76301235acde';
const transactionId = '2000000123456789';
const now = Date.now();
const expected = (productId, environment = 'Production') => ({
  productId, environment, transactionId, originalTransactionId: transactionId, appAccountToken: owner,
});
const signed = (productId, environment = 'Production') => ({
  bundleId: 'com.rikuto.mushiverse', productId, environment,
  transactionId, originalTransactionId: transactionId,
  appAccountToken: owner, type: 'Consumable', quantity: 1,
  inAppOwnershipType: 'PURCHASED', purchaseDate: now - 5000, signedDate: now - 1000,
});

for (const [id, coins] of [['mushiverse.coins.100',100], ['mushiverse.coins.300',300], ['mushiverse.coins.500',500], ['mushiverse.coins.1200',1200], ['mushiverse.coins.2500',2500], ['mushiverse.coins.5500',5500], ['mushiverse.coins.12000',12000]]) {
  test('Production policy accepts verified '+id, () => {
    assert.equal(validateProductionAppleCoinTransaction(signed(id), expected(id)).coins, coins);
  });
}
test('unknown packs cannot be activated by a database sale flag', () => {
  for (const id of ['mushiverse.coins.1000','mushiverse.coins.99999','other.coins.100'])
    assert.throws(() => validateProductionAppleCoinTransaction(signed(id),expected(id)), /product_mismatch/);
});
test('Sandbox cannot be settled through Production policy and vice versa', () => {
  const id = 'mushiverse.coins.100';
  assert.throws(() => validateProductionAppleCoinTransaction(signed(id,'Sandbox'), expected(id)), /environment_mismatch/);
  assert.throws(() => validateVerifiedAppleCoinTransaction(signed(id), expected(id,'Sandbox')), /environment_mismatch/);
});
test('tampered purchase semantics fail closed', () => {
  const id = 'mushiverse.coins.500';
  const mutations = [
    {bundleId:'com.attacker.app'}, {productId:'mushiverse.coins.100'},
    {revocationDate:now}, {revocationReason:1}, {originalTransactionId:'2000000999999999'},
    {appAccountToken:'00000000-0000-4000-8000-000000000000'},
    {quantity:2}, {inAppOwnershipType:'FAMILY_SHARED'}, {type:'Auto-Renewable Subscription'},
    {signedDate:now-10000}, {purchaseDate:now+600000}, {expiresDate:now+3600000},
  ];
  for (const mutation of mutations)
    assert.throws(() => validateProductionAppleCoinTransaction({...signed(id),...mutation},expected(id)), JSON.stringify(mutation));
});
