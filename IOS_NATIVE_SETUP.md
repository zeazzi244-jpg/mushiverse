> 最新の引き継ぎ状況は [2026-10-28公開準備レポート](docs/RELEASE_STATUS_2026-10-28.md) を参照。以下は過去の調査・計画を含み、現在の完了証明ではありません。

# MUSHIVERSE iOS release status and next actions

## Verified configuration
- App Store Connect app: ムシバース (iOS 1.0, previously observed as 提出準備中).
- Registered Bundle ID: `com.rikuto.mushiverse` in `capacitor.config.json`.
- Apple Developer Team ID is configured in the GitHub manual signing workflow.
- Unsigned iOS Simulator compilation previously passed in GitHub Actions; this is not an iPhone/TestFlight build.
- Generated iOS project is now committed under ios/App; CI syncs bundled web assets.
- Native camera, photo and when-in-use location privacy descriptions are added during GitHub Actions build. The simulator workflow checks that they survive into the built app.
- **No signed IPA, TestFlight distribution or App Store approval has been confirmed.**

## GitHub workflows
1. `.github/workflows/generate-ios-project.yml`: macOS, web bundle, native project generation, unsigned simulator compilation and privacy/Bundle ID checks. May run automatically on matching pushes.
2. `.github/workflows/ios-signing-preflight.yml`: manual credential presence/format verification; this does not test Apple authorization.
3. `.github/workflows/ios-signed-archive.yml`: manual signing/archive/IPA export. **Do not trigger before secrets are configured.** The workflow does not upload to TestFlight.

## Missing credentials — GitHub Actions repository secrets
- `ASC_KEY_ID`: App Store Connect API key identifier.
- `ASC_ISSUER_ID`: App Store Connect API issuer identifier.
- `ASC_API_KEY_P8_BASE64`: base64 of the original Apple .p8 API private-key file (encode locally, do not paste into GitHub source, issues or chat).
- The Team ID is already configured separately; no `APPLE_TEAM_ID` secret is required by the current workflows.

Generate the API key through App Store Connect account access settings with adequate roles. Set secrets only in GitHub repository Settings -> Secrets and variables -> Actions. Never commit private keys, certificates or provisioning profiles.

## Remaining critical work
1. Confirm fresh simulator build is green after privacy edits.
2. Provision App Store Connect credentials in repository Actions secrets; verify the GitHub repo owner/account and permissions. Then run preflight.
3. Run manual signed archive and fix signing/provisioning issues. Verify actual IPA output. This is not yet TestFlight distribution.
4. Add an approved App Store Connect upload mechanism or upload through a controlled Mac, and validate processing in TestFlight.
5. Test real iPhone capture, photos, map permission, auth, payments, offline/network states and notification behavior.
6. Review user generated content moderation, reporting/blocking, privacy policy, App Store metadata, and Apple IAP compliance before submission.

## Caveats
- An iPhone alone cannot operate Xcode. GitHub's macOS runner can compile/attempt automatic signing.
- Web frontend state is not authoritative for paid coin balances or ranked collection counts; these require server-side checks.
- Permission strings must match actual APIs and uses; having plist keys does not mean native access works.
- No task should be called finished merely because a workflow file exists.
