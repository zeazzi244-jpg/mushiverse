import Foundation
import StoreKit
import Combine

/// StoreKit 2 coin store used by the Capacitor native shop.
/// The backend endpoint must verify Apple's signed transaction before crediting coins.
@MainActor
final class MushiverseCoinStore: ObservableObject {
    // Compile-time release gate. Never enable from JavaScript, remote config or localStorage.
    static let purchasesEnabled = false

    static let sandboxProductID = "mushiverse.coins.100"
    static let productionCoinAmounts = [
        sandboxProductID: 100,
        "mushiverse.coins.500": 500,
        "mushiverse.coins.1200": 1200
    ]
    static let productIDs: Set<String> = Set(productionCoinAmounts.keys)

    private static func expectedType(_ id: String) -> Product.ProductType? {
        productIDs.contains(id) ? .consumable : nil
    }

    func canOffer(_ productID: String) -> Bool {
        (Self.purchasesEnabled && Self.productIDs.contains(productID)) ||
            (sandboxPurchasesEnabled && productID == Self.sandboxProductID)
    }

    @Published private(set) var sandboxPurchasesEnabled = false

    var canPurchase: Bool {
        (Self.purchasesEnabled || sandboxPurchasesEnabled) && AppStore.canMakePayments && !isPurchasing && !isRetrying
    }

    @Published private(set) var products: [Product] = []
    @Published private(set) var isPurchasing = false
    @Published private(set) var lastError: String?
    private var updatesTask: Task<Void, Never>?
    // A purchase can arrive through both purchase() and Transaction.updates.
    private var processingTransactionIDs = Set<UInt64>()
    private var isStarted = false
    private var lifecycleGeneration = 0
    private var productLoadGeneration = 0
    @Published private(set) var isRetrying = false
    private let creditEndpoint: URL
    private let accessToken: () async throws -> String
    private let appAccountToken: () async throws -> UUID

    init(creditEndpoint: URL, accessToken: @escaping () async throws -> String, appAccountToken: @escaping () async throws -> UUID) {
        self.creditEndpoint = creditEndpoint
        self.accessToken = accessToken
        self.appAccountToken = appAccountToken
    }

