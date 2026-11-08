# MUSHIVERSE — handoff for next Work session (2026-11-08)

## Source of truth
- Repository: `zeazzi244-jpg/mushiverse`, branch `main`.
- Bundle ID: `com.rikuto.mushiverse`.
- Approved icon: deep-green background, white butterfly, opaque 1024x1024 RGB PNG.
- Approved icon exists in the ChatGPT conversation as `MUSHIVERSE-AppIcon-1024.png`, **not yet committed to this repository**.
- Do not claim the icon is installed in TestFlight before confirming a successful native build and upload.

## Code prepared
- `scripts/prepare-ios.mjs` handles first-time `cap add ios` and subsequent `cap sync ios`.
- `scripts/apply-ios-icon.mjs` copies the approved PNG to the Xcode AppIcon catalog and checks PNG format.
- `scripts/check-ios-release.mjs` fails if native project, web bundle or AppIcon is missing/invalid.
- `.github/workflows/verify.yml` checks script syntax, builds web bundle, validates bundle ID and release guard on pushes.
- `npm run ios:prepare` is the single preparation command after approved PNG is available.

## Remaining blockers, in priority order
1. Transfer the **exact approved PNG** into `assets/MUSHIVERSE-AppIcon-1024.png` (do not generate a lookalike).
2. Confirm GitHub Actions `Verify MUSHIVERSE release scripts` passes. Fix any reported failure.
3. Run `npm install` and `npm run ios:prepare` on macOS with Xcode; inspect generated native project and AppIcon.
4. Configure signing, build number and App Store Connect/TestFlight upload; confirm installed icon on device.
5. Test cold start/white screen, login, records, navigation, purchases and privacy disclosures before App Store submission.

## Operating rules
- Do not overwrite concurrent Work changes: fetch the latest main SHA before editing.
- Do not commit credentials, Apple certificates or private user data.
- Do not modify production records or paid purchase settings without an explicit need.
- Report only actual commits and verified test results. GitHub Actions checks are not a substitute for an Xcode/TestFlight build.
