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