import SwiftUI
import StoreKit

/// Native-only coin shop UI. Integrate after backend Apple verification is live.
struct MushiverseCoinShopView: View {
    @ObservedObject var store: MushiverseCoinStore
    let purchasesEnabled: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("🪙 ガチャコインショップ")
                .font(.title2.bold())
            Text("Appleのアプリ内課金を使用します。")
                .font(.footnote)
                .foregroundStyle(.secondary)

            if store.products.isEmpty {
                Text("商品情報を読み込み中、または販売準備中です")
                    .foregroundStyle(.secondary)
                Button("商品を再読み込み") {
                    Task { await store.loadProducts() }
                }
            }

            ForEach(store.products, id: \.id) { product in
                HStack {
                    VStack(alignment: .leading) {
                        Text(product.displayName)
                            .font(.headline)
                        Text(product.description)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button(product.displayPrice) {
                        Task { await store.purchase(product) }
                    }
                    .disabled(!purchasesEnabled || store.isPurchasing || store.isRetrying)
                }
                .padding(.vertical, 8)
                Divider()
            }

            if !purchasesEnabled {
                Text("現在は販売準備中です。購入はできません。")
                    .foregroundStyle(.secondary)
            }
            if let message = store.lastError {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.orange)
                if purchasesEnabled {
                    Button("未完了の購入を再確認") {
                        Task { await store.retryUnfinishedPurchases() }
                    }
                    .disabled(store.isPurchasing || store.isRetrying)
                    .accessibilityHint("Appleで完了した購入のコイン付与を再確認します。新たな購入は行いません。")
                }
            }
        }
        .padding()
        .task { await store.start() }
        .onDisappear { store.stop() }
    }
}
