# MUSHIVERSE iOS icon release handoff

Approved artwork: **MUSHIVERSE-AppIcon-1024.png** (1024 × 1024, opaque RGB, deep green background and white butterfly). Do not substitute or regenerate the approved artwork.

1. Copy the approved PNG to `assets/MUSHIVERSE-AppIcon-1024.png` in this repository.
2. If `ios/App/App.xcodeproj` is missing, run `npm run ios:add` once on a Mac with Xcode.
3. Run `npm run ios:prepare` (build web, sync Capacitor, install icon, validate project).
4. In Xcode, verify the `AppIcon` asset catalog, signing team, bundle ID `com.rikuto.mushiverse`, version/build number, and archive the app.
5. Upload the archive to App Store Connect/TestFlight and verify the icon in the installed build.

The installer deliberately fails when the approved PNG or native Xcode project is absent, rather than silently shipping an incorrect icon. Do not overwrite the production icon with a placeholder. This repository does not by itself prove that a TestFlight build has been uploaded.
