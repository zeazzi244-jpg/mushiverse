#!/usr/bin/env python3
"""Fail-closed release invariants; static checks do not replace device or Apple Sandbox tests."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
store = (root / "ios/MushiverseCoinStore.swift").read_text(encoding="utf-8")
shop = (root / "ios/MushiverseCoinShopView.swift").read_text(encoding="utf-8")
backend = (root / "supabase/functions/credit-apple-gacha-coins/index.ts").read_text(encoding="utf-8")

checks = {
    "purchase UI has release gate": "!purchasesEnabled || store.isPurchasing || store.isRetrying" in shop,
    "shop shows preparation notice": "現在は販売準備中です" in shop,
    "only supported products": all(p in store for p in (
        "mushiverse.coins.100", "mushiverse.coins.550", "mushiverse.coins.1200")),
    "purchase requires active shop": "guard isStarted, !Task.isCancelled" in store,
    "credit requests use signed transaction": "result.jwsRepresentation" in store,
    "credit endpoint restricted to HTTPS": 'creditEndpoint.scheme == "https"' in store,
    "transaction finished after server acknowledgment": store.index("receipt.creditedOrPreviouslyCredited") < store.index("await transaction.finish()"),
    "unfinished purchase retries supported": "Transaction.unfinished" in store,
    "backend currently rejects unverified purchases": '"apple_verification_not_configured"' in backend,
    "backend does not currently credit wallets": "credit_verified_gacha_purchase" not in backend and "service_role" not in backend.lower(),
    "backend requires authenticated user": "client.auth.getUser()" in backend,
    "backend returns no-store": '"cache-control": "no-store"' in backend,
}

for name, ok in checks.items():
    print(f'{"PASS" if ok else "FAIL"}: {name}')
if not all(checks.values()):
    raise SystemExit("Release invariants failed")
print("Static release invariants passed; paid purchases remain disabled pending Apple verification.")
