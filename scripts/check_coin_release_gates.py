#!/usr/bin/env python3
"""Fail-closed release invariants; static checks do not replace device or Apple Sandbox tests."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
store = (root / "ios/App/App/MushiverseCoinStore.swift").read_text(encoding="utf-8")
shop = (root / "ios/App/App/MushiverseCoinShopView.swift").read_text(encoding="utf-8")
backend = (root / "supabase/functions/credit-apple-gacha-coins/index.ts").read_text(encoding="utf-8")

checks = {
    "purchase UI has release gate": "!canTestPurchase || store.isPurchasing || store.isRetrying" in shop
        and "purchasesEnabled || store.sandboxPurchasesEnabled" in shop,
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
    "transaction finished after server acknowledgment": store.index("receipt.creditedOrPreviouslyCredited") < store.index("await transaction.finish()"),
    "unfinished purchase retries supported": "Transaction.unfinished" in store,
    "backend rejects unverified purchases": '"apple_transaction_verification_failed"' in backend,
    "backend does not currently credit wallets": not re.search(r"\.(rpc|insert|upsert|update|delete)\s*\(", backend),
    "backend requires authenticated user": ".auth.getUser()" in backend,
    "backend returns no-store": '"cache-control": "no-store"' in backend,
}

for name, ok in checks.items():
    print(f'{"PASS" if ok else "FAIL"}: {name}')
if not all(checks.values()):
    raise SystemExit("Release invariants failed")
print("Static release invariants passed; paid purchases remain disabled pending Apple verification.")
