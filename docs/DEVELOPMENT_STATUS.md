# MUSHIVERSE 開発状況・共通引き継ぎ資料

更新日: 2026-10-29 / 作業先: [PR #2](https://github.com/zeazzi244-jpg/mushiverse/pull/2) — `codex/verified-changes-20261028`

このファイルをChatGPTと所有者の共通資料とする。各作業回で「開発内容・検証・進捗・未完了・本人操作」を更新する。コード、CIの対象SHA、本ファイルを正とし、以前のチャットや旧レポートの数字だけで完了を判断しない。

## 最新作業（2026-10-29：ガチャ・CI・iPhone表示）

- 引継ぎ開始SHA: `b8a906a`。`AGENTS.md` と本資料を確認し、`bbe11d8` の修正を維持した。
- 失敗CI [40864197919](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40864197919) は10件すべてを調査。8件は非表示ガチャボタンへの操作（bbe11d8で修正済み）、2件は初日報酬5コインへ変更後も600残高を期待していた旧テスト。500→505を確認するよう修正した。
- E2EのAuth/DBモックを共有化し、ガチャ試験が本番APIへ通信しない構成へ統一。再読込時にテスト財布を再初期化しないよう修正した。
- 読取不能な財布を空データとして保存し直さず、保存ロック/安全な整数範囲がない場合も受取・抽選を停止。既知でない旧カードやnull要素を次の保存時に削除しない。コイン/カード/採集記録の一括移行・消去は実施しない。
- ガチャ結果表示中の重複抽選を抑止、アカウント切替/終了時にタイマーとキー操作を解除。動きを減らす設定では結果を待たせない。
- ランキングの別タブ更新を反映し、旧アカウントの遅延した登録/取消結果を新アカウントへ表示しない。
- iPhone相当320×568、390×844、430×932、844×390で、ホーム/ガチャ/図鑑/プロフィール、10連結果とカード詳細の閉じ操作を試験。長い名前・入力欄・モーダルとセーフエリアのCSSを調整。
- AI昆虫JSONマスタ100種を本体図鑑に読み取り専用で接続。IDを正として所持表示/検索/レア度フィルターを実装し、従来の自然種カード/採集記録とは分離。画像は100件pending、承認0件、画像・抽選は未接続と明示。名前変更でID所持数を失わない。既存カードをAIカードに変換しない。

### 今回の検証・コミット

- 検証対象コード: `b70366fbc3827a6bbd8a255142ae0da129c3f408`。後続の結果記録コミットは本資料のみを更新。
- 単体: 78シナリオ成功（SQL親テストを含むNode集計79）。抽選関数の1,000区間を列挙しSSR1/SR19/R180/N800、チケットSSR0を確認。7日報酬 `[5,5,10,5,10,10,20]`、合計65。50/450は維持。
- Chromium: 全43件成功。保存安全性10件、iPhone相当/AI図鑑/演出6件、ランキング3件を含む。
- Chromium/WebKit CI: **86/86成功**。両ブラウザー各43件。ローカルWebKitはOS共有ライブラリ不足だったためCIで確認した。
- Web整合性・インラインJS61本・購入停止ゲート、ios:sync/ios:check成功。最新CIは5種類すべて成功（下記リンク）。
- 所有者確認済み: TestFlight v139インストール、単発50・10連450の実消費（再質問不要）。今回の変更はまだTestFlightへ送っていない。
- main、本番DB、App Store提出、課金ゲートは変更しない。公開進捗55%（11/20）を維持。

CI証跡:
- [Web 86件/単体/型/停止チェック](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40876092013)
- [iOS Simulatorビルド](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40876092026)
- [隔離課金統合](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40876092022)
- [署名設定事前検証](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40876092012)
- [AI昆虫マスタ検証](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40876092040)

残課題: AI画像100枚の検品/承認/登録、AIカード抽選との接続、Sandbox/返金・部分返金/照合・最終実機/申請。本人への新たな操作要求なし。

## 継続する条件

- mainへのマージ、本番DB/Edge Functionの変更、本番課金の有効化、App Store提出は行わない。
- 購入はネイティブ固定フラグとサーバーの独立ゲートで停止。Apple Sandbox・実機での確認前に解除しない。
- 本人はiPhoneのみ使用。ビルドはGitHub macOS CIを利用する。秘密鍵・パスワードをチャットやリポジトリへ貼らない。
- 本人操作がなくてもできるコード修正・モック/ローカルDB試験・CI確認は続ける。未確認を成功と記載しない。

## 確認済みの開発内容

採集記録・図鑑・週間クエストの描画、タブ内パネル、ガチャ保存/所持保持、プロフィール/下書きのアカウント分離、二重投稿/アップロード中の切替、公開プロフィールの遅延応答、非表示投稿の再表示、マップ競合、特殊名による辞書衝突を修正した。

Capacitor Xcodeプロジェクトと停止状態のStoreKit 2ショップを統合。ARM Macランナー不足をIntel指定で回避し、孤立していたSwiftソースの参照を修正した。Apple公式署名検証と最新取引取得、環境別台帳、認証/有効セッション照合、重複防止、RLS/権限制限のSQL候補を追加した。本番未適用。

## 過去のテスト結果・証跡（2026-10-28）

今回のソース検証対象: `9409972ffb80bda651ab1e36bd4c195ee1520283`。以下のCIを実行。証跡を記録する後続コミットは資料のみの変更。

|検証|結果/限界|
|---|---|
|Chromium/WebKit CI|32/32成功。Supabaseモックを使うブラウザー試験、実機ではない|
|単体/SQL/署名モック|64シナリオ成功（Node集計65はSQL親テストを含む）。PGlite台帳9、Appleポリシー15/購入HTTP13、消費API11/再試行5、通知6、Xcode参照2、署名3|
|隔離Supabase統合CI|8ステップ成功。実Auth/JWT/session_id/REST/RPC/Postgres 17を使用。Apple署名境界だけを注入し、有効なApple JWS・実配備Edge gatewayは未検証|
|同時実行|8件の同一購入、6件の同一draw再送、残高150に対する4件の50消費をHTTPから並行実行。付与1回、再送結果同一、3成功/1残高不足を確認|
|署名設定事前検証CI|既存ASC鍵のP-256形式、短寿命ES256署名、Apple認証、Bundle IDのアプリ参照を確認。`read_only_api_verified`。Provisioning・証明書・署名IPA・アップロードは未実施|
|Web/JS/Deno/構造|Webバンドル、61インラインJS、3関数と統合テストの型、停止ゲート、ios:sync/ios:check、全workflow YAML成功|
|iOS Simulator CI|未署名ビルド・Bundle ID・カメラ/位置/写真の3権限説明・成果物保存成功。署名IPA/実機検証とは別|
|URL|contact/privacy/termsの公開mainはHTTP 200。PRの新しい草案を公開したことにはならない|

- [今回のWeb CI: 成功](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40741493725)
- [今回のiOS Simulator CI: 成功](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40741493717)
- [隔離Supabase統合CI: 成功](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40741493880)
- [Apple署名設定の読み取り専用事前検証: 成功](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40741493942)
- 開始時に確認した `f9409303a1230bb4473396933dd366bffa2728f8`: [Web成功](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40719526147) / [Simulator成功](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40719526197)。今回の追加分の証拠には使用しない。

ローカルDockerはDBイメージのレイヤー領域不足で起動できず停止。GitHub CIの使い捨て環境で代替検証した。常設ホスト型ステージング/実機用URLは未作成。

再現: `npm ci` → `npm run verify:web` → `npm test` → `npm run test:e2e`（事前に `npx playwright install --with-deps chromium webkit`）。iOS: `npm run ios:sync && npm run ios:check`。実際のコンパイルはmacOS CI。

## 進捗率

**55%（公開ゲート20項目中11項目を確認済み）**。作業時間やコード量の完成率ではない。実機/ステージング/審査の証跡がない項目は加算しない。

|#|公開ゲート|状態|
|---|---|---|
|1|GitHub接続・ソース調査|確認済み|
|2|記録/図鑑/週間クエスト描画|回帰試験済み|
|3|タブ切替|回帰試験済み|
|4|プロフィール/アカウント切替|回帰試験済み|
|5|無料ガチャの保存・所持維持|回帰試験済み|
|6|固定依存・Web同梱バンドル|確認済み|
|7|台帳のローカルSQL試験|確認済み|
|8|Apple拒否ポリシー・停止ゲート|確認済み|
|9|Xcode/StoreKitソース統合|確認済み|
|10|macOSコンパイル|Simulator成功|
|11|カメラ/写真/地図/ログイン実機|未実施|
|12|ステージングDB/API統合|隔離CI課金統合8項目成功。常設環境/Storage/UGC/Edge gatewayは未確認|
|13|Apple商品・鍵・契約設定|ASC鍵/アプリ参照のみ確認。商品・契約・IAP鍵は未確認|
|14|Sandbox購入・再送・不正取引|未実施|
|15|購入コイン消費API/画面統合|停止状態の候補実装・ローカル試験済み。統合未確認|
|16|返金通知・消費後返金|停止状態の候補実装・ローカル試験済み。Sandbox未確認|
|17|通報/ブロック/削除の本番E2E|未実施|
|18|アイコン/プライバシー/申請情報|草案・テンプレートが残る|
|19|署名IPA/TestFlight|40864941075成功・所有者がiPhoneへv139インストール済み|
|20|最終実機検証・App Store申請|未実施|

## 今回の開発内容（第4回）

- 開始時に最新 `f9409303a1230bb4473396933dd366bffa2728f8` の [Web CI成功](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40719526147) と [iOS CI成功](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40719526197) を確認。修正が必要なCI失敗はなかった。
- 既存Supabaseは本番1件/開発ブランチなし/Freeと確認。本番は読み取り調査のみ。追加料金の同意なしにホスト型ステージングは作成していない。
- [隔離ローカル/CI検証環境](STAGING_RUNBOOK.md) と実Auth/JWT/RPC/Postgresの統合テストを追加。Apple境界のみ合成データ、課金ゲートは変更なし。CIの8ステップ成功を確認。
- 課金RPCアダプターを本体/統合テストで共有化。既存単体61シナリオと新規署名事前検証3件、Deno全関数/統合テスト型検証、Web停止チェック成功。
- 読み取り専用のiOS署名設定事前検証をPR CIへ追加し、既存ASC鍵で対象アプリのApple API参照成功。鍵の再登録は不要。署名IPA/Provisioning成功とは扱わない。
- [App Privacy棚卸し](APP_PRIVACY_INVENTORY.md)、[審査/実機/本人操作パケット](APP_REVIEW_CHECKLIST_JA.md) を追加。AI画像のGoogle Gemini送信を配備済みコードから確認し、privacy.html草案へ追記。

## 未完了・次の担当者が進めること

1. 課金のAuth/RPC/DB隔離統合8項目は成功。常設ステージングとEdge gateway/Storage/UIの統合は残る。部分返金・消費情報報告・定期照合/通知欠落回復と、購入カードの所持一覧/永続表示は未完成。CIの並行HTTP試験は成功したが、実運用の負荷/削除とのロック競合/タイムアウト試験は残る。
2. ステージングで認証/セッション/RPC/Storage/Apple通信を統合検証する。既存の旧台帳は自動移行しない。
3. Sandboxの有効な署名、OCSP、各商品購入、再配信、期限切れ認証、アカウント切替、返金/取消を実機で確認する。
4. 通報/ブロック/アカウント削除、未使用画像の清掃、レート制限、複数DB接続の競合、台帳監視/照合を検証する。
5. 署名・TestFlightアップロード手順、正式アイコン、App Privacy、運営者/年齢区分/審査アカウント/スクリーンショットを確定する。
6. 開発依存のCapacitor CLI/xcode/uuidの中程度のaudit指摘を追跡する。前回は本番ランタイム依存の指摘なし。

## 本人操作が必要な項目（まだ完了と確認していない）

- Apple Developer本人確認、契約・税務/銀行情報、App Store Connect権限の確認。
- Bundle ID `com.rikuto.mushiverse` とConsumable商品3種（100/550/1200コイン）の設定・価格・販売地域の確定。
- GitHubのASC API鍵3種は既存設定で認証/アプリ参照を確認済み、再登録・再送不要。別用途のApple IAP検証鍵/ルート証明書、Supabase Sandbox用Secretsは未確認。値をチャットへ送らない。
- TestFlight v139インストールと50/450消費は確認済み、再操作不要。カメラ/位置/写真/削除とSandbox購入/返金は未確認。
- 運営者、プライバシー/年齢区分、ストア申告、価格/返金方針の最終判断。

## 今回の読み取り監査

Supabase security advisorsはWARN 3件（モデレーターSECURITY DEFINER RPC 2件、漏洩パスワード保護OFF 1件）、INFO 4件（RLSポリシーなし）。対象RPCはauth.uid()とmoderator_accountsの所属確認・空search_pathを持ち、moderator_accountsはRLS有効/ポリシーなしで通常クライアントから昇格不可。警告を消すために本番権限は変更していない。漏洩パスワード保護/運用権限は公開前に別途確認する。

## 更新の記録

- 2026-10-28（第4回）: 最新CI成功を確認、隔離Supabase課金統合8項目成功、既存ASC鍵の参照権限確認、申請・Privacy資料を整備。常設ステージング未作成、本番/課金/マージ未変更。進捗50%を維持。
- 2026-10-28: 共通引き継ぎファイルを開始。過去の作業を統合し、確認済み50%と未確認項目を分離した。停止状態の消費/返金候補、CORSと再送保護、手動アップロード保護を追加し、検証対象SHAとCI証跡を記録。進捗50%を維持。

本人の操作手順は [申請パケットの本人手順](APP_REVIEW_CHECKLIST_JA.md#本人のiphoneで行う設定順序) にまとめた。常設ステージングを希望する場合は、利用組織と見積費用への同意を先に確認する。

過去の詳細: [第2回レビュー](PR2_REVIEW_ROUND2.md)、[Apple設定候補](APPLE_BACKEND_SETUP.md)、[申請原稿](APP_STORE_DRAFT_JA.md)。本ファイルの最新記録を優先する。

## 2026-10-29 AI昆虫ガチャ継続作業（開発ブランチ）

- 正式100種マスタのID・レア度配分・名前重複をコネクタで読み取り確認。名称4件の改名を反映済み。実在種との網羅的照合は未実施。
- `scripts/validate_ai_insect_catalog.cjs` を作成し、`package.json` の `npm test` に追加。専用GitHub Actions workflowも作成した。
- `ai-insect-gallery-preview.html` を作成（名前・ID検索、レア度絞り込み、iPhone対応）。本体の既存ガチャ画面には未統合。
- **検出・修正した不具合**: `scripts/build-web.mjs` が `docs/` を配布対象に含めず、プレビューの `fetch('./docs/ai_insect_catalog_v1.json')` がビルド後に404となる構成だった。公開可能な当該JSONのみ `www/docs/` にコピーするよう変更した。
- `scripts/verify-web.mjs` に図鑑プレビューHTMLとJSONの同梱・原本一致検査を追加した。
- 上記新規コミットに対するCI成功、実機、TestFlightは**未確認**。CIの旧成功を新規変更の成功証拠として流用しない。
- 本番サービス・main・購入ゲートは変更していない。画像100種は依然 `art_status: pending`。本番アセットは未登録。
- **進捗50%維持**（公開ゲート20件中確認済み10件）。今回の追加は公開ゲート11〜20の完了を証明しない。
- 次: 現ブランチのCI実行結果を確認し、カード画像の個別検品と登録、既存ガチャ画面への統合、Apple Sandbox・実機・署名IPAの確認。所有者の秘密情報をチャットに送らせない。

## 2026-10-29 継続：AI昆虫マスタの異常系検証

- `scripts/validate_ai_insect_catalog.cjs` を堅牢化。ID重複、欠番、異常なカード値、名前重複、レア度と範囲の不一致、レア度別件数、架空種フラグ、画像承認状態を検出。壊れたJSONやカード配列にも明示的に失敗する。
- `tests/ai-insect-catalog.test.mjs` に正常・ID重複・nullカード・レア度誤り・名前重複の5ケースを追加し、`npm test` に接続。
- 対象コミット `34f07cd4b3c6e8408b161d9a009e023c5d5722f3` のPRワークフロー実行一覧は取得結果0件。**新しいテストのCI成功は未確認**。既存の成功実績と混同しない。
- 本番/main/課金フラグ変更なし。公開ゲート50%（10/20）を維持。本人操作なし。

## 2026-10-29 図鑑のブラウザー自動試験追加

- `tests/e2e/ai-insect-gallery.spec.mjs` を新規作成。ChromiumとiPhoneサイズのWebKitで、100枚表示、N40/R30/SR20/SSR10のフィルター、正式名称とIDの検索、横スクロールの有無を検査する。
- テストは既存のPlaywright `testDir: tests/e2e` と `npm run test:e2e` で自動収集される。WebビルドにプレビューHTMLとJSONが含まれることが前提。
- 対象コミット `c0086f6a2f7629f720b3a563d6c3bc95a0e39d3f`。**CI実行結果と実機成功は未確認**。画像は未承認で、ガチャ本体統合も未完了。
- main/本番課金/DB変更なし。公開準備ゲートは引き続き10/20（50%）。

## 2026-10-29 ログイン報酬のSSR希少性調整

- 所有者の要望で、ログインボーナスにSSRカード・SSR確定券を設定しない仕様に変更。7日報酬を `[100,150,150,200,300,300,500]` コインに統一。旧チケット残高は削除しない。
- 旧ログイン報酬で配布した通常チケットを使う単発抽選からSSRを除外。コイン抽選のSSR排出率0.1%は維持。ログインコインを使ったガチャでSSRが当たる可能性は残るため、SSRの入手経路はコインガチャのみという区別。
- 画面の7日報酬と抽選確率説明、受取メッセージを同期。`tests/daily-ssr-policy.test.mjs` を `npm test` に追加。新テスト実行成功・CI成功は未確認。
- 既存所持SSRカードは削除しない。これは端末ローカルのベータガチャ仕様であり、正式な100種AI昆虫カタログへの統合・サーバー側の厳格な抽選は未完了。
- main/本番課金/DBは変更なし。公開ゲート10/20、50%維持。

## 2026-10-29 無料コイン経済の調整

- 所有者の要望で7日ログイン報酬を計1700コインから計65コインへ減額。新配列 `[5,5,10,5,10,10,20]`。ガチャ単発50コイン/10連450コインは維持。
- 採集クエストの初回撮影報酬**予定表示**を100→10コインに変更。審査待ちで自動付与しない既存の安全仕様は維持。週間クエストは元々コイン付与なし。
- `tests/daily-ssr-policy.test.mjs` の報酬検証を更新し、初回クエスト報酬と自動付与停止の静的検証を追加。CI/実機テスト結果は未確認。
- 既存ユーザーのローカル所持コインを没収・書き換えない。コイン販売は引き続き無効、課金設定と本番DBは変更なし。将来の収益性は実測が必要で、課金需要増加を保証しない。
- 公開準備ゲートは10/20（50%）維持。

## 2026-10-29 ガチャ支払い手段の明示

- 既存ベータの単発ガチャを「コインで1回（50）」と「チケットで1回（SSR対象外）」に分離。旧仕様ではチケットがあると自動消費され、SSRを狙うコイン抽選を選べなかった。
- コイン抽選のみSSR0.1%、チケット抽選はSSRなし。10連はコイン450。保有済みチケット・コイン・カードを削除せず、ユーザーが選んだ通貨だけを消費する実装へ変更。
- `tests/daily-ssr-policy.test.mjs` に選択ボタン・抽選経路の静的回帰チェックを追加。CI成功、iPhone実機の検証は未確認。サーバー側の不正対策・課金有効化とは別。
- 公開準備ゲート10/20（50%）維持。本番・main・課金ゲートは未変更。

## 2026-10-29 ガチャ回数の入力防御

- ローカルベータガチャの抽選処理で、1回・10連以外の回数とチケット10連を残高消費前に拒否するガードを追加。
- `tests/daily-ssr-policy.test.mjs` に不正回数ガードの静的回帰テストを追加。ソースコミット `3e23758bd8b6341c1eac0c0a9cb8e38b9150ffd2`。
- 新しいCI/実機検証は未確認。クライアントガードはサーバー台帳の不正対策の代替ではない。公開ゲート50%（10/20）維持。

## 2026-10-29 ガチャ・無料報酬のブラウザー回帰試験

- `tests/e2e/gacha-economy.spec.mjs` を追加。既存Playwright設定のChromium/WebKit双方で、初期ベータ財布をテスト用localStorageにセットし、コイン単発で50消費・チケット不消費、チケット単発で1枚消費・コイン不消費・SSR排出なし、10連で450消費・チケット不消費、初日ログイン5コインと同日二重受領不可を検証する設計。
- 追加テストはまだ実行成功を確認していない。失敗した場合はアプリ側の動作かテスト初期化の問題かを切り分けること。
- 現在のガチャ財布は端末ローカルのベータ版。課金販売やサーバー検証済みコイン残高の証明ではない。
- 本番/main変更なし。公開ゲート10/20（50%）を維持。

## 2026-10-29 iPhoneアップデート配布準備

- 所有者の依頼: 最新のムシバースをiPhoneにインストールできるようiOSビルドと配布準備を進める。
- `generate-ios-project.yml` の push対象に `codex/verified-changes-20261028` を追加。既存のmacOS Intel runnerで `npm ci`、Web同梱、Capacitor同期、構造検査、未署名Simulatorコンパイル、`.app`成果物アップロードを行う設計。workflow修正コミット `05fd81838b970086791a4e37f8770b28287a1838`。
- 既存の `ios-signed-archive.yml` は署名IPAエクスポートと、明示的に許可された場合だけTestFlightアップロードを行う手動workflow。現在は起動していない。ASC API読み取り専用事前検証は以前成功したが、署名用Provisioning・IPAは未確認。
- 上記コミットの `fetch_commit_workflow_runs` はPRイベントに限定された取得で0件。push-triggered iOS CIの成功/失敗はこの結果から判断できない。最新ソースのコンパイル成功・署名IPA・TestFlight配布は**未確認**。
- iPhoneインストールまでの残作業: 最新Simulator CIのログ確認、Apple署名/Provisioningの確認、署名IPAの生成、TestFlightアップロードとApple処理、実機インストール/動作確認。配布/本番公開は所有者承認と必要な検証後に実施。
- main/本番DB/課金ゲート変更なし。公開ゲート10/20、進捗50%維持。現時点で所有者の新たな操作は要求しない。

## 2026-10-29 v139実機・CI再確認

- 署名IPA/TestFlightアップロードは [GitHub Actions 40864941075](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40864941075) で全工程成功。所有者はiPhoneのTestFlightからv139へ更新済みと報告。
- 実機でガチャのコイン単発 98,850→98,800（50消費）、10連 98,800→98,350（450消費）を所有者が確認。チケット残高なし。これらを再質問しない。カード表示やカメラ・地図等の実機検証は未完了。
- 同SHA `9d2572e` のiOS Simulator、AI昆虫カタログ、隔離課金統合、署名事前検証は成功。一方 [Web CI 40864197919](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40864197919) のPlaywrightは失敗。ログに新規ガチャE2Eの非表示ボタンへのclickタイムアウト等を確認。
- `tests/e2e/gacha-economy.spec.mjs` でテスト開始時にガチャタブを開くよう修正。コードコミット `bbe11d8ae429abf29a16dab6d32e214f729bc54b`。この修正コミットのCI成功はまだ未確認。他のPlaywright失敗も引き続き調査が必要。
- 公開ゲート #19（署名IPA/TestFlight）を実行ログと所有者のインストール報告により確認済みへ更新。**進捗55%（11/20）**。#20最終実機検証/申請、#11カメラ・地図・ログイン等は未完了。本番DB、課金有効化、main、App Store提出は変更なし。
- 所有者の新たな操作なし。次は新CIのPlaywright結果を確認して残りの失敗を修正する。

## 2026-10-29 Codex一括修正の検証と次の配布判定

- Codexの修正対象コミット `f79ddb2` に対してGitHub Actionsの5系列を再照合。Web bundle integrity [40876926683](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40876926683)、iOS Simulator [40876926674](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40876926674)、隔離課金統合 [40876926681](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40876926681)、AIカタログ [40876926680](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40876926680)、iOS署名事前検証 [40876926714](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40876926714) はいずれも成功。
- Codexの作業報告は単体78シナリオ、ブラウザー86件、AI昆虫100種の本体図鑑統合、破損・旧カード保持の強化。上記CI成功は確認したが、新版のiPhone実機動作、画像承認、サーバー抽選、Apple Sandbox課金は未確認。
- iOS署名/配布workflow `.github/workflows/ios-signed-archive.yml` は `workflow_dispatch` 手動実行のみ。新しいコミットの署名IPA/TestFlight配信はまだ行っていない。既存TestFlight v139の実機成功を新版へ流用しない。
- 次の独立作業: 画像承認待ちを未完成として保ち、サーバー抽選/台帳境界とSandbox購入・返金を検証する。所有者操作なしで可能なCIとコード作業を優先する。署名配布には別途明示的なアップロード指定が必要。
- 進捗**55%（11/20）**を維持。`main`・本番DB・本番課金フラグ・App Store申請は変更なし。

## 2026-10-29 AI図鑑のランタイム整合性修正

- `assets/ai-insect-collection.mjs` の本体ランタイム読込で、同名カードを重複許容していた検証漏れを修正。ビルド時のマスタ検証と整合させ、重複名・空白名を拒否する。既存のユーザー所持データは読み取り専用で変更しない。
- `tests/ai-insect-integration.test.mjs` に重複名/空白名の拒否と正常マスタの保持を追加。ソース `6ea422f`、テスト `2554b0f`。新コミットのCI結果は未確認。旧 `f79ddb2` の5系列成功を新コミットの検証証拠にしない。
- 本番、main、課金停止ゲート、TestFlight配布は変更なし。画像未承認・Sandbox未検証のため**55%（11/20）**維持。次の独立作業はこの変更に対するCIと残存する公開ゲートの確認。

## 2026-10-29 AI図鑑の所持データ境界テスト

- `tests/ai-insect-integration.test.mjs` に、同じIDの複数所持カウント、架空100種外の旧カードID、null/数値/不正レコード、オブジェクト型財布、原本非破壊を検証する回帰試験を追加。コミット `5e11d250254387505942a796954616772b314fee`。
- 直前の `a77b0d` で AIカタログ検証 [40878494803](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40878494803) とiOS署名事前検証 [40878494720](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40878494720) の成功を確認。Web・iOS Simulator・隔離課金CIは確認時点で未完了。追加テストコミットのCIは未確認。
- 既存のカード/コインは変更なし。新規テスト以外のランタイム変更なし。公開準備**55%（11/20）**を維持。本番/課金/配布操作なし。

## 2026-10-29 破損ローカル保存のiPhoneブラウザ回帰テスト

- `tests/e2e/mobile-gacha.spec.mjs` に、AI図鑑のローカル保存JSONが壊れている場合、読み込みエラーを表示し、破損原本を消去せず、ベータ財布の500コインを維持するブラウザ回帰試験を追加。コミット `65c3e357a9ac9b37232c159f1621bad3d6052ca3`。
- 直前の `1bf3cbe` の [AIカタログCI 40878650363](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40878650363) と [署名事前検証 40878650258](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40878650258) は成功。Web/iOS Simulator/隔離課金は確認時点で進行中。この新テストのCI結果は未確認。
- 進捗55%（11/20）維持。TestFlight v139、本番データ、課金停止状態、mainは変更なし。

## 2026-10-29 公開リスク優先の継続修正

優先順位: (1) 所持データ保全/ガチャ整合性、(2) CI/WebKit/iOS、(3) 隔離課金・返金、(4) AI画像承認、(5) TestFlight/実機、(6) App Store申請。外部承認待ちの項目を完了扱いしない。

- AI図鑑の不正なID（null、数値、オブジェクト、欠番等）を拒否する回帰テストを `tests/ai-insect-integration.test.mjs` に追加。コミット `7328cfd`。
- `assets/ai-insect-collection.mjs` のID文字列処理で、数値等に対する `.slice()` 呼出しの例外を防ぎ、カタログ検証で拒否するよう修正。コミット `53fd931`。所持データや財布は変更しない。
- 変更前 `2e86503` の [Web CI 40878985383](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40878985383) はPlaywright実行中、[iOS CI 40878985394](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40878985394) は依存導入中、[隔離課金 40878985510](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40878985510) は使い捨て環境起動中と確認。AI検証 [40878985372](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40878985372) と署名事前検証 [40878985390](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40878985390) は成功。今回のコードコミットのCI成功は未確認。
- 新版のTestFlight配布、Apple Sandbox購入・返金、100画像の承認は未実施。main/本番/課金有効化/申請は変更なし。公開進捗 **55%（11/20）** 維持。本人操作は今回不要。

## 2026-10-30 優先CI完了判定

- 最新コードコミット `4e31f3d3ae1f4acce125435d9d59b53578cd5a0a` の5系列CIを再確認し、すべて完了・成功: [Web 40879309333](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40879309333)、[iOS Simulator 40879309255](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40879309255)、[iOS signing readiness 40879309125](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40879309125)、[isolated billing 40879309066](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40879309066)、[AI catalog 40879309057](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40879309057)。
- 優先順位(2)「当該開発コミットのWeb/iOS自動CI成功確認」は完了。これは新しい署名IPAのTestFlight配布、Apple Sandboxでの実購入・返金、100画像の承認、実機のカメラ/位置/ログイン検証を意味しない。
- 進捗 **55%（11/20）** 維持。main・本番DB・課金ゲート・App Store申請は変更なし。未完了の優先作業はサーバー側の安全な抽選・台帳境界、Sandbox購入/返金、画像承認、TestFlight新版配布/実機、審査項目。
