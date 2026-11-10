# MUSHIVERSE 復帰用引き継ぎ
更新 2026-11-10 JST。一時的な開発休止に備えるチェックポイント。

## A. 概要
昆虫を発見・撮影・記録し、収集・交流できる冒険型アプリ。世界トップクラスの昆虫アプリを目指し、世界へ昆虫の魅力を伝える。App Store正式公開と月100万円以上の長期収益が目標。Web + Capacitor iOS、Bundle ID `com.rikuto.mushiverse`。ホーム・記録・ガチャ・図鑑・マップ・マイページの6タブ。日本語・英語、深緑と森の冒険デザインを優先。

## B. 開発状況
- AI昆虫100種は N40 / R30 / SR20 / SSR10。コインSSR 0.1%、チケットSSRなし。所持した架空カードのみイラストと枚数を表示。実在カードの追加登録は不要。撮影記録は別タブ。旧カードとコインの保存を維持。
- 2241の実機で単発50コインの消費とRギンハネチョウ1枚の反映を確認。2341の実機は未確認。収集率・TOP 50のAIカード集計、プロフィール遷移、演出と内蔵効果音は回帰・実機確認を残す。
- ホームの冒険UI、記録・採集クエスト、航空写真、マイページ、キッズモード、プレミアムは既存。公開前に中核導線・年齢設定・位置情報を最終確認。課金は停止ゲートを維持。
- 過去の白画面は原因未特定。CSS/JSの同梱検査とシミュレーター描画の検査あり。再現時はビルド番号・iOS・起動経路・端末ログを確認。ログイン維持と認証の失敗時の挙動は最終実機で確認。
- 今回、AI図鑑と抽選でカタログ読込を一本化。起動時の取得が一時失敗してもAI昆虫カードタブで再試行でき、成功すると抽選が有効になる。読込失敗時は残高を消費しない既存ガードを維持。

## C. GitHub
- 正本は [zeazzi244-jpg/mushiverse](https://github.com/zeazzi244-jpg/mushiverse)。旧候補は別リポジトリ。開始時main `7de561e722b98f5fd755a6b155cd90b6b2b5e89b`、作業ブランチ `codex/verified-changes-20261028`、開始時先端 `ca86e16f47a7986fb2b1a23da6db4b98a211fef8`。
- [PR #2](https://github.com/zeazzi244-jpg/mushiverse/pull/2) はopen・draft・未マージ、開始時は競合なし。最新のコミットIDとCIはPRで照合する。別端末の未保存変更は未確認。
- 2341のソース `ca86e16` で [Chromium/WebKit](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42745763349)、[iOS Simulator](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42745763384)、カタログ、署名事前検証、隔離課金、アカウント安全、リリーススクリプトが成功。詳細・エラー履歴は [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md)。

## D. iOS・公開
- [TestFlight 2341](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42749161027) は署名・IPA・Appleアップロード成功。Apple処理VALID、内部IN_BETA_TESTINGを確認。今回のカタログ再試行修正の新規配布は未実施。
- App Store審査は未提出。前回記録では下書き1741。App Store Connectのライブ状態は認証が必要で未確認。再開時に対象ビルド、審査状態、登録済みスクリーンショットを確認。
- 公開ポリシーURL・App Privacy（Geminiへの写真送信を含む）・地図利用権・審査用ログイン・最終実機・審査提出が残る。

## E. 優先順
1. 2341で起動、ログイン、6タブ、AIカード所持表示をまとめて確認。2241で済んだ単発消費の再試験は必要時のみ。
2. 公開ポリシー・App Privacy・地図利用権・審査アカウントを揃える。App Store Connectのアクセスが必要な作業を一度にまとめる。
3. AI収集率・ランキング・効果音を確認。未検証のオンライン集計と課金は、無料版公開の必須条件にしない。課金有効化は別途承認とSandbox検証後。
4. 本番候補を確定し、承認後に署名配布とApp Store審査提出。

## F. 再開手順
最初に [PR #2](https://github.com/zeazzi244-jpg/mushiverse/pull/2) の最新コミットとCI、iPhoneのTestFlightビルド番号を照合する。配布済み2341から、既に済んだ実機確認を除いてE-1を実施。新しいコミットがある場合はその差分と配布状況を先に確認する。CIは既存のpush/PR・手動設定で運用し、休止中の自動開発は前提にしない。署名情報は既存の保護された設定を使用し、リポジトリには保存しない。

## G. 運用方針
世界一の昆虫アプリと早期公開を目指す。AI主体で実装・検証し、iPhoneのみで管理できるようにする。本人への操作依頼は最小限にまとめ、済んだ作業は繰り返さない。未取得AIカードは非表示を標準とし、表示が必要ならシルエットのみ。実在昆虫カードは追加しない。課金・外部公開・審査提出は明示承認が必要。

## H. V8 復元地点と検証手順

- 作業ブランチは `codex/verified-changes-20261028`。V8の実装コミットは `77e22f918febd573d7c59ebef3058b7e0b9e6000`。最新の資料コミットはPRの先端を確認する。
- [復帰用バックアップ](https://github.com/zeazzi244-jpg/mushiverse/tree/backup/v8-20261110) はV8開始前の `b87088a502c55b8ab0c4d4f48db77d926a98be43` を固定。復元時はこのブランチから新規作業ブランチを切り、作業中のブランチを強制更新しない。
- V7のブラウザー・iOS Simulator・署名準備CIは成功。V8の変更で、起動時にAIカタログを読み込めなかった場合、ガチャタブの再選択または通信復帰で再試行する。図鑑タブでの再試行も使える。V8のCIは [PR #2](https://github.com/zeazzi244-jpg/mushiverse/pull/2/checks) で照合する。
- ローカルはCIと同じNodeバージョンをワークフローで確認し、`npm ci` → `npm test` → `npm run verify:web`。ブラウザー試験は `npx playwright install --with-deps chromium webkit` → `npm run test:e2e`。iOSプロジェクトは `npm run ios:sync` → `npm run ios:check`、コンパイルはGitHub ActionsのmacOSランナーを使用。iPhoneでの管理はActionsとTestFlightを使う。
- 署名は `iOS signed archive (manual)` を作業ブランチで実行。内部配布を明示承認された場合に `upload_to_testflight` を有効にする。証明書修復は既存署名で復旧できず、別途承認された場合に限る。アーカイブ・IPA出力・Apple処理・内部配布の各段階をログで確認する。
- 署名用GitHub Secretsの名前と用途のみを記載。 `ASC_KEY_ID` はApp Store Connect APIキーの識別子、`ASC_ISSUER_ID` は発行者の識別子、`ASC_API_KEY_P8_BASE64` はAPI署名用の秘密鍵。 `APPLE_TEAM_ID` は署名チーム指定用の環境変数。実値は保護設定で確認し、チャット・ファイル・ログへ転記しない。
- 審査への最短順は、実機でコールド起動・ログイン・6タブ・所持図鑑を確認 → ポリシーURL、App Privacy、地図利用権、審査用ログインを揃える → 承認済みの配布候補を選択 → 審査提出。過去の白画面は原因未特定、2341の実機動作とApp Store Connectの最新下書きは未確認。
