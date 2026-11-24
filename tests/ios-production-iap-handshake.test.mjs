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

test('native production payment requires current server availability before StoreKit',()=>{
  const purchase=store.slice(store.indexOf('func purchase('),store.indexOf('private func process('));
  assert.ok(purchase.indexOf('guard try await productionAvailable(product.id)') < purchase.indexOf('product.purchase(options:'));
  assert.match(purchase,/app\.environment == \.production/);
  assert.match(purchase,/guard try await appAccountToken\(\) == accountID/);
  assert.match(store,/availability\.productID == productID && availability\.coins == Self\.productionCoinAmounts\[productID\]/);
});

test('Sandbox verification retries the same verified unfinished purchase once without charging again',()=>{
  const process=store.slice(store.indexOf('private func process('),store.indexOf('private func productionAvailable('));
  assert.match(process,/if isSandbox && \(response.statusCode == 422 \|\| response.statusCode == 503\)/);
  assert.match(process,/for await retryResult in Transaction\.unfinished/);
  assert.match(process,/case \.verified\(let retryTransaction\) = retryResult/);
  assert.match(process,/retryTransaction\.id == transaction\.id/);
  assert.match(process,/retryTransaction\.appAccountToken == expectedAccount/);
  assert.match(process,/signedTransaction: retryResult\.jwsRepresentation/);
  assert.match(process,/break\s*\}\s*\}/);
  assert.doesNotMatch(process,/product\.purchase\(/);
  assert.ok(process.indexOf('proof.creditedOrPreviouslyCredited') < process.indexOf('await transaction.finish()'));
});
