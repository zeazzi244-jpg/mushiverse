# 変更確認・再検証結果（2026-10-28）

対象コード: `3f83fcda3e6fded9b7e4954bf0751efa6f0906f7`。
新規ブランチ: `codex/verified-changes-20261028`。
比較先: GitHub main `14a0e7f213d3743a79b2d1b6da1d836eab61d5f3`。

未コミットのソース変更はなかったため、既存の修正コミットを新しいブランチに引き継ぎ、この検証記録を新規コミットした。mainと本番環境には反映しない。

## 確認した変更

採集記録・図鑑・クエストの描画、タブ切替、無料ガチャの所持保持/保存失敗時の復元、アカウント別プロフィール、マップの非同期競合修正。Capacitorプロジェクト、停止ゲート付きStoreKitショップ、Apple購入検証/台帳SQL候補、固定依存のWebバンドルと公開準備資料を含む。

## 合格した検証

|検証|結果|
|---|---|
|npm run verify:web|バンドル整合性・61本のインラインJS構文・課金停止条件すべて合格|
|npm test|Appleポリシー15ケース、Postgres台帳/残高/重複/権限試験1ケースすべて合格|
|Playwright Chromium ローカル再実行|6/6成功|
|対象コードのGitHub Actions Chromium/WebKit|12/12成功|
|npm run ios:check|構造・Swiftターゲット登録・権限説明・ブリッジ接続チェック合格|
|Deno check --no-config --node-modules-dir=manual|購入検証Edge Function型チェック合格|
|git diff --check|問題なし|

CI証跡: https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40703963648 （対象コードSHA一致、ログの `12 passed` を確認）。

## 未確認の範囲

macOSでのiOSコンパイルは未確認。古い実行はランナーのジョブが開始されずキャンセル、新しい実行は待機中だったため、コンパイル失敗/成功の証拠にはしない。署名・iPhone実機・Apple Sandbox・有効な購入の付与・返金・本番DB/Edge Function統合も未確認。

購入はネイティブ固定ゲートとサーバーの独立ゲートで無効を維持。今回のテスト合格を理由に有効化しない。PRはドラフトとし、これらを公開前の条件として残す。
