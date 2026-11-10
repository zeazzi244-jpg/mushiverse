> 最新の引き継ぎ状況は [2026-10-28公開準備レポート](docs/RELEASE_STATUS_2026-10-28.md) を参照。以下は過去の調査・計画を含み、現在の完了証明ではありません。

# MUSHIVERSE — iOS / App Store release gate
Updated: 2026-10-26
Web repository: https://github.com/zeazzi244-jpg/mushiverse
Web frontend at review: index.html (v126)

## Current verified state
- [x] Web frontend exists, with six sections and gacha, feed, map, account UI.
- [x] Connected GitHub account has admin/push rights to the repository.
- [x] Native Xcode project is committed at ios/App/App.xcodeproj/project.pbxproj; compilation/signing are separate gates.
- [x] Capacitor configuration exists at capacitor.config.json.
- [x] package.json and package-lock.json exist.
- [ ] Signed .ipa build verified — NOT VERIFIED.
- [ ] TestFlight build uploaded — NOT VERIFIED.
- [ ] App Store review submitted — NOT VERIFIED.

**Important**: These checks cover specific conventional paths; absence from those paths is not proof that an iOS project exists nowhere else. Do not claim an app build or review submission from web releases alone.

## Priority 1 — Buildable native app
1. Choose a compliant iOS architecture (native shell plus meaningful device-native experiences, or a native/Capacitor project). Web-only GitHub Pages is not an .ipa.
2. Create Xcode project, real bundle ID matching App Store Connect, signing Team and deployment target. Never commit private signing certificates or secrets.
3. Wire in camera permission explanations, photo access behavior, location permission and microphone only if used. Do not request permissions on launch without context.
4. Handle links and login sessions inside the iOS app, external links, offline states and Apple sign-in where applicable.
5. Run a device build and a TestFlight test on iPhone, including real photo, login, logout, account deletion, map, ranking and notification paths.

## Priority 2 — App Store safety and monetization
- [ ] Verify account-deletion request works end-to-end, including backend data and storage deletion where promised.
- [ ] Review privacy policy, age-rating questionnaire, user-generated-content moderation/report/block flows and exact location handling.
- [ ] Replace draft legal or monetization text with actual reviewed disclosures.
- [ ] Verify premium plan entitlement server-side and Apple in-app purchase / restore flow; do not treat UI-only plan as entitlement.
- [ ] Keep paid features disabled until the entitlement pathway has passed sandbox verification.
- [ ] Move gacha currency and rewards from device-local storage to a server-authoritative ledger before attaching any real monetary value. Current localStorage currency is editable and not fraud resistant.
- [ ] Confirm gacha probabilities are consistent with code and user-facing disclosures.
- [ ] Validate leaderboard opt-in, RLS, and privacy rules server-side; do not trust local claimed collection counts for competitive rankings.

## Priority 3 — Store listing
- [ ] Real app name, subtitle, description, keywords and copyright.
- [ ] Accurate screenshots from the running iOS app, icons, support URL and privacy-policy URL.
- [ ] App privacy responses covering SDKs and collected data.
- [ ] Age rating, content rights, reviewer login/demo account, review notes.
- [ ] Internal beta testing and issue resolution.

## Work policy
- Keep existing user posts, login identities and saved collection data; make additive changes and test migrations.
- Diagnose runtime errors rather than hide the error reporting mechanism.
- Label statuses: coded, deployed, verified on device, or approved by Apple — they are not equivalent.
- The owner uses iPhone only: prefer cloud build/remote macOS workflow when a complete native project exists; Xcode Cloud setup requires an Xcode project and access grants.

Official references:
- https://developer.apple.com/documentation/xcode/getting-started-with-xcode-cloud
- https://developer.apple.com/app-store/submitting/
- https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/
