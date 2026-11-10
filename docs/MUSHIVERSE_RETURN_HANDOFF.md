# MUSHIVERSE — development resumption handoff

Updated: 2026-11-10 (JST). This file records *verified GitHub edits in the current session*, not a claim that the iOS app has shipped.

## Repository and release identity
- Repository: https://github.com/zeazzi244-jpg/mushiverse
- Default working branch used in this session: `main`
- Capacitor app ID: `com.rikuto.mushiverse`; web directory: `www`
- Release entry point: `index.html`; theme: `css/adventure-ui.css`
- Scripts: `npm run build:web`, `npm run test:release`, `npm run ios:prepare`, `npm run ios:check`
- Approved icon source: `assets/MUSHIVERSE-AppIcon-1024.png`

## Verified work
- `7d914fb5f424`: adjusted web bundle generation to exclude development and sensitive artifacts.
- `c815f5738f73`: added a release bundle exclusion test.
- `4e1b03b34366`: improved mobile readability, touch targets, and reduced-motion styles.
- `7b0fd103f44f`: added regression checks for those styles.
- These are **source-control changes**, not evidence that device tests or App Store submission succeeded.

## User-facing product direction
MUSHIVERSE should feel like a polished insect discovery adventure, not a cluttered administrative dashboard. Six main sections: Home, Record, Gacha, Collection, Map, Profile. Keep the real-insect record collection distinct from fantasy gacha cards. Prioritize discoverability, delight, accessibility, readable Japanese text, responsive mobile navigation, and a safe kids mode. Do not remove user records or purchased items when simplifying the UI.

## Critical next checks (in order)
1. Verify the latest GitHub main SHA, open PRs, branch divergence, and CI status. Never assume historical PR #2 is still open.
2. Run `npm run test:release` after `npm ci`; inspect failures. The new release bundle test must pass before distributing a native build.
3. Validate `npm run ios:prepare` and `npm run ios:check` in a suitable macOS/iOS build environment.
4. Reproduce and investigate any startup blank screen on a physical iPhone/TestFlight build; browser tests alone cannot establish native reliability.
5. Inspect actual Home/Gacha/Profile UI before removing any panel. Hide developer-only UI in production, preserve working features and data.
6. Verify Apple signing, latest TestFlight build, App Store Connect privacy metadata, review credentials, map licensing, and actual submission status. These are **not verified** by this document.
7. Commit small tested changes, push, record the SHA and update this handoff.

## Safety and privacy
Never place account credentials, provisioning keys, private user details, or medical information in this repository. Do not force-push or merge unverified changes. Do not claim tests passed unless their results were observed.

## Resume checklist
Open the repo; check latest commits and CI; read this file; run release tests; fix the highest-impact verified failure; commit and push; update this file with results. Request user action only for necessary authentication, device checks, or explicit high-impact approvals.
