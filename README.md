# MUSHIVERSE / ムシバース

昆虫採集SNSのWeb + Capacitor iOSアプリ。**App Store未公開・購入機能停止中**。

最新の調査、修正、残作業とiPhoneからの設定手順: [公開準備レポート](docs/RELEASE_STATUS_2026-10-28.md)。
[Apple検証の設定候補](docs/APPLE_BACKEND_SETUP.md) / [申請原稿](docs/APP_STORE_DRAFT_JA.md)。

Node.js 22.18以降（TypeScript型除去対応）または24、npmを使用する。

```sh
npm ci
npm run verify:web
npm test
npx playwright install --with-deps chromium webkit
npm run test:e2e
npm run ios:sync
npm run ios:check
```

Web配布物は `www/` に生成する。`index.html` を単体で直接配信する場合は同梱ライブラリが不足するため、ビルド出力を配布する。iOSの共有Xcodeプロジェクトは `ios/App/App.xcodeproj`。ローカルでのXcodeビルドにはmacOSが必要で、GitHub Actionsにもシミュレータ/署名アーカイブのワークフローを用意している。

Swiftの購入固定ゲートとEdge Functionのサーバーゲートは独立。どちらもSandbox、返金、権限、台帳、実機試験が済むまで解除しない。サービスキー/Apple秘密鍵をコミットしない。

既存の旧チェックリストに記載された本番設定や過去ビルドは、現在の完了証明ではない。SQL候補はステージングで本番との差異を確認してから適用する。
