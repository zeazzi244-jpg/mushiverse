import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = readFileSync(new URL('../ios/App/App/MushiverseCoinStore.swift', import.meta.url), 'utf8');
const shop = readFileSync(new URL('../ios/App/App/MushiverseCoinShopView.swift', import.meta.url), 'utf8');

test('App Store build explains production fulfillment gate without misdiagnosing Sandbox', () => {
  assert.match(store, /static let purchasesEnabled = false/);
  assert.match(store, /Appleの商品価格は取得済みです。本番課金の安全確認が完了するまで/);
  assert.doesNotMatch(store, /Appleのテスト環境を確認できないため/);
  assert.match(shop, /現在は販売準備中です/);
});

test('Sandbox testing stays isolated and production remains disabled', () => {
  assert.match(store, /app\.environment == \.sandbox/);
  assert.match(store, /transaction\.environment == \.sandbox/);
  assert.match(store, /proof\.fulfillment == "sandbox_test_wallet"/);
  assert.match(store, /guard canOffer\(product\.id\)/);
});
