# MUSHIVERSE 開発状況（2026年11月21日）

## 配布と実装

対象は zeazzi244-jpg/mushiverse の main、Supabase mushi-log、com.rikuto.mushiverse。App Store Connect で 1.0.1 の配信準備完了と mushiverse.coins.100 の承認を確認した。次のテスト版のバージョンを 1.0.2 に設定した。実装コミットは 4f606a4392facb7bdf95ddcfdaf3a0c7aaaef2df。署名とアップロードの記録は GitHub Actions 実行 44896107145。

StoreKit の Environment を署名付き取引から取得し、Sandbox と Production に対応する決済処理を選択する。購入ガチャの再試行ボタンから新規抽選が始まるケースを修正した。所持カードと結果表示に使うカード画像フレームにレア度を重ねた。SSR は 0.1%。LR 在庫の有無に応じて内訳を表示する。

## 確認結果

- Node テスト 229 件成功。iOS 構成検査成功。カード画像 401 件を復号し、401 件の異なる RGB ハッシュを確認。
- mushi-log で apple_production_atomic_settlement_rollback.sql と paid_gacha_draw_idempotent_rollback.sql を実行。100 コインの加算、同一取引の二重付与防止、購入者照合、1 回 50 コインと 10 回 450 コインの減算、再送時の二重消費防止を確認。テスト取引はロールバックした。
- 本番販売停止。7 つのコイン商品設定のすべてで販売フラグが無効。今回の変更に伴う新規 DB マイグレーションと Edge Function デプロイはない。
- 月額・年額は内部カタログに存在するが Apple 商品 ID の接続が未完了。更新・失効・返金・復元の実取引検証が必要。
- 旧ビルドの iPhone Sandbox 結果は 1.0.2 の実機検証から区別する。1.0.2 の通信中断、復帰、アカウント切替、キッズモード、カード・シルエット表示と iPad の購入導線を確認してから審査へ提出する。
- SNS、冒険、クエスト、365 日の報酬、各種演出および全タブの実機検証は今回完了していない。

## 次の担当者へ

最初に main、配布ビルド番号、mushi-log の販売ゲートを再照合する。追加パックの候補価格は日本で 550 円と 1,200 円。商品登録と価格確認を済ませ、表示には StoreKit のローカライズ済み価格を使う。実機テストには通常残高と分離したテスト残高を使う。審査画像には当該ビルドのショップと 100 コインの価格が映った画面を使う。

審査メモ案（新ビルドの実機確認後、提出時の表示と照合）

Sign in with the review account supplied in App Review Information. Open ガチャ, tap Appleの商品情報を見る, and select the 100-coin product (mushiverse.coins.100). In the sandbox, the app displays the result against a separate test balance. If the transaction was interrupted, use 未完了の購入を再確認 to resume it.

App Store Connect で 1.0.2 (5641) のアップロード受領を確認。内部配布対象と実機テスト結果は独立して確認する。GitHub の課金回帰、Web バンドル検査、公開スクリプト検査、GitHub Pages へのデプロイは実装コミットで成功した。
