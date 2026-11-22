import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = readFileSync(new URL('../ios/App/App/MushiverseCoinStore.swift',import.meta.url),'utf8');
const nativePlugin = readFileSync(new URL('../ios/App/App/MushiverseBridgeViewController.swift',import.meta.url),'utf8');
const endpoint = readFileSync(new URL('../supabase/functions/settle-apple-production-coins/index.ts',import.meta.url),'utf8');

test('native Production transactions use dedicated settlement endpoint and do not accept Sandbox',()=>{
  assert.match(store, /static let purchasesEnabled = false/);
  assert.match(store, /transaction\.environment == \.production/);
  assert.match(store, /transaction\.environment == \.sandbox/);
  assert.match(store, /appendingPathComponent\("settle-apple-production-coins"\)/);
  assert.match(store, /settlementEndpoint = !isSandbox/);
  assert.match(store, /transaction\.environment == \.production && Self\.purchasesEnabled/);
  assert.match(store, /if isSandbox \{/);
  assert.match(store, /receipt\.creditedOrPreviouslyCredited, receipt\.ok/);
  assert.match(nativePlugin, /credit-apple-gacha-coins/);
});

test('StoreKit transaction is finished only for exact owner, product, original and Production credit',()=>{
  assert.match(store, /receipt\.verification == "production_signature_verified"/);
  assert.match(store, /receipt\.environment == "Production"/);
  assert.match(store, /receipt\.originalTransactionID == String\(transaction\.originalID\)/);
  assert.match(store, /receipt\.transactionID == String\(transaction\.id\)/);
  assert.match(store, /receipt\.coins == Self\.productionCoinAmounts\[transaction\.productID\]/);
  assert.match(store, /receipt\.creditedOrPreviouslyCredited/);
  assert.match(store, /await transaction\.finish\(\)/);
  assert.match(endpoint, /verification:"production_signature_verified"/);
  assert.match(endpoint, /original_transaction_id:verified\.originalTransactionId/);
  assert.match(endpoint, /coins:verified\.coins/);
});

test('failed server settlement leaves StoreKit transaction unfinished for retry',()=>{
  assert.match(store, /guard response\.statusCode == 200 else \{ throw PurchaseError\.serverRejected \}/);
  assert.match(store, /guard receipt\.creditedOrPreviouslyCredited,/);
  assert.match(store, /Transaction\.unfinished/);
  assert.ok(store.indexOf('receipt.creditedOrPreviouslyCredited') < store.lastIndexOf('await transaction.finish()'));
  assert.match(store, /購入の反映を確認できませんでした。未完了の購入を再確認してください。/);
});
