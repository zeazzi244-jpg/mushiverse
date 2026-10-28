# Apple coin purchase release checklist

Current state: coin shop buttons are disabled. The web app cannot perform StoreKit purchases by itself.

Required before enabling:
1. Confirm the native iOS bundle ID and configure consumable products in App Store Connect.
2. Implement StoreKit 2 purchases in the native app; display localized Apple prices.
3. Verify signed Apple transaction data on a trusted server, including bundle ID, product ID, revocation and user binding.
4. Credit coins once per verified transaction. Never treat a client-supplied transaction ID as proof of purchase.
5. Connect purchased coin spending to server-authoritative gacha draws. Existing local coins are not purchased coins.
6. Test retries, duplicates, refunds, account switching and offline behavior in Apple Sandbox on iPhone.
7. Keep purchase buttons disabled until end-to-end testing succeeds.

Do not expose a Supabase service-role key in frontend code.

## Verified backend findings (2026-10-28)

Supabase project mushi-log has coin wallet, credit, spend, and paid-draw tables. Its live credit RPC has three arguments (transaction ID, user ID, product ID), not the four-argument version in the checked-in migration. Do not apply that migration blindly.

The deployed submit-apple-purchase-claim Edge Function only accepts premium product IDs and stores pending premium claims. It does not validate signed coin transactions or credit gacha coins. The native client expects a separate credit-apple-gacha-coins endpoint; do not enable purchase buttons until this authenticated endpoint is implemented and Apple-signed transaction verification is tested.

The live credit, spend, and paid-draw RPCs deny execution to the authenticated database role. Keep service-role credentials exclusively on the server.

Additional server requirements: validate the signed transaction against Apple trust, bundle ID, product ID, environment, revocation, and authenticated user's appAccountToken; reject wrong-account transactions; ensure a repeated transaction ID cannot credit a different account; return credited_or_previously_credited only for the same verified transaction and account; verify in Sandbox before enabling purchases.

## Parallel release workstreams (2026-10-28)

### Native app and signing
- [ ] Confirm actual Xcode project/workspace and target membership for both `ios/MushiverseCoinStore.swift` and `ios/MushiverseCoinShopView.swift`. Source files in GitHub do not prove the app compiles or calls them.
- [ ] Confirm deployment target supports StoreKit 2 and verify bundle ID against App Store Connect.
- [ ] Connect authenticated Supabase session access token and a stable account-bound UUID for `appAccountToken`; test account changes.
- [ ] Run a signed iPhone build and confirm product metadata comes from Apple, not hard-coded prices.

### Apple verification and backend
- [ ] Replace the fail-closed `credit-apple-gacha-coins` stub only after implementing trusted JWS certificate-chain and signature verification against Apple roots; reject untrusted certificates and malformed signatures.
- [ ] Check transaction bundle ID, allowed product ID, consumable type, environment, appAccountToken binding, revocation, and relevant purchase dates.
- [ ] Verify the Supabase authenticated user from the Bearer token, derive user ID server-side, and reject cross-account claims.
- [ ] Make wallet credit atomic and idempotent, including duplicate requests and concurrent requests. Only same-user verified duplicates can return success.
- [ ] Resolve the live 3-argument RPC versus checked-in 4-argument migration mismatch before deployment; do not blindly apply migrations.
- [ ] Keep purchase buttons disabled until successful end-to-end Sandbox tests.

### User flows and regression tests
- [ ] Purchase each of the 100, 550 and 1200 coin products in Sandbox and verify the exact wallet delta.
- [ ] Retry after lost connectivity or a 503 response; the transaction must remain unfinished until server acknowledgement.
- [ ] Re-deliver the same Apple transaction through purchase completion, transaction updates and unfinished retries; credit only once.
- [ ] Verify account switching, invalid tokens, forged transactions, mismatched bundle IDs, revoked transactions and unexpected products cannot credit coins.
- [ ] Verify paid gacha draws debit the authoritative server wallet exactly once, including duplicate draw IDs and concurrent draws.
- [ ] Verify free login coins, quest coins and existing local coins are not silently treated as purchased coins.
- [ ] Check VoiceOver labels, loading states, Japanese error messages, and safe-area layout on iPhone.

### App Store submission
- [ ] Configure consumable IAP products and their review metadata in App Store Connect.
- [ ] Prepare privacy policy, account deletion flow, screenshots, age rating, support contact, and review notes.
- [ ] Upload and test a build through TestFlight; only then submit for Apple review.

**Status:** These are outstanding release gates, not completed tests. Current StoreKit files are source-only until their integration into a build is verified.
