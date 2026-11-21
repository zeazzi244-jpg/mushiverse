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

## Subsequent security hardening — confirmed live in Supabase
- Discovered the legacy permissive RLS policy account_active_v21 FOR ALL OR-combined with owner-select rules, allowing potential cross-account viewing of paid wallet/ledger rows. Removed it on gacha_coin_wallets, gacha_paid_draws and gacha_coin_purchase_credits, leaving only authenticated owner-read policies. All client write privileges on those three tables revoked.
- Removed the same overbroad RLS policy on gacha_coin_spends, premium_entitlements, premium_waitlist, referral_claims, monetization_events, community_reports; retained their own/related read, own reports and existing event submit rules. Added explicit own-row waiting-status signup policy for premium_waitlist; blocked client UPDATE/DELETE on the sensitive tables.
- Also removed account_active_v21 from profile_usernames, user_follows, insect_posts, post_comments, post_likes and gacha_collection_leaderboard to prevent the permissive policy bypassing separate owner edit/delete rules. Existing specific social read/write policies were left intact.
- Relevant migrations: 20261121195500_lock_paid_wallet_owner_rls.sql, 20261121200000_financial_owner_rls_hardening.sql, 20261121201000_stop_cross_user_social_mutation.sql. All applied to live Supabase and inspected via pg_policies. No proof of actual unauthorized access was found/claimed.
- Regression tests: tests/financial-owner-rls-guard.test.mjs and tests/social-owner-rls-guard.test.mjs. Check CI for latest HEAD before deployment or launch.
- Work should review all remaining account_active_v21 policies and verify account deactivation enforcement separately; these changes do not certify all RLS policy/security quality.

## RLS incident remediation complete (2026-11-21)
- A critical permissive policy named account_active_v21 FOR ALL was found on many public tables. PostgreSQL permissive RLS combines policies using OR, which could bypass owner-only SELECT and write policies. Risk confirmed from schema; there is no evidence of actual unauthorized access.
- Live Supabase migrations applied: 20261121195500_lock_paid_wallet_owner_rls.sql, 20261121200000_financial_owner_rls_hardening.sql, 20261121201000_stop_cross_user_social_mutation.sql, 20261121202000_remove_remaining_broad_rls.sql. These remove account_active_v21 from sensitive ledger, entitlement, referral, report, social, Apple and moderator tables while retaining existing specific policies.
- Direct SQL verification confirmed ZERO remaining account_active_v21 policies in public schema. User-owned paid wallet, paid draws and purchase credit tables retain owner-only SELECT policies and no client INSERT, UPDATE or DELETE privileges. Premium waitlist signup retains owner-only pending INSERT policy. Social own-edit/own-delete and report submit policies remain.
- Regression tests: tests/financial-owner-rls-guard.test.mjs, tests/social-owner-rls-guard.test.mjs, tests/backend-private-rls-guard.test.mjs. GitHub Actions billing/release regression and release scripts passed at commit eed07b75.
- Supabase security advisor still reports informational RLS-with-no-policy for deliberately backend-only private tables, and warns that moderator RPCs are SECURITY DEFINER callable by authenticated users. Source inspection showed those moderator functions explicitly check moderator_accounts membership; do not revoke without ensuring admin moderation remains functional. Advisor also flags leaked-password protection disabled, which requires Supabase Auth settings review. Relevant official guide: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
- Billing final check: billing_mode=off, 0 products on sale, 0 production coin credits, 0 paid draws. No live charge occurred.
- IMPORTANT: Confirm all current real-role RLS access with integration tests and assess other policies before turning production billing on. Do not treat these migration checks as complete security certification.

## Production eligibility gates — 2026-11-21
- Production server endpoint `settle-apple-production-coins` now enforces server-controlled `user.app_metadata` flags (`kid_mode`, `minor`, `iap_disabled`) before signed-JWS verification and any wallet settlement. Deployed ACTIVE v3. Code `776448b3`.
- Existing purchase-claim endpoint `submit-apple-purchase-claim` now denies the same restricted accounts before inserting pending claims, while leaving normal verified Sandbox testing intact. Deployed ACTIVE v26. Code `8175d2c7`.
- Behavioral tests added in `tests/apple-production-endpoint-behavior.test.mjs` and `tests/apple-purchase-claim.test.mjs`. Check latest CI for commit `e5573a52` before treating the tests as passing.
- All gates remain CLOSED: native `purchasesEnabled=false`, DB `billing_mode=off`, 0 sale-enabled products and 0 real Production purchase credits. These checks are additional safety restrictions, not verification of real Apple payment flow.
- IMPORTANT: The app_metadata protections only apply if the backend actually populates these flags from a trustworthy age/guardian policy. Do not misrepresent them as comprehensive age assurance.
