#!/usr/bin/env python3
"""Fail-closed release invariants; static checks do not replace device or Apple Sandbox tests."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
store = (root / "ios/App/App/MushiverseCoinStore.swift").read_text(encoding="utf-8")
shop = (root / "ios/App/App/MushiverseCoinShopView.swift").read_text(encoding="utf-8")
backend = (root / "supabase/functions/credit-apple-gacha-coins/index.ts").read_text(encoding="utf-8")

checks = {
    "purchase UI has release gate": "store.canOffer(id)" in shop
        and ".disabled(!available || !store.canPurchase)" in shop
        and "guard canOffer(product.id)" in store
        and 'sandboxPurchasesEnabled && productID == Self.sandboxProductID' in store,
    "sandbox gate requires verified Apple app transaction": all(fragment in store for fragment in (
        "let appResult = try? await AppTransaction.shared",
        "case .verified(let app) = appResult",
        'app.bundleID == "com.rikuto.mushiverse", app.environment == .sandbox',
        "transaction.environment == .sandbox",
    )) and store.count("sandboxPurchasesEnabled = true") == 1,
    "shop shows preparation notice": "現在は販売準備中です" in shop,
    "only three approved coin products": '[100, 500, 1200].map' in store and '[100, 300, 500, 1200, 2500, 5500, 12000]' not in store,
    "payments stay disabled": "static let purchasesEnabled = false" in store,
    "honor Apple payment restrictions": "AppStore.canMakePayments" in store,
    "purchase requires active shop": "guard isStarted, !Task.isCancelled" in store,
    "credit requests use signed transaction": "result.jwsRepresentation" in store,
    "credit endpoint restricted to HTTPS": 'creditEndpoint.scheme == "https"' in store,
    "transaction finished after server acknowledgment": store.index('proof.fulfillment == "sandbox_test_wallet"') < store.index("await transaction.finish()")
        and store.index("receipt.creditedOrPreviouslyCredited") < store.rindex("await transaction.finish()"),
    "unfinished purchase retries supported": "Transaction.unfinished" in store,
    "backend rejects unverified purchases": '"apple_transaction_verification_failed"' in backend,
    "backend writes only to the isolated Sandbox ledger": re.findall(r'\.rpc\("([^"]+)"', backend)
        == ["get_apple_sandbox_verifier_secret", "is_apple_sandbox_tester", "record_apple_sandbox_coin_credit"]
        and not re.search(r"gacha_coin_wallets|\.(insert|upsert|update|delete)\s*\(", backend),
    "backend requires authenticated user": ".auth.getUser()" in backend,
    "backend returns no-store": '"cache-control": "no-store"' in backend,
}

for name, ok in checks.items():
    print(f'{"PASS" if ok else "FAIL"}: {name}')
if not all(checks.values()):
    raise SystemExit("Release invariants failed")
print("Static release invariants passed; paid purchases remain disabled pending Apple verification.")
