import Foundation
import StoreKit
import Combine

/// StoreKit 2 coin store used by the Capacitor native shop.
/// The backend endpoint must verify Apple's signed transaction before crediting coins.
@MainActor
final class MushiverseCoinStore: ObservableObject {
    // Compile-time release gate. Never enable from JavaScript, remote config or localStorage.
    static let purchasesEnabled = false

    static let coinPacks: [(id: String, coins: Int)] = [100, 300, 500, 1200, 2500, 5500, 12000].map {
        ("mushiverse.coins.\($0)", $0)
    }
    static let premiumID = "jp.mushiverse.premium.monthly"
    static let adventurePassID = "jp.mushiverse.adventure.pass.30d"
    static let productIDs = Set(coinPacks.map { $0.id } + [premiumID, adventurePassID])

    private static func expectedType(_ id: String) -> Product.ProductType? {
        switch id {
        case premiumID: return .autoRenewable
        case adventurePassID: return .nonRenewable
        default: return coinPacks.contains(where: { $0.id == id }) ? .consumable : nil
        }
    }

    var canPurchase: Bool {
        Self.purchasesEnabled && AppStore.canMakePayments && !isPurchasing && !isRetrying
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
        defer { isRetrying = false }
        for await result in Transaction.unfinished {
            if Task.isCancelled || !isStarted || lifecycleGeneration != generation { break }
            await process(result)
        }
    }

    func stop() {
        isStarted = false
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
            lastError = nil
        } catch {
            guard !Task.isCancelled, productLoadGeneration == generation else { return }
            products = []
            lastError = "商品情報を読み込めませんでした"
        }
    }

    func purchase(_ product: Product) async {
        guard Self.purchasesEnabled else {
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
        guard Self.purchasesEnabled, isStarted, !Task.isCancelled else { return }
        let generation = lifecycleGeneration
        guard case .verified(let transaction) = result else {
            lastError = "Appleによる購入確認に失敗しました"
            return
        }
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
                             originalTransactionID: String(transaction.originalID), productID: transaction.productID),
                to: claimEndpoint, token: token
            )
            guard claimResponse.statusCode == 200 else { throw PurchaseError.serverRejected }
            guard isStarted, lifecycleGeneration == generation, !Task.isCancelled else { return }
            let (data, response) = try await post(
                CreditRequest(transactionID: String(transaction.id), signedTransaction: result.jwsRepresentation),
                to: creditEndpoint, token: token
            )
            guard response.statusCode == 200 else { throw PurchaseError.serverRejected }
            let receipt = try JSONDecoder().decode(CreditResponse.self, from: data)
            guard isStarted, lifecycleGeneration == generation, !Task.isCancelled else { return }
            guard receipt.creditedOrPreviouslyCredited,
                  receipt.transactionID == String(transaction.id),
                  receipt.productID == transaction.productID else {
                throw PurchaseError.serverRejected
            }
            await transaction.finish()
            lastError = nil
        } catch {
            // Deliberately leave the StoreKit transaction unfinished for retry.
            lastError = "購入情報を確認中です。コインはまだ付与されていません"
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
        enum CodingKeys: String, CodingKey {
            case transactionID = "transaction_id"
            case originalTransactionID = "original_transaction_id"
            case productID = "product_id"
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

    private struct CreditResponse: Decodable {
        let creditedOrPreviouslyCredited: Bool
        let transactionID: String
        let productID: String
        enum CodingKeys: String, CodingKey {
            case creditedOrPreviouslyCredited = "credited_or_previously_credited"
            case transactionID = "transaction_id"
            case productID = "product_id"
        }
    }

    private enum PurchaseError: Error {
        case unauthorized
        case serverRejected
        case accountMismatch
    }
}
