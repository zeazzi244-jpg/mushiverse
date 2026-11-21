# MUSHIVERSE Apple IAP — verified implementation status (2026-11-21 JST)

Repository: `zeazzi244-jpg/mushiverse` on `main`. Supabase: `mushi-log`.
Bundle ID: `com.rikuto.mushiverse`. Apple listing ID: `6826061606`.

## Confirmed
- App Store Connect screenshots showed app iOS 1.0.1 ready for distribution and consumable `mushiverse.coins.100` approved at JPY 160.
- TestFlight/Sandbox device screenshots showed a real StoreKit Sandbox transaction with 100 coins added to an isolated Sandbox ledger; **not** a Production payment.
- Supabase functions deployed: `settle-apple-production-coins` v2 with platform JWT check and `paid-gacha-wallet` v2 with platform JWT check.
- New DB migrations deployed: `gate_apple_catalog_after_approved_proof`, `settle_verified_apple_coin_production`, `server_only_paid_draw_permission`, `secure_paid_gacha_rng`.
- Production API validates Apple's certificate-chain-signed JWS and binds product, app ID, transaction, account and environment before invoking a server-only atomic settlement RPC. Native code accepts Production settlement receipts only with matching IDs, environment, verification type and denomination.
- Existing Sandbox fulfillment remains separate; it cannot credit the Production wallet.
- The paid-draw API uses the authenticated account only, the Postgres wallet, idempotent draw IDs, and stored paid-draw receipts. The UI in `js/paid-gacha-wallet.js` keeps the paid wallet distinct from local/free coins. Purchased card history is sourced from the server.
- Cryptographic randomness now supplies the paid draw probabilities and card selection. In a sample of 1000 calls, all results were unique and inside the allowed 0..1 range (sampling is not proof of exact drop-rate fairness).
- Real database rollback-only tests passed: first valid synthetic Production settlement +100, replay +0, wrong-owner replay rejected; paid draw 1 costs 50, replay costs 0, 10 draws cost 450, with all synthetic changes rolled back.
- Post-test checks confirmed billing mode `off`, `checkout_enabled=false`, `ios_iap_ready=false`, zero sale-enabled products out of seven catalog rows, zero Production purchase credits.
- Signed iOS Simulator *unsigned compile* succeeded for native Production handshake changes, with subsequent GitHub billing/release regression runs passing. This does NOT mean a signed TestFlight build was uploaded.

## Explicit release blockers; do not falsely mark complete
1. `MushiverseCoinStore.purchasesEnabled` remains **false**, deliberately: a Production app must not begin charging customers before release approval.
2. The DB verification gate flags are still closed. They must remain closed until Apple signed receipt proof and rollback/replay safety requirements have been reviewed.
3. App Store users have not received an updated signed native build from these commits; TestFlight upload, actual iPhone execution of the new purchased-coin UI, final review metadata and App Store release remain required.
4. A **real** App Store Production paid transaction (as opposed to the Sandbox transaction) and full paid-wallet/gacha reconciliation have not been observed. No claim of Production billing live or actual revenue is permitted yet.
5. The production account token / refund handling and Apple server notifications should be exercised with a restricted real release before general monetization. Never use a client-reported transaction ID alone as proof.

## Release safety
- Do not change `purchasesEnabled=false` or `billing_mode=off`, activate catalog products, or publish a paid build based solely on static tests.
- Do not treat free local gacha balances as paid balances, or copy server wallet coins into local storage.
- Future work must check latest GitHub main and the currently deployed Supabase function version before editing because other scheduled tasks work concurrently.
- For safe DB regression reruns, use `supabase/tests/apple_production_atomic_settlement_rollback.sql` and `supabase/tests/paid_gacha_draw_idempotent_rollback.sql`. Both explicitly roll back test changes.
- Never commit Apple signing keys, StoreKit credentials, private user data or actual unredacted JWS.
