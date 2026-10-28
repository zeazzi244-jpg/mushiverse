#!/usr/bin/env python3
"""Fail-closed release invariants; static checks do not replace device or Apple Sandbox tests."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
store = (root / "ios/App/App/MushiverseCoinStore.swift").read_text(encoding="utf-8")
shop = (root / "ios/App/App/MushiverseCoinShopView.swift").read_text(encoding="utf-8")
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
    "native purchase gate is fixed off": "static let purchasesEnabled = false" in store and "guard Self.purchasesEnabled else" in store,
    "backend credit is gated independently": 'Deno.env.get("APPLE_COIN_CREDIT_ENABLED") !== "true"' in backend,
    "official Apple verifier and current status required": "new SignedDataVerifier" in backend and "apple.getTransactionInfo" in backend,
    "only versioned RPC may credit": 'admin.rpc("credit_verified_gacha_purchase_v2"' in backend,
    "backend requires authenticated user": "client.auth.getUser()" in backend,
    "backend returns no-store": '"cache-control": "no-store"' in backend,
}

for name, ok in checks.items():
    print(f'{"PASS" if ok else "FAIL"}: {name}')
if not all(checks.values()):
    raise SystemExit("Release invariants failed")
print("Static release invariants passed; paid purchases remain disabled pending Apple verification.")
