# Apple IAP verification and Sandbox release gate

Status: BLOCKED. This checklist does not authorize payments or coin grants.

## Current server behavior (verified against deployed Edge Function source)
- `submit-apple-purchase-claim` v14 stores *untrusted* transaction metadata as pending, with environment set to null; no entitlement is granted.
- `credit-apple-gacha-coins` v1 explicitly returns HTTP 503 `apple_verification_not_configured` after user authentication.
- Do not replace this fail-closed endpoint with client-trusted credits.

## Server-side transaction verification acceptance criteria
1. Authenticate the Supabase user server-side. Bind each verified Apple transaction to the correct user, with an authenticated, tamper-resistant account token/ownership policy.
2. Verify Apple's signed transaction JWS using Apple's trusted certificate chain and signed payload validation (including bundle ID, product ID, environment, transaction ID, purchase/revocation dates, and expiration for subscriptions). Do not trust fields sent separately by the client.
3. Retrieve authoritative transaction status from Apple App Store Server API where required. Validate environment and handle Sandbox separately. Reject unverifiable, revoked, mismatched or expired transactions.
4. Atomically insert a verified transaction and a single credit ledger entry; credit wallet balance only once. Enforce unique transaction ID at database level. Roll back all steps on failure.
5. For premium, derive active status from verified renewal, expiration, revocation and refund data. Never use the pending claims table as proof of entitlement.
6. Test replay, cross-account replay, parallel duplicate requests, refund, revoked transaction, wrong product, wrong bundle, expired subscription, Apple API unavailable, malformed JWS and offline cases.
7. Confirm App Store Connect product identifiers and prices, tax/storefront presentation, Sandbox test account, StoreKit configuration, TestFlight install and restore purchases.
8. Keep `billing_mode=off`, `checkout_enabled=false`, `ios_iap_ready=false`, and every catalog `is_sale_enabled=false` until a verified end-to-end Sandbox test and explicit production release decision.

## Planned coin packs (not activated)
- `mushiverse.coins.100`: 100 coins, JPY 160
- `mushiverse.coins.500`: 500 coins, JPY 480
- `mushiverse.coins.1200`: 1200 coins, JPY 980

## Evidence required to unblock
Record Apple Sandbox transaction ID (redacted), verified JWS result, matching server event, exactly one ledger credit and wallet delta, successful duplicate replay with zero additional credits, verified premium renewal/expiration, and passing CI tests. Never store private keys or unredacted tokens in GitHub.
