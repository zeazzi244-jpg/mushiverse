import Foundation
import StoreKit
import Combine

/// Native iOS component. Not wired to the GitHub Pages web app yet.
/// The backend endpoint must verify Apple's signed transaction before crediting coins.
@MainActor
final class MushiverseCoinStore: ObservableObject {
    static let productIDs: Set<String> = [
        "mushiverse.coins.100",
        "mushiverse.coins.550",
        "mushiverse.coins.1200"
    ]

    @Published private(set) var products: [Product] = []
    @Published private(set) var isPurchasing = false
    @Published private(set) var lastError: String?
    private var updatesTask: Task<Void, Never>?
    // A purchase can arrive through both purchase() and Transaction.updates.
    private var processingTransactionIDs = Set<UInt64>()
    private var isStarted = false
    private var lifecycleGeneration = 0
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
        guard !isStarted else { return }
        isStarted = true
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
        await retryUnfinishedPurchases()
    }

    /// Safely retry StoreKit transactions that were not acknowledged by our server.
    /// The server must independently verify and deduplicate every transaction.
    func retryUnfinishedPurchases() async {
        guard !isRetrying else { return }
        isRetrying = true
        defer { isRetrying = false }
        for await result in Transaction.unfinished {
            if Task.isCancelled { break }
            await process(result)
        }
    }

    func stop() {
        isStarted = false
        updatesTask?.cancel()
        updatesTask = nil
    }

    func loadProducts() async {
        do {
            products = try await Product.products(for: Self.productIDs)
                .filter { $0.type == .consumable }
                .sorted { $0.price < $1.price }
            lastError = nil
        } catch {
            products = []
            lastError = "商品情報を読み込めませんでした"
        }
    }

    func purchase(_ product: Product) async {
        guard Self.productIDs.contains(product.id), product.type == .consumable, !isPurchasing, !isRetrying else { return }
        isPurchasing = true
        lastError = nil
        defer { isPurchasing = false }
        do {
            let accountID = try await appAccountToken()
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
        guard case .verified(let transaction) = result else {
            lastError = "Appleによる購入確認に失敗しました"
            return
        }
        guard Self.productIDs.contains(transaction.productID),
              transaction.revocationDate == nil else { return }
        // Do not send concurrent credit requests for the same transaction.
        guard processingTransactionIDs.insert(transaction.id).inserted else { return }
        defer { processingTransactionIDs.remove(transaction.id) }
        do {
            let token = try await accessToken()
            let expectedAccount = try await appAccountToken()
            guard transaction.appAccountToken == expectedAccount else { throw PurchaseError.accountMismatch }
            guard !token.isEmpty else { throw PurchaseError.unauthorized }
            // Never send an Apple transaction or access token to an untrusted endpoint.
            guard creditEndpoint.scheme == "https", creditEndpoint.host?.lowercased() == "jhowxtdemlsmetcwhekr.supabase.co", creditEndpoint.path == "/functions/v1/credit-apple-gacha-coins" else {
                throw PurchaseError.serverRejected
            }
            var request = URLRequest(url: creditEndpoint)
            request.timeoutInterval = 20
            request.cachePolicy = .reloadIgnoringLocalCacheData
            request.httpMethod = "POST"
            request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(CreditRequest(
                signedTransaction: result.jwsRepresentation
            ))
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                throw PurchaseError.serverRejected
            }
            let receipt = try JSONDecoder().decode(CreditResponse.self, from: data)
            guard receipt.creditedOrPreviouslyCredited else {
                throw PurchaseError.serverRejected
            }
            await transaction.finish()
            lastError = nil
        } catch {
            // Deliberately leave the StoreKit transaction unfinished for retry.
            lastError = "購入情報を確認中です。コインはまだ付与されていません"
        }
    }

    private struct CreditRequest: Encodable {
        let signedTransaction: String
        enum CodingKeys: String, CodingKey {
            case signedTransaction = "signed_transaction"
        }
    }

    private struct CreditResponse: Decodable {
        let creditedOrPreviouslyCredited: Bool
        enum CodingKeys: String, CodingKey {
            case creditedOrPreviouslyCredited = "credited_or_previously_credited"
        }
    }

    private enum PurchaseError: Error {
        case unauthorized
        case serverRejected
        case accountMismatch
    }
}
