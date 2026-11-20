# Apple IAP verification and Sandbox release gate

Production status: disabled. The 100-coin SKU is the only native Sandbox purchase offered.

## Sandbox fulfillment
- Set `APPLE_IAP_SANDBOX_TESTER_USER_ID` to the Supabase account UUID designated for Sandbox. Without that setting, the endpoint verifies eligible Sandbox signatures without acknowledging fulfillment.
- Apply the isolated Sandbox ledger migration before deploying the credit function. Continue provisioning Apple's trusted root certificates with `APPLE_IAP_ROOT_CERTS_DER_BASE64` and pin `APPLE_IAP_BUNDLE_ID=com.rikuto.mushiverse`.
- The server derives the buyer from Supabase authentication and matches Apple's signed account token. The Sandbox ledger records exactly 100 test coins per verified transaction ID. Balance for testing is the sum of that account's ledger entries.
- The native app finishes the purchase only after a matching receipt for the Sandbox ledger. To test interruption, take the app offline before fulfillment, reconnect, then reopen the shop or tap “未完了の購入を再確認”. Confirm one ledger entry and a 100-coin delta, then replay and confirm zero additional credits. Check a second account is rejected and the normal wallet balance stays the same.
- The iPhone run requires a signed Sandbox-capable build, an Apple Sandbox environment, and Apple’s registered product metadata. Capture redacted transaction evidence and record the actual result before release.

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
