# MUSHIVERSE Apple Server Notifications V2 — release setup

Checked 2026-11-22 (JST). App bundle: `com.rikuto.mushiverse`.
Apple numeric app ID: `6826061606`.

## Deployed callback

```
https://jhowxtdemlsmetcwhekr.supabase.co/functions/v1/apple-refund-notifications
```

Supabase Edge Function `apple-refund-notifications` v3 runs without Supabase JWT
because Apple does not provide one. It requires Apple-signed outer notification
AND Apple-signed nested transaction, pinned Apple Root CA G3, the Production
bundle/app identity, the 100-coin consumable, owner and refund timestamp before
calling a restricted server-only SQL RPC. Verified Sandbox notifications are
acknowledged without ever writing to Production. All other invalid signatures
are rejected. Transient Apple certificate/OCSP verifier outages return HTTP 503
so Apple can retry without touching a wallet.

## Owner action in App Store Connect

1. Open Apps → MUSHIVERSE → General → App Information.
2. In App Store Server Notifications, choose the Production Server URL setup.
3. Enter the HTTPS callback above, select **Version 2**, save.
4. Configure the Sandbox Server URL with the same callback and **Version 2**
   if testing Sandbox notifications. It verifies and ignores Sandbox events.
5. Send an Apple test notification and confirm a successful status in
   Supabase function logs. A signed TEST event must never alter coin balances.
6. Independently test a genuine signed REFUND after limited Production
   release, and verify a refund hold, the protected user account, prior draw
   receipt replay and no new spend. Never fabricate a refund JWS to authorize
   funds movement.

Apple documentation:
https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/enter-server-urls-for-app-store-server-notifications

## Remaining hard blocks

- `MushiverseCoinStore.purchasesEnabled` must stay false until deliberate review.
- `billing_settings.billing_mode='off'`, `checkout_enabled=false`, and
  `ios_iap_ready=false` remain closed pending real Production evidence.
- Production JWS verification gate remains closed.
- Real Apple notification delivery, App Store build approval, refund settlement,
  and app transaction/customer reconciliation are not yet proven.
- Refund quarantine pauses new paid draws pending manual reconciliation;
  it does not silently deduct coins or delete earned cards. A full resolution/
  debt policy must be reviewed before unrestricted monetization.
