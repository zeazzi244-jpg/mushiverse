# MUSHIVERSE — Apple TEST notification delivery

The App Store Connect Production and Sandbox server URLs have been registered:
`https://jhowxtdemlsmetcwhekr.supabase.co/functions/v1/apple-refund-notifications`.

## Prerequisite: dedicated Apple In-App Purchase API credentials

Apple's **App Store Server API** uses an **In-App Purchase API key** from App Store Connect; the
`ASC_*` App Store Connect-upload key is not interchangeable. Do not paste secrets into a chat,
issue, repository file, commit, or log.

From App Store Connect, open **Users and Access > Integrations > In-App Purchase** (Apple's
exact labels can vary). Create/download the In-App Purchase key and record its Key ID and
Issuer ID. The private `.p8` key is provided only at download time.

In GitHub repository `zeazzi244-jpg/mushiverse`, open:
**Settings > Secrets and variables > Actions > New repository secret**.
Create the following *repository secrets* (not plain repository variables):

- `APPLE_IAP_KEY_ID` — dedicated In-App Purchase key ID
- `APPLE_IAP_ISSUER_ID` — issuer ID
- `APPLE_IAP_PRIVATE_KEY_P8` — exact contents of the private `.p8` file, including BEGIN/END lines

For existing automated setups, `APPLE_IAP_PRIVATE_KEY_P8_BASE64` is also supported instead
of the raw `.p8` secret. Never configure either in a public or client-side context.

## Send a harmless test notification

Open **Actions > Apple App Store Server TEST delivery > Run workflow**; choose `Sandbox`.
The workflow requests a `TEST` notification, polls Apple's delivery status, and reports
only a non-sensitive delivery result; it does not purchase, refund, credit, or enable billing.
A successful API request alone does **not** prove webhook delivery: require
`sendAttemptResult=SUCCESS` and then cross-check Supabase's
`apple-refund-notifications` Edge Function request logs (HTTP 200).

The production TEST event is also harmless but should be requested only for intentional
Production notification validation. A real refund needs a separate, signed REFUND test.

## Release gate

Keep `MushiverseCoinStore.purchasesEnabled=false`, billing mode `off`, sale-enabled
catalog count zero, and `apple_iap_verification_gate.server_jws_verified=false` until
a separately reviewed, real Production payment and refund reconciliation are proven.
