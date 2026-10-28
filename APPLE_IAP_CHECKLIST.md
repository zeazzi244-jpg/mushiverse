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
