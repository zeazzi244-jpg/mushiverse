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
            ForEach(MushiverseCoinStore.coinPacks.indices, id: \.self) { index in
                let pack = MushiverseCoinStore.coinPacks[index]
                productRow(id: pack.id, title: "\(pack.coins.formatted()) コイン",
                           detail: pack.coins == 1200 ? "おすすめ" : nil, canFulfill: true)
            }

            Text("プレミアム会員").font(.headline)
            productRow(id: MushiverseCoinStore.premiumID, title: "月額プレミアム",
                       detail: "自動更新", canFulfill: false)

            // Do not advertise an unconfigured adventure pass in the free release.

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

    private func productRow(id: String, title: String, detail: String?, canFulfill: Bool) -> some View {
        let product = store.products.first { $0.id == id }
        let available = store.canOffer(id) && canFulfill && product != nil
        return VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            if let detail { Text(detail).font(.caption.weight(.semibold)).foregroundStyle(gold) }
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
