# MUSHIVERSE Work Handoff — Apple IAP, 2026-11-21

Repository: zeazzi244-jpg/mushiverse, branch main. Supabase: mushi-log (jhowxtdemlsmetcwhekr). Bundle ID: com.rikuto.mushiverse.

## Completed and verified
- Critical old paid-gacha-wallet backend bypass fixed: previously action=draw called the paid RPC even when billing was switched OFF. Now validates Production billing, checkout, iOS readiness, Apple JWS proof, approved enabled 100-coin product and restricted child account flags.
- The legacy paid-gacha-wallet Edge Function was deployed as ACTIVE v3 and confirmed by querying the live Supabase function contents.
- Read-only paid balance/history remains accessible during a billing pause; draw requests stay blocked. Legacy UI displays paused state; duplicate purchased-gacha UI no longer mounts when the primary card-art panel is present.
- Regression tests added at tests/legacy-paid-wallet-gate.test.mjs. For commit d4b3b24e, the Billing and release regression checks and Verify MUSHIVERSE release scripts both passed.
- At the time of verification: billing_mode=off, no sale-enabled products, no Production purchase credits, no paid draws.
- Production settlement endpoint settle-apple-production-coins v2 exists, but actual production purchase/credit has NOT been proven. purchased-gacha-draw v3 remains separately gated.

## Important remaining work for Work
1. Recheck HEAD, CI and concurrent changes. Do not overwrite later commits.
2. Verify Apple application identity, signed JWS Production flow, real app-account owner matching, transactions and refund/replay rejection; server tests and Sandbox proof are not real Production proof.
3. Verify real end-to-end paid coins credit and paid draw receipt on a signed iPhone test build, while preserving free coin balances and local cards.
4. Only after documented proof and explicit launch approval consider changing iOS purchasesEnabled=false, product sale flags and billing state. Never enable live charging on static tests alone.
5. Generate a signed IPA, upload a new App Store Connect/TestFlight build, verify installation and successful user journey, and submit an App Store update if requirements are met.
6. The existing account's App Store listing says the 100 coin product is approved, but approval alone does not mean live fulfillment works. Do not conflate GitHub Pages deploy with App Store release.

## Useful source files
- ios/App/App/MushiverseCoinStore.swift
- supabase/functions/paid-gacha-wallet/index.ts
- supabase/functions/purchased-gacha-draw/index.ts
- supabase/functions/settle-apple-production-coins/index.ts
- js/paid-gacha-wallet.js; js/purchased-gacha-ui.js
- tests/legacy-paid-wallet-gate.test.mjs

All past work is on the existing main branch; this note summarizes work verified in this conversation, not a claim of a completed production launch.