    func start() async {
        guard !isStarted, !Task.isCancelled else { return }
        isStarted = true
        lifecycleGeneration += 1
        let generation = lifecycleGeneration
        guard isStarted, lifecycleGeneration == generation, !Task.isCancelled else { return }
        // Restarting the shop must not leave a second StoreKit updates listener active.
        updatesTask?.cancel()
        updatesTask = nil
        updatesTask = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self else { break }
                await self.process(result)
            }
        }
        await loadProducts()
        guard isStarted, lifecycleGeneration == generation else { return }
        await retryUnfinishedPurchases()
    }

    /// Safely retry StoreKit transactions that were not acknowledged by our server.
    /// The server must independently verify and deduplicate every transaction.
    func retryUnfinishedPurchases() async {
        guard isStarted, !isRetrying, !isPurchasing, !Task.isCancelled else { return }
        isRetrying = true
        let generation = lifecycleGeneration
        lastError = "未完了の購入を再確認しています…"
        defer { isRetrying = false }
        var foundUnfinished = false
        for await result in Transaction.unfinished {
            if Task.isCancelled || !isStarted || lifecycleGeneration != generation { break }
            foundUnfinished = true
            await process(result)
        }
        guard !Task.isCancelled, isStarted, lifecycleGeneration == generation else { return }
        if !foundUnfinished {
            lastError = "再確認が完了しました。未完了の購入はありません。"
        }
    }

    func stop() {
        isStarted = false
        sandboxPurchasesEnabled = false
        lifecycleGeneration += 1
        productLoadGeneration += 1
        updatesTask?.cancel()
        updatesTask = nil
    }

    func loadProducts() async {
        guard !isPurchasing, !isRetrying, !Task.isCancelled else { return }
        productLoadGeneration += 1
        let generation = productLoadGeneration
        do {
            let fetched = try await Product.products(for: Self.productIDs)
                .filter { Self.expectedType($0.id) == $0.type }
            guard !Task.isCancelled, productLoadGeneration == generation else { return }
            products = fetched
            guard fetched.contains(where: { $0.id == Self.sandboxProductID }) else {
                lastError = "Appleから100コインの商品情報が返りませんでした。"
                return
            }
            if #available(iOS 16.0, *), !Self.purchasesEnabled, !sandboxPurchasesEnabled {
                if let appResult = try? await AppTransaction.shared,
                   case .verified(let app) = appResult,
                   app.bundleID == "com.rikuto.mushiverse", app.environment == .sandbox,
                   isStarted, productLoadGeneration == generation, !Task.isCancelled {
                    sandboxPurchasesEnabled = true
                }
                guard isStarted, productLoadGeneration == generation, !Task.isCancelled else { return }
            }
            if !Self.purchasesEnabled && !sandboxPurchasesEnabled {
                // A production App Store install is expected to be non-Sandbox. The real
                // blocker is the still-disabled production fulfillment path, not a
                // missing Apple test account or a product metadata failure.
                lastError = "Appleの商品価格は取得済みです。本番課金の安全確認が完了するまで、このバージョンでは購入できません。"
            } else if !AppStore.canMakePayments {
                lastError = "この端末の設定ではアプリ内購入が許可されていません。"
            } else {
                lastError = nil
            }
        } catch {
            guard !Task.isCancelled, productLoadGeneration == generation else { return }
            products = []
            lastError = "商品情報を読み込めませんでした"
        }
    }

    func purchase(_ product: Product) async {
        guard canOffer(product.id) else {
            lastError = "現在は販売準備中です。購入はできません。"
            return
        }
        guard isStarted, !Task.isCancelled, canPurchase, Self.expectedType(product.id) == .consumable,
              product.type == .consumable, products.contains(where: { $0.id == product.id }) else { return }
        let generation = lifecycleGeneration
        isPurchasing = true
        lastError = nil
        defer { isPurchasing = false }
        do {
            let accountID = try await appAccountToken()
            guard isStarted, lifecycleGeneration == generation, !Task.isCancelled else { return }
            switch try await product.purchase(options: [.appAccountToken(accountID)]) {
            case .success(let verification):
                await process(verification)
            case .pending:
                lastError = "購入の承認を待っています"
            case .userCancelled:
                break
            @unknown default:
                lastError = "購入結果を確認できませんでした"
            }
        } catch {
            lastError = "購入を完了できませんでした"
        }
    }

    private func process(_ result: VerificationResult<Transaction>) async {
        guard isStarted, !Task.isCancelled else { return }
        let generation = lifecycleGeneration
        guard case .verified(let transaction) = result else {
            lastError = "Appleによる購入確認に失敗しました"
            return
        }
        guard #available(iOS 16.0, *) else { return }
        let isSandbox = transaction.environment == .sandbox
        guard isSandbox || (transaction.environment == .production && Self.purchasesEnabled) else { return }
        guard Self.expectedType(transaction.productID) == .consumable,
              transaction.productType == .consumable,
              transaction.revocationDate == nil else { return }
        // Do not send concurrent credit requests for the same transaction.
        guard processingTransactionIDs.insert(transaction.id).inserted else { return }
        defer { processingTransactionIDs.remove(transaction.id) }
        do {
            let token = try await accessToken()
            let expectedAccount = try await appAccountToken()
            guard isStarted, lifecycleGeneration == generation, !Task.isCancelled else { return }
            guard transaction.appAccountToken == expectedAccount else { throw PurchaseError.accountMismatch }
            guard !token.isEmpty else { throw PurchaseError.unauthorized }
            // Never send an Apple transaction or access token to an untrusted endpoint.
            guard creditEndpoint.scheme == "https", creditEndpoint.host?.lowercased() == "jhowxtdemlsmetcwhekr.supabase.co", creditEndpoint.path == "/functions/v1/credit-apple-gacha-coins" else {
                throw PurchaseError.serverRejected
            }
            let claimEndpoint = creditEndpoint.deletingLastPathComponent().appendingPathComponent("submit-apple-purchase-claim")
            let (_, claimResponse) = try await post(
                ClaimRequest(transactionID: String(transaction.id),
                             originalTransactionID: String(transaction.originalID),
                             productID: transaction.productID,
                             environment: isSandbox ? "Sandbox" : "Production"),
                to: claimEndpoint, token: token
            )
            guard claimResponse.statusCode == 200 else { throw PurchaseError.serverRejected }
            guard isStarted, lifecycleGeneration == generation, !Task.isCancelled else { return }
            let settlementEndpoint = !isSandbox
                ? creditEndpoint.deletingLastPathComponent().appendingPathComponent("settle-apple-production-coins")
                : creditEndpoint
            let (data, response) = try await post(
                CreditRequest(transactionID: String(transaction.id), signedTransaction: result.jwsRepresentation),
                to: settlementEndpoint, token: token
            )
            if isSandbox && response.statusCode == 422 {
                // Apple accepted the Sandbox payment, but the server did not
                // verify the signed evidence. Keep the transaction unfinished.
                lastError = "Appleのテスト購入は完了しましたが、サーバーの署名確認に失敗しました。追加購入せず再確認してください。"
                return
            }
            guard response.statusCode == 200 else { throw PurchaseError.serverRejected }
            guard isStarted, lifecycleGeneration == generation, !Task.isCancelled else { return }
            // Finish only after the isolated Sandbox ledger acknowledges this purchase.
            if isSandbox {
                guard let proof = try? JSONDecoder().decode(SandboxProof.self, from: data),
                      proof.ok,
                      proof.verification == "sandbox_signature_verified",
                      proof.transactionID == String(transaction.id),
                      proof.originalTransactionID == String(transaction.originalID),
                      proof.productID == transaction.productID,
                      proof.environment == "Sandbox" else {
                    throw PurchaseError.serverRejected
                }
                if !proof.creditedOrPreviouslyCredited && proof.fulfillment == "disabled_pending_sandbox_proof" {
                    lastError = "Sandbox取引の署名を確認しました。テスト残高への付与は準備中です。"
                    return
                }
                guard proof.creditedOrPreviouslyCredited,
                      proof.fulfillment == "sandbox_test_wallet",
                      proof.productID == Self.sandboxProductID,
                      proof.coins == 100 else { throw PurchaseError.serverRejected }
                await transaction.finish()
                lastError = "Sandbox取引を確認しました。テスト残高に100コイン反映済みです。"
                return
            }
            let receipt = try JSONDecoder().decode(CreditResponse.self, from: data)
            guard receipt.creditedOrPreviouslyCredited, receipt.ok,
                  receipt.verification == "production_signature_verified",
                  receipt.environment == "Production",
                  receipt.transactionID == String(transaction.id),
                  receipt.originalTransactionID == String(transaction.originalID),
                  receipt.productID == transaction.productID,
                  receipt.coins == Self.productionCoinAmounts[transaction.productID] else {
                throw PurchaseError.serverRejected
            }
            await transaction.finish()
            lastError = nil
        } catch {
            // Deliberately leave the StoreKit transaction unfinished for retry.
            lastError = "購入の反映を確認できませんでした。未完了の購入を再確認してください。"
        }
    }

    private func post<Body: Encodable>(_ body: Body, to endpoint: URL, token: String) async throws -> (Data, HTTPURLResponse) {
        var request = URLRequest(url: endpoint)
        request.timeoutInterval = 20
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.httpMethod = "POST"
        request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw PurchaseError.serverRejected }
        return (data, response)
    }

    private struct ClaimRequest: Encodable {
        let transactionID: String
        let originalTransactionID: String
        let productID: String
        // Routing hint only. The backend must verify Apple's signed JWS.
        let environment: String
        enum CodingKeys: String, CodingKey {
            case transactionID = "transaction_id"
            case originalTransactionID = "original_transaction_id"
            case productID = "product_id"
            case environment
        }
    }

    private struct CreditRequest: Encodable {
        let transactionID: String
        let signedTransaction: String
        enum CodingKeys: String, CodingKey {
            case transactionID = "transaction_id"
            case signedTransaction = "signed_transaction"
        }
    }

    private struct SandboxProof: Decodable {
        let ok: Bool
        let verification: String
        let transactionID: String
        let originalTransactionID: String
        let productID: String
        let environment: String
        let creditedOrPreviouslyCredited: Bool
        let fulfillment: String
        let coins: Int?
        enum CodingKeys: String, CodingKey {
            case ok, verification, fulfillment, coins
            case transactionID = "transaction_id"
            case originalTransactionID = "original_transaction_id"
            case productID = "product_id"
            case environment
            case creditedOrPreviouslyCredited = "credited_or_previously_credited"
        }
    }

    private struct CreditResponse: Decodable {
        let ok: Bool
        let creditedOrPreviouslyCredited: Bool
        let verification: String
        let environment: String
        let transactionID: String
        let originalTransactionID: String
        let productID: String
        let coins: Int
        enum CodingKeys: String, CodingKey {
            case ok, verification, environment, coins
            case creditedOrPreviouslyCredited = "credited_or_previously_credited"
            case transactionID = "transaction_id"
            case originalTransactionID = "original_transaction_id"
            case productID = "product_id"
        }
    }

    private enum PurchaseError: Error {
        case unauthorized
        case serverRejected
        case accountMismatch
    }
}
