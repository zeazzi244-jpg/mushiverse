# MUSHIVERSE iOS native setup (pre-build)
Status: configuration added; iOS project NOT generated, signed, built, or uploaded.

## Before generating iOS
1. Confirm the real **Bundle ID** in App Store Connect and replace `com.mushiverse.prototype` in `capacitor.config.json`. This is an explicit temporary placeholder, **not** a registered bundle identifier.
2. Verify Node.js 22+, Capacitor 8 and macOS with Xcode 26+ are available through a controlled Mac / remote Mac environment. An iPhone by itself cannot run Xcode.
3. Install dependencies: `npm install`.
4. Bundle current web files: `npm run build:web`.
5. Generate native project: `npm run ios:add`. **Commit generated ios project** after checking it locally.
6. Inspect network assumptions, login redirects, camera permissions, photos, current-location requests, safety workflows, and legal disclosures. WebKit behavior and deep links must be tested separately.
7. Open in Xcode, set Team + automatic signing, shared scheme, app icon and meaningful native capabilities. Test on iPhone.
8. Set up App Store Connect/Xcode Cloud only after the Xcode project exists; archive and upload to TestFlight.

## Technical caveats
- `www` is generated and should not be edited directly.
- Local JavaScript data is not secure storage for paid currency or authoritative rankings.
- Any third-party assets loaded at runtime can require an internet connection. The static bundle by itself does not guarantee offline operation.
- Do not enable premium payment or present TestFlight as complete before device validation.
- Apple review rule 4.2 requires utility beyond repackaged website; use real iOS features and provide a polished native experience.
- Add camera and photo access explanations to generated iOS Info.plist if required; permission strings must reflect actual functionality.
- Never commit API secrets, Apple certificates, provisioning profiles or private keys.

References:
https://capacitorjs.com/docs/ios
https://capacitorjs.com/docs/getting-started
https://developer.apple.com/documentation/xcode/setting-up-your-project-to-use-xcode-cloud
https://developer.apple.com/app-store/review/guidelines/
