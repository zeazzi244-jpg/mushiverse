import SwiftUI
import StoreKit

struct MushiverseCoinShopView: View {
    @ObservedObject var store: MushiverseCoinStore
    let purchasesEnabled: Bool
    private let forest = Color(red: 0.07, green: 0.17, blue: 0.13)
    private let gold = Color(red: 0.98, green: 0.84, blue: 0.49)

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("ムシバース ショップ").font(.title2.bold())
            if !purchasesEnabled {
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

            Text("冒険パス").font(.headline)
            productRow(id: MushiverseCoinStore.adventurePassID, title: "30日冒険パス",
                       detail: "自動更新なし", canFulfill: false)

            Button("Appleの商品情報を再読み込み") {
                Task { await store.loadProducts() }
            }
            .foregroundStyle(gold)
            .frame(minHeight: 44)
            .disabled(store.isPurchasing || store.isRetrying)
            if let message = store.lastError {
                Text(message).font(.footnote).foregroundStyle(gold)
            }
            if purchasesEnabled {
                Button("未完了の購入を再確認") {
                    Task { await store.retryUnfinishedPurchases() }
                }
                .foregroundStyle(gold)
                .frame(minHeight: 44)
                .disabled(store.isPurchasing || store.isRetrying)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .foregroundStyle(.white)
        .background(forest)
        .task { await store.start() }
        .onDisappear { store.stop() }
    }

    private func productRow(id: String, title: String, detail: String?, canFulfill: Bool) -> some View {
        let product = store.products.first { $0.id == id }
        return VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            if let detail { Text(detail).font(.caption.weight(.semibold)).foregroundStyle(gold) }
            if let product {
                Text(product.displayPrice).font(.subheadline.weight(.semibold))
            } else {
                Text("Apple価格未取得").font(.footnote)
            }
            Button(purchasesEnabled && canFulfill && product != nil ? "購入" : "販売準備中") {
                guard let product else { return }
                Task { await store.purchase(product) }
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .foregroundStyle(gold)
            .disabled(!purchasesEnabled || store.isPurchasing || store.isRetrying || !store.canPurchase || !canFulfill || product == nil)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.black.opacity(0.30), in: RoundedRectangle(cornerRadius: 14))
    }
}
