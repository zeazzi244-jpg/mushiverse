import SwiftUI
import StoreKit
import UIKit

struct MushiverseCoinShopView: View {
    @ObservedObject var store: MushiverseCoinStore
    let purchasesEnabled: Bool
    private let forest = Color(red: 0.07, green: 0.17, blue: 0.13)
    private let gold = Color(red: 0.98, green: 0.84, blue: 0.49)

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("ムシバース ショップ").font(.title2.bold())
            if store.sandboxPurchasesEnabled {
                Text("Sandbox購入テスト · 通常のコイン残高には反映されません。")
                    .foregroundStyle(gold)
            } else if !purchasesEnabled {
                Text("現在は販売準備中です。")
                    .foregroundStyle(gold)
            }
            Text("価格はAppleの商品情報から表示します。")
                .font(.footnote)

            Text("ガチャコイン").font(.headline)
            productRow(id: MushiverseCoinStore.sandboxProductID, coins: 100)
            if purchasesEnabled && !store.sandboxPurchasesEnabled {
                ForEach(store.products.filter { $0.id != MushiverseCoinStore.sandboxProductID }
                    .sorted { $0.price < $1.price }, id: \.id) { product in
                    if let coins = MushiverseCoinStore.productionCoinAmounts[product.id] {
                        productRow(id: product.id, coins: coins)
                    }
                }
            }

            Button("Appleの商品情報を再読み込み") {
                Task { await store.loadProducts() }
            }
            .foregroundStyle(gold)
            .frame(minHeight: 44)
            .disabled(store.isPurchasing || store.isRetrying)
            if let message = store.lastError {
                Text(message).font(.footnote).foregroundStyle(gold)
            }
            Button("未完了の購入を再確認") {
                Task { await store.retryUnfinishedPurchases() }
            }
            .foregroundStyle(gold)
            .frame(minHeight: 44)
            .disabled(store.isPurchasing || store.isRetrying)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .foregroundStyle(.white)
        .background(forest)
        .task { await store.start() }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
            Task { await store.retryUnfinishedPurchases() }
        }
        .onDisappear { store.stop() }
    }

    private func productRow(id: String, coins: Int) -> some View {
        let product = store.products.first { $0.id == id }
        let available = store.canOffer(id) && product != nil
        return VStack(alignment: .leading, spacing: 8) {
            Text("\(coins) コイン").font(.headline)
            if let product {
                Text(product.displayPrice).font(.subheadline.weight(.semibold))
            } else {
                Text("Apple価格未取得").font(.footnote)
            }
            Button(available ? (store.sandboxPurchasesEnabled ? "テスト購入" : "購入") : "販売準備中") {
                guard let product else { return }
                Task { await store.purchase(product) }
            }
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, minHeight: 44)
            .foregroundStyle(gold)
            .disabled(!available || !store.canPurchase)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.black.opacity(0.30), in: RoundedRectangle(cornerRadius: 14))
    }
}
