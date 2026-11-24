import SwiftUI
import StoreKit
import UIKit

struct MushiverseCoinShopView: View {
    @ObservedObject var store: MushiverseCoinStore
    let purchasesEnabled: Bool
    private let forest = Color(red: 0.07, green: 0.17, blue: 0.13)
    private let gold = Color(red: 0.98, green: 0.84, blue: 0.49)

    static func localized(_ japanese: String, _ english: String) -> String {
        let language = Locale.preferredLanguages.first ?? "ja"
        return language.lowercased().split(separator: "-").first == "ja" ? japanese : english
    }

    private func localizedStatus(_ message: String) -> String {
        let translations = [
            "未完了の購入を再確認しています…": "Checking unfinished purchases…",
            "再確認が完了しました。未完了の購入はありません。": "Check complete. No unfinished purchases.",
            "Appleから100コインの商品情報が返りませんでした。": "Apple did not return the 100-coin product.",
            "Appleの商品価格は取得済みです。本番課金の安全確認が完了するまで、このバージョンでは購入できません。": "Apple prices are available. Purchases remain disabled until production safety checks are complete.",
            "この端末の設定ではアプリ内購入が許可されていません。": "In-app purchases are disabled on this device.",
            "商品情報を読み込めませんでした": "Could not load product information.",
            "現在は販売準備中です。購入はできません。": "Purchases are not available yet.",
            "購入の承認を待っています": "Waiting for purchase approval.",
            "購入結果を確認できませんでした": "Could not confirm the purchase result.",
            "購入を完了できませんでした": "Could not complete the purchase.",
            "Appleによる購入確認に失敗しました": "Apple purchase verification failed.",
            "Appleのテスト購入は完了しましたが、サーバーの署名確認に失敗しました。追加購入せず再確認してください。": "Apple completed the test purchase, but server verification failed. Check unfinished purchases instead of buying again.",
            "Sandbox取引の署名を確認しました。テスト残高への付与は準備中です。": "Sandbox signature verified. Test balance credit is not available yet.",
            "Sandbox取引を確認しました。テスト残高に100コイン反映済みです。": "Sandbox transaction verified. 100 coins credited to the test balance.",
            "購入の反映を確認できませんでした。未完了の購入を再確認してください。": "Could not confirm the credit. Check unfinished purchases."
        ]
        return Self.localized(message, translations[message] ?? message)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(Self.localized("ムシバース ショップ", "MUSHIVERSE Shop")).font(.title2.bold())
            if store.sandboxPurchasesEnabled {
                Text(Self.localized("Sandbox購入テスト · 通常のコイン残高には反映されません。", "Sandbox test purchases do not affect your regular coin balance."))
                    .foregroundStyle(gold)
            } else if !purchasesEnabled {
                Text(Self.localized("現在は販売準備中です。", "Purchases are not available yet."))
                    .foregroundStyle(gold)
            }
            Text(Self.localized("価格はAppleの商品情報から表示します。", "Prices are provided by Apple."))
                .font(.footnote)

            Text(Self.localized("ガチャコイン", "Gacha Coins")).font(.headline)
            productRow(id: MushiverseCoinStore.sandboxProductID, coins: 100)
            ForEach(MushiverseCoinStore.productIDs
                .filter { $0 != MushiverseCoinStore.sandboxProductID }
                .sorted { MushiverseCoinStore.productionCoinAmounts[$0, default: 0] <
                    MushiverseCoinStore.productionCoinAmounts[$1, default: 0] }, id: \.self) { id in
                if let coins = MushiverseCoinStore.productionCoinAmounts[id] {
                    productRow(id: id, coins: coins)
                }
            }

            Button(Self.localized("Appleの商品情報を再読み込み", "Reload Apple products")) {
                Task { await store.loadProducts() }
            }
            .foregroundStyle(gold)
            .frame(minHeight: 44)
            .disabled(store.isPurchasing || store.isRetrying)
            if let message = store.lastError {
                Text(localizedStatus(message)).font(.footnote).foregroundStyle(gold)
            }
            Button(Self.localized("未完了の購入を再確認", "Check unfinished purchases")) {
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
            Text(Self.localized("\(coins) コイン", "\(coins) coins")).font(.headline)
            if let product {
                Text(product.displayPrice).font(.subheadline.weight(.semibold))
            } else {
                Text(Self.localized("Apple価格未取得", "Apple price unavailable")).font(.footnote)
            }
            Button(available ? (store.sandboxPurchasesEnabled ? Self.localized("テスト購入", "Test purchase") : Self.localized("購入", "Buy")) : Self.localized("販売準備中", "Coming soon")) {
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
