# MUSHIVERSE 開発状況・共通引き継ぎ資料

更新日: 2026-11-08 / 作業先: [PR #2](https://github.com/zeazzi244-jpg/mushiverse/pull/2) — `codex/verified-changes-20261028`

このファイルをChatGPTと所有者の共通資料とする。各作業回で「開発内容・検証・進捗・未完了・本人操作」を更新する。コード、CIの対象SHA、本ファイルを正とし、以前のチャットや旧レポートの数字だけで完了を判断しない。

## 現在の要点（2026-11-08）

- 最新配布: **TestFlight 2041**（Apple VALID・IN_BETA_TESTING、実機未確認）。1941（アイコン外周修正、Apple VALID・IN_BETA_TESTING、iPhoneでアイコン外周修正を確認）。1841は承認済み原本PNGと冒険UI。1741もApple VALID・IN_BETA_TESTINGを確認済み。前回の1541は、2026-11-06 19:51 JSTにApple VALID・IN_BETA_TESTINGを確認。削除成功後に別アカウントの端末データを消さない修正を含む。1541は所有者がiPhoneで起動できたと報告。本番delete-accountは11月8日にversion 2へ更新済み。過去の1441では、署名IPA/アップロード成功、Apple VALID・IN_BETA_TESTING確認済み。1441でガチャの準備中案内が消えたことを所有者が2026-11-06に確認。写真プレビューと「写真を選択しました」の正しい案内も所有者画像で確認。ホームも「まだフォロー中のユーザーはいません」と表示され、ログイン案内の不整合解消を実機確認。1441の3表示修正はすべて本人端末で確認済み。
- 1341で確認済み: 起動/ホーム、撮影とプレビュー、航空写真/採集マーカー、現在地移動、既存投稿1件の写真/内容保持、再起動後ログイン維持、削除入口。繰り返し要求しない。
- 過去の追加検証対象: `8388c821792023466383eb4d3339b53f7e495367`。ブラウザー100件・単体/型/Web整合性・Simulator・隔離課金・署名readiness・AIマスタCIすべて成功。変更はテスト/資料のみで、1441のアプリ本体を変更していない。
- 1441のガチャ/写真選択/ホーム認証案内の3表示修正の再確認は不要。次は無料先行公開の申請情報・掲載画像と実バックエンド確認の残課題を進める。その他の残り: 写真ライブラリ/拒否/投稿保存、UGCと削除の実バックエンド検証、Privacy/運営対応/審査アカウント/年齢区分/掲載画像など。一般公開申請は別途承認が必要。
- 公開ゲート **55%（11/20）**。main/本番DB/購入ゲート/一般公開申請は未変更。以下の過去記録の「未配布」「本人待ち」は当時の状態であり、この要点と末尾の最新記録を優先する。

## 過去の作業（2026-10-29：ガチャ・CI・iPhone表示）

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
|11|カメラ/写真/地図/ログイン実機|1341/1441で一部確認済み。写真ライブラリ/拒否/投稿保存など残る|
|12|ステージングDB/API統合|隔離課金8項目と実Auth/Storage/通報/削除6項目成功。最小fixture。常設環境/配備Edge gateway/本番全体は未確認|
|13|Apple商品・鍵・契約設定|ASC鍵/アプリ参照のみ確認。商品・契約・IAP鍵は未確認|
|14|Sandbox購入・再送・不正取引|未実施|
|15|購入コイン消費API/画面統合|停止状態の候補実装・ローカル試験済み。統合未確認|
|16|返金通知・消費後返金|停止状態の候補実装・ローカル試験済み。Sandbox未確認|
|17|通報/ブロック/削除の本番E2E|未実施|
|18|アイコン/プライバシー/申請情報|草案・テンプレートが残る|
|19|署名IPA/TestFlight|1541署名/アップロード/VALID・IN_BETA_TESTING成功。1541の起動を所有者が確認済み|
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

## 2026-10-30 Release blocker batch handoff

Priority batch for the next coding-agent run: (1) server-authoritative coin ledger and gacha draw transaction in isolated tests only, with idempotency, concurrency and insufficient-funds tests; (2) purchase/refund notification replay and account-bound entitlement tests with mocks; (3) account switch and corrupt-data E2E tests; (4) iOS camera, location and login smoke test coverage; (5) clear preflight report for pending artwork, Sandbox and TestFlight. Preserve existing balances, records and client behavior. Never enable production billing, alter production DB, merge main, upload TestFlight, or submit to Apple without separate authorization.

- New account-isolation browser regression is committed as `64f0266`; its CI remains partially running. For `64f0266`, [AI catalog 41052930869](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41052930869), [isolated billing 41052930815](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41052930815), [iOS signing readiness 41052930811](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41052930811) passed. [Web 41052930823](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41052930823) running; [iOS 41052930890](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41052930890) pending at observation time.
- Release readiness remains 55% (11/20). Coding-agent invocation is not available directly from this chat; this is a handoff plan, not a claim that an agent started work. No production changes or user actions.

## 2026-10-30 Billing fail-closed release assertions

- Updated `scripts/check_coin_release_gates.py` to verify both paid-draw and Apple-notification server feature gates require the exact string `true`, and that the paid-draw UI buttons remain disabled. Commit `34bd439`.
- Static checks guard against accidental source changes; they do not verify Apple Sandbox transactions or production configuration. CI for this new commit is not yet verified.
- Keep paid billing and draw gates off; no production data, main branch, TestFlight or App Store changes. Release readiness remains **55% (11/20)**. Pending: server purchase/refund Sandbox verification, artwork approval, new TestFlight device tests and App Store review. Owner action not required for this code change.

## 2026-10-31 iOS signed archive build-number hardening

- The latest previous source commit `9f8baed` passed all five CI workflows: [Web 41058241566](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41058241566), [isolated billing 41058241259](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41058241259), [AI catalog 41058241222](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41058241222), [signing readiness 41058241215](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41058241215), [iOS project 41058241214](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41058241214).
- Added `scripts/set-signed-build-number.mjs` and inserted it into the manual signed-IPA workflow before archive. Signed CI archives now derive a unique build number from GitHub run number and attempt, above previous TestFlight v139; both Xcode build configurations must be updated or the job fails. Source commits `2fdcd7e`, `12b201c`.
- Added `tests/signed-build-number.test.mjs` covering previous version, retry uniqueness, invalid run inputs and Xcode project shape; included in standard `npm test`. Commits `27a5ff4`, `d78e7df`. CI for this new code is not yet confirmed.
- No new signed IPA has been generated or uploaded by this session. No App Store submission, production database changes or paid-feature enablement. Progress **55% (11/20)** unchanged; user action not required for these code changes. Pending: staging server verification, Apple Sandbox purchase/refund, 100 art approvals, new TestFlight on-device verification, review metadata and submission.


## 2026-10-31 TestFlight優先引き継ぎ・署名失敗比較

- 所有者は本開発ブランチからTestFlightへのアップロードを明示許可済み。App Store申請、main、本番DB、課金有効化、証明書の失効・再発行は許可対象外。
- 対象SHA `34e4a88adcc28bb4af6b3037243d3ed01003c544` の最新5系列を確認: Web [41148531253](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41148531253)、Simulator [41148531260](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41148531260)、隔離課金 [41148531354](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41148531354)、署名事前検証 [41148531290](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41148531290)、AIマスタ [41148531336](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41148531336) は全て completed/success。今回の新規テスト実行ではなく、既存実行の結果確認。
- 失敗 [41149278654](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41149278654) のjob 124381656236と、v139成功 [40864941075](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/40864941075) のjob 123417218174の全文ログを比較。両方ともmacos-26、同じrunner image、Xcode 26.6、同じautomatic signingのarchive引数。成功時は「Apple Development: Created via API」とTeam Provisioning Profileで署名、IPA export/uploadとも成功。
- 今回は生成・構造チェック・ビルド番号1041割当まで成功。Archive署名準備で「既存のApple Development証明書の秘密鍵がキーチェーンにない。新規作成には既存証明書の失効が必要」とXcodeが明示。続いてDevelopment profileなし。IPA/export/uploadはskipped。1041は配布済みビルドではない。
- 現workflowはASC API鍵のみを渡し、署名用p12/秘密鍵の永続保存・復元がない。新しい使い捨てrunnerに以前の秘密鍵が引き継がれない構成とログは整合するが、秘密鍵バックアップの外部有無は未確認。API鍵の認証成功だけでは署名用秘密鍵の存在を証明しない。
- リポジトリtreeの署名関連ファイルに別のp12復元手順は見つからない。秘密鍵をソースへ格納しない。既存証明書を無断で失効・再発行せず、既存鍵の安全な復元経路を確認後にworkflow修正方針を決める。旧IPAの再アップロードでは最新版配布を満たさない。
- ブラウザーはGitHub未サインイン。GitHub連携は読取/ソース変更が可能だが新規workflow_dispatchは未提供。新規起動と署名Secretsのメタデータ確認にはブラウザー認証が必要。Secrets値は読取・表示しない。
- 今回はコード/workflow変更なし、再実行なし、新署名IPAなし、Apple processing/インストール可否は未確認。公開進捗55%（11/20）維持。次はブラウザー認証、既存署名鍵の復元可否確認、必要な場合のみ証明書操作の理由・影響と承認を具体化する。


## 2026-10-31 署名証明書の読み取り診断

- GitHubブラウザーで所有者 `zeazzi244-jpg` のサインイン完了を確認。Actions設定ではRepository secretsは既存ASC API鍵3項目のみ、Environment secretsなし。署名用p12やそのパスワードの登録はない。外部バックアップの不存在までは断定しない。
- `scripts/inspect-apple-certificates.mjs` を追加し、既存署名事前検証からGET-onlyでApple証明書一覧を取得。証明書ID・種類・有効期限・公開証明書のSHA-1のみを出力し、秘密鍵・JWT・証明書本文は出力しない。作成/失効/Provisioning/アップロード操作はない。コードSHA `cc1c6f547e2c4bdeda4d49c834e8d1c79c5b7bc7`。
- ローカルNodeの注入モック試験（GETのみ・空一覧・403・不正レスポンス拒否）は成功。実Apple読み取りCI [41153746526](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41153746526) はcompleted/success。AIマスタ [41153746471](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41153746471) 成功。新SHAのWeb [41153746678](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41153746678) は確認時点で実行中、Simulator [41153746473](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41153746473) と隔離課金 [41153746534](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41153746534) はpending。全系列成功とはまだ扱わない。
- AppleはDevelopment証明書6件を返却（一覧の続きなし）。v139署名時の公開証明書SHA-1 `6A9813ED76F204FB17385A5972E5D2EBB41E4B0B` と一致するIDは **`3WMVSRYMNU`**、期限2027-10-29。証明書自体の期限切れではない。失敗ログにある秘密鍵不在との切り分けができた。
- 所有者承認が必要な具体的候補: このDevelopment証明書1件のみの失効・再作成と、次回runnerで再利用するための秘密鍵の安全な永続化。既存API鍵3項目、他5証明書、main、本番DB、購入ゲート、App Store申請は対象外。該当証明書に依存する開発用署名/プロファイルは更新が必要となる可能性がある。承認前に証明書操作を実施しない。
- 本回は新しい署名IPAとTestFlightアップロード未実施。公開進捗55%（11/20）維持。Apple Developerブラウザーは追加サインインが必要だったため、所有者操作を増やさず上記CIの読み取りAPIで証明書照合を完了した。


## 2026-10-31 ビルド1341：署名修復・TestFlight内部配布確認

- 所有者から対象証明書1件の失効・再発行・秘密鍵の安全な保存の明示承認を受領。修復 [41154139237](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41154139237) で旧Development証明書 `3WMVSRYMNU` のID/種別/SHA-1を照合してから失効し、後継 **`X9J25MBR3L`**（SHA-1 `2C770434CF69BEC159243E0D87FBA23451279AF6`）を1件作成。他5件は維持。証明書一覧による事後照合済み。
- 新しいRSA秘密鍵をrunnerで生成し、100,000回反復・高エントロピーパスワード付きPKCS12としてActions artifact `mushiverse-signing-identity` に保存。パスワードは既存ASC秘密鍵から用途を分けて導出し、ソース/ログに記録しない。同一ブランチ・同一手動workflowのartifactのみ復元。復元・一時キーチェーンへの取込・秘密鍵利用を後続runで確認。macOS取込用コピーのみ互換形式に変換し、平文の一時ファイルを削除。
- **保存の限界**: artifact保存期間は90日、各署名runで更新。永久保存ではない。90日以上ビルドしない場合、artifact削除、ASC秘密鍵のローテーション時には別途安全なバックアップ/移行が必要。秘密鍵をリポジトリへ格納していない。
- 最初の修復runはPKCS12のmacOS取込で停止したが暗号化バックアップ保存は成功。次の [41154322571](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41154322571) では復元成功、証明書指紋の直接指定とAutomatic signingの競合を検出。`CODE_SIGN_IDENTITY=Apple Development` に修正し、それ以降は同じ鍵を再利用しており失効・再発行を繰り返していない。
- 配布ソースSHA **`38195a3a5ee63466aa3b4e29582324fb59fe1ef7`**。手動run [41154574673](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41154574673) は指定ブランチ、`upload_to_testflight=true`、`repair_approved_certificate=false` で実行。**ビルド1341**の署名Archive・IPA export・IPA artifact保存・altoolアップロードはすべて成功。`UPLOAD SUCCEEDED with no errors`、Delivery UUID `e21a3cbf-4202-4567-a48d-fa136d72d7b6`。
- 当該run全体の結論はfailure。ただし失敗はアップロード後の読み取り診断がbetaGroups APIで403を受けたためであり、IPA作成/アップロード失敗ではない。診断を修正して、配布グループ権限不足を処理失敗と混同せず、beta詳細を独立に記録するようにした。再アップロードはしていない。
- 読取CI [41155178021](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41155178021)（SHA `1db15084db93ea50e3149002eb61f0fc8adf4b2e`）が成功。2026-10-31 10:24 JSTに **build1341 / processingState=VALID / internalBuildState=IN_BETA_TESTING / autoNotifyEnabled=true / externalBuildState=READY_FOR_BETA_SUBMISSION** を確認。内部TestFlight配布可能、外部ベータ審査は未提出。個別グループ一覧はAPI権限不足で未確認。所有者のiPhoneでの最新版インストール/動作は未確認。
- 配布SHAの5系列CIは全成功: [Web/単体/型/ブラウザー90件 41154524353](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41154524353)、[Simulator 41154524381](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41154524381)、[隔離課金 41154524354](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41154524354)、[署名事前検証 41154524407](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41154524407)、[AIマスタ 41154524379](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41154524379)。ローカルNodeモックでJWT署名/120秒寿命・別証明書拒否・DELETE限定ID・HTTP拒否、workflow YAMLを検証済み。診断修正後のSHAではreadiness成功、他系列は確認時点で実行中。診断以外のアプリソースは配布SHAから変更していない。
- 本人の次の操作はTestFlightでムシバースを開き **1341へ更新**、その後カメラ/位置/ログイン等の実機確認。v139のインストールは再質問しない。公開ゲート#19の最新版配布証跡を更新、最終実機/審査は残るため進捗 **55%（11/20）維持**。main・本番DB・課金ゲート・App Store一般公開申請は変更なし。


## 2026-10-31 所有者の1341更新報告・無料公開の準備順整理

- 所有者が「更新しました」と報告。直前に案内したTestFlight1341への更新完了として記録。起動/ホーム/カメラ/位置/ログイン/既存データ保持まで確認したとは扱わない。
- 作業開始SHA `7060e92263deace8dfc376fc7e3cffe170fd3724` の5系列CIはすべてcompleted/success: [Web 41155262540](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41155262540)、[Simulator 41155262649](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41155262649)、[readiness 41155262442](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41155262442)、[隔離課金 41155262488](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41155262488)、[AI 41155262507](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41155262507)。
- APP_REVIEW_CHECKLIST_JA.mdの古い「TestFlight未アップロード」「署名未確認」「先に有料商品設定」という手順を現状に合わせて整理。無料版の実機確認/UGC/Privacy/申請資料を先行し、販売開始やSandbox購入・返金は将来の課金版に分離。古い総合ゲートを勝手に合格へ変更しない。
- mainのcontact.html/privacy.html/terms.htmlを読取。連絡先あり、privacy/termsは依然正式公開前の草案。mainのprivacyはAI送信先説明が未確定、開発ブランチのprivacyにはGemini記載あり。運営者/保持期間/外部送信の確定と正式版の公開は残る。mainや公開設定は変更しない。
- Apple公式Review Guidelinesと5.1.1(v)を再確認。UGCの通報/ブロック/運営対応とアプリ内アカウント削除は無料先行版でも確認する。利用者の既存アカウントを削除して試験しない。
- 今回は文書のみの変更。テスト追加やIPAの再作成は不要。次の本人確認は1341起動時のホーム表示、その後カメラ/地図/ログイン。一般公開申請は引き続き別途承認後。進捗55%（11/20）維持。


## 2026-10-31 ビルド1341の起動確認

- 所有者が起動/ホーム表示の確認依頼に「問題ありません」と回答。1341の起動とホーム表示を実機確認済みとして記録。カメラ/位置/ログイン/通報/削除まで合格と拡張しない。
- 次は記録画面のカメラで撮影とプレビュー表示を確認。確認だけで写真を公開する必要はない。既存記録は削除しない。
- 文書のみ変更、追加ビルド/テストなし。main/本番DB/課金/公開申請は変更なし。総合ゲート#11は残るため55%（11/20）維持。


## 2026-10-31 1341実機：撮影・プレビューと写真選択ラベル修正

- 所有者の2枚の画面でiOSカメラの撮影確認画面と、アプリ記録フォームへ戻った写真プレビューを確認。撮影/戻り/プレビューは確認済み。投稿保存・写真選択ライブラリ・許可拒否・位置情報は未確認。画像の内容はソースや公開資料へ転載しない。
- プレビューがあるのに「写真はまだ選ばれていません」が残る不整合を発見。core onchangeは処理前にclearPhotoでinput.valueを空にするため、後段mvKidPhotoScriptのchangeリスナーが空のfilesを見て誤表示していた。
- コミット `9497bad654d412706f5eaf3f14e10ed9eeb68364` でcore処理に写真ステータス更新を集約。準備中/選択成功/解除/読み込み失敗を反映し、空のinputに依存する後段リスナーを削除。写真送信先・投稿処理・既存データは変更しない。
- Nodeで実際のハンドラーを抽出して入力欄が空になる挙動をモックし、選択成功・解除・画像失敗・非同期処理取消の4経路を確認、成功。新SHAのCIは未確認。1341にはまだこの修正は入っていない。新IPA/アップロード未実施、次の配布候補。
- 次はマップ表示の実機確認。室内の試験写真を投稿する必要はない。main/本番DB/課金/公開申請は変更なし。総合公開ゲート55%（11/20）を維持。


## 2026-10-31 1341実機：航空写真マップ表示

- 所有者の画面でマップタブ、航空写真タイル、4つの採集件数マーカー、ズーム操作入口、航空写真/通常地図の選択欄を確認。地図描画と記録マーカー表示を実機確認済みとする。実際のズーム操作・地図切替・現在地取得/拒否の挙動までは確認済みとしない。
- 次は「現在地を地図に表示」から使用中の位置許可と現在地への移動を本人端末で確認。正確な現在地のスクリーンショット送信は求めない。本人によるローカル確認のみでよい。
- 文書のみ更新。main/本番DB/課金/公開申請は変更なし。#11の位置/ログイン等が残るため進捗55%（11/20）維持。


## 2026-10-31 1341実機：現在地への地図移動

- 「現在地を地図に表示」で現在地へ移動するかという確認に、所有者が「移動しました」と回答。本人端末で現在地取得と地図移動の成功を確認。位置座標や現在地スクリーンショットは取得していない。
- 起動/ホーム、撮影/写真プレビュー、航空写真マップ/記録マーカー、現在地移動まで確認済み。位置情報拒否の挙動、新規ログイン/再認証、投稿保存、UGC/削除は未確認。次は既存投稿の写真・内容の保持確認。
- 文書のみ変更。main/本番DB/課金/公開申請は変更なし。総合ゲート#11の未確認項目が残るため55%（11/20）維持。


## 2026-10-31 1341実機：既存投稿の保持

- 過去の投稿1件を開いて写真・内容が残っているかという確認に、所有者が「残っている」と回答。更新後の既存投稿の写真/内容保持を本人確認済みとする。全件比較や新規投稿保存まで確認したとは扱わない。
- 次はアプリを閉じて開き直した際のログイン状態と既存記録の保持を確認。ログアウトやアカウント削除は求めない。
- 写真選択表示の修正SHA `9497bad654d412706f5eaf3f14e10ed9eeb68364` のCI照合結果:
- Generate iOS Xcode project: completed/cancelled; https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41160370827
- iOS signing readiness: completed/success; https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41160370804
- AI insect catalog validation: completed/success; https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41160370766
- Isolated billing integration: completed/cancelled; https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41160370779
- Web bundle integrity: completed/success; https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41160370783
- Generate iOS Xcode project: completed/success; https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41160364737
- 1341には写真選択表示の修正は未配布。文書以外の追加変更なし。main/本番DB/課金/公開申請は変更なし。進捗55%（11/20）維持。


## 2026-10-31 1341実機：再起動後の認証維持

- アプリを完全に閉じて開き直す確認に、所有者が「ログインされたままです」と回答。再起動後のセッション維持を本人確認済み。新規ログイン/再認証や再起動後の全記録保持まで拡張しない。
- 現在の実機確認済み: 起動/ホーム、撮影/プレビュー、航空写真マップ/採集マーカー、現在地移動、既存投稿1件の写真/内容保持、再起動後のログイン維持。
- 次は他ユーザーの投稿詳細の通報/ブロック入口の表示確認。実際の通報送信・ブロック実行・アカウント削除はこの確認で求めない。UGCのサーバー動作/削除専用アカウント試験は別途残る。
- 文書のみ更新、追加テスト/配布なし。main/本番DB/課金/公開申請は変更なし。進捗55%（11/20）維持。


## 2026-11-02 1341実機：削除入口とUGC確認の保留

- 所有者は他ユーザーの投稿がないため通報/ブロック入口を確認できないと報告。未確認のまま保留し、確認用の公開投稿や本番データ追加を求めない。
- マイページのアカウント削除入口について、所有者が「あります」と回答。入口の存在のみ確認済み。削除操作・Auth/投稿/Storageの削除・再ログイン不可までは未実施。所有者アカウントの削除を求めない。
- 今後の優先事項: 専用テスト環境/アカウントでUGCと削除の動作確認、写真表示修正の次回配布、公開ポリシーと運営者表記の確定、最終スクリーンショット/審査アカウント/申請情報。既存の実機確認を繰り返さない。
- 今回は文書のみ変更。コード・追加テスト・ビルド・App Store提出なし。main/本番DB/購入ゲート変更なし。進捗55%（11/20）維持。


## 2026-11-02 運営者の表示名を確定

- 公開文面の運営者名について所有者が「ムシバース運営」を指定する提案に「それでお願いします」と回答。表示名のみ確定し、開発ブランチのprivacy.html/terms.htmlとAPP_STORE_DRAFT_JA.md/APP_REVIEW_CHECKLIST_JA.mdへ反映。
- privacy/termsの表示名に付いていた「事業者情報は確認中」を除去。外部送信・保持期間等の未確定事項や草案表示は維持。正式公開やApple上の販売者名変更を実施したとは扱わない。
- 変更は表示文言/資料のみ。置換対象と変更後の文字列を照合。コード動作変更・テスト追加・IPA生成・配布なし。main/公開Web/本番DB/課金/Apple申請は変更なし。
- 変更コミット: privacy.html `a0719e15370658636b35937aa67ec69404a612a5`、terms.html `9e05c114f75d03227266bd586ee47ab3db56c28a`、docs/APP_STORE_DRAFT_JA.md `cdf5c187686182e781dd1633eb0598f98a3df834`、docs/APP_REVIEW_CHECKLIST_JA.md `cdf0dd7d746da1222baf54a2ba14b954e3ddf4d3`。
- 公開進捗55%（11/20）維持。残作業はUGC/削除の機能検証、写真表示修正の次回配布、Privacy内容の確定と申請情報・最終画像の準備。


## 2026-11-03 ホーム掲載候補とフォロー欄の初期化修正

- 所有者からホーム最上部の実機画像を受領。ユーザー名/コインHUDが表示される一方でフォロー欄に「ログインすると…」が残る不整合を確認。この画像は掲載確定ではなく確認候補。画像の私的な内容やファイルをリポジトリへ転載しない。
- 原因: mv110-follow-feedのinitが、HTMLにmv110FollowFeedが既にある場合returnし、既存パネルの更新ボタン接続/初回refresh/状態変更イベント接続を全て飛ばしていた。
- `a748aae003b55925c4720ef3f857f30a428b9630` で既存パネルの再利用と一度だけの初期化に修正。mushiverse:auth-changedで古いリクエストを無効化し表示をクリア、次のタスクでrefreshしてAuthコールバック中のDB呼出しを避ける。
- tests/follow-feed.test.mjsを追加（`83e3db9`）、npm testへ接続（コード対象 `1eff0c50a500962e8b91104d853911097b4e6a0e`）。実際のscriptを抽出するNodeモックで、既存パネルのボタン接続、初期未ログイン、認証復元後の空フォロー表示、アカウント変更時の旧エラー破棄、ログアウト表示を確認。全てローカル成功。今回の変更のCI成功はまだ未確認。
- 修正は開発ブランチのみ。1341には未反映、新しい署名IPA/配布/スクリーンショット再撮影はまだ行っていない。写真選択表示の既存修正も維持。
- 投稿/財布/コイン/本番DB/main/課金ゲート/Apple提出は変更なし。公開進捗55%（11/20）維持。掲載用画像の最終化は修正版の実機表示と配布確認後。


## 2026-11-03 ガチャ準備中表示の残留修正・配布準備

- 所有者が「ガチャを準備しています…」の表示が変わらないと報告。既存1341には今回の修正は未配布で、再操作は求めない。
- 原因: ガチャ本体をmv86GachaMountへ追加した後、初期案内のp要素を残していた。コード `fb0c214945d649e9b54330708590d4e5e3a9ae01` で案内に専用ID mv86GachaLoadingを付け、本体配置後に案内だけ削除。筐体イラストと操作部、財布/既存記録を保持。
- テスト対象 `c8156d1bd2ecdc6232e23a9662fe7286c9e0ed8a`。ローカルNodeモックで配置処理を2回実行し、案内削除/筐体保持/本体の重複なしを確認。E2Eに案内消失・準備中文字列なし・筐体表示の検査を追加。
- [Web CI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41477722098) はnpm test、型検査、verify:web成功、Chromium/WebKit E2E実行中。[Simulator](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41477722024) は実行中。署名readiness/隔離課金/AIマスタCIは同SHAで成功。完了結果は後続記録で確定する。
- 写真選択ステータスとフォロー欄初期化修正を含む次の署名IPAを準備。GitHubのブラウザ認証維持を確認。既存署名バックアップを使用し、証明書再発行入力はfalseとする。現時点では新しいIPA/アップロード成功を未確認。
- 公開進捗55%（11/20）維持。main/本番DB/購入ゲート/一般公開申請は変更なし。実機での修正確認と申請情報/Privacy/UGC・削除検証は残る。


## 2026-11-03 修正版1441の署名IPA・TestFlight送信成功

- 配布対象SHA `552bbce51ed4b5d7c9fbbcda65f71b98b6521123`（コード/テストはc8156d1、後続は資料のみ）。写真選択状態・ホームのフォロー欄初期化・ガチャの準備中案内残留の3修正を含む。
- コード対象c8156d1の[Web CI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41477722098)で単体/型/Web整合性/Chromium・WebKit E2E90件成功。配布SHAでも[Web](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41478444798)、[Simulator](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41478444810)、[隔離課金](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41478444576)、[署名readiness](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41478444615)、[AIマスタ](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41478444481)すべて成功。
- ブラウザから正しい開発ブランチ、upload_to_testflight=true、repair_approved_certificate=falseで[署名実行41478798524](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41478798524)を起動。既存41154574673の暗号化署名バックアップ復元成功。証明書の失効/再発行なし。署名archive、App Store配布用IPA export、artifact保存、altool送信すべて成功。
- ビルド番号 **1441**、Apple Delivery/build ID `daac739e-5ece-4b4d-ad87-9575bf14b03e`。2026-11-03 01:13 JST送信成功、01:17 JSTにprocessingState=VALID確認。autoNotifyEnabled=true、internalBuildState=READY_FOR_BETA_TESTING、externalBuildState=READY_FOR_BETA_SUBMISSION。グループ一覧は鍵権限403により未確認で、実機インストール可能・完了と断定しない。既存1341の実機確認と1441の修正確認は区別する。
- 次: 内部配布状態の反映確認、所有者がTestFlightで1441へ更新後にガチャ準備中案内/写真選択状態/ホームの認証表示を実機確認。インストール前の画面再操作は不要。
- 公開進捗55%（11/20）維持。main/本番DB/有料課金/一般公開申請は変更なし。Privacy/申請情報とUGC/削除の未確認項目は残る。


### 1441の内部配布状態を再確認（2026-11-03 01:18 JST）

- 資料のみ更新したSHA `4452fe7feb3907e03b5928ab9941bad165990bd4` の[読み取り専用readiness 41480196432](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41480196432)で1441/同build ID、processingState=VALID、internalBuildState=**IN_BETA_TESTING**、autoNotifyEnabled=trueを確認。1441は内部テスト配布中になった。外部はREADY_FOR_BETA_SUBMISSIONで一般公開/外部審査提出はしていない。
- グループ一覧APIは403のままだが、内部配布状態の確認は成功。所有者にはTestFlightのムシバースを1441へ更新する一手順を案内する。1441の端末へのインストール完了・3修正の実機成功はまだ未確認。
- 新規アップロードや証明書変更なし、追加のAppleログイン要求は不要。進捗55%（11/20）維持。


## 2026-11-03 続行：無料先行公開向けの安全試験と申請資料

- tests/e2e/community-safety.spec.mjsへ5シナリオを追加。通報取消/入力検査、送信失敗/再送、投稿者非表示の地図/図鑑/再読込反映、削除の取消時送信なし、削除失敗時データ/認証保持を確認。既存fixtureのpostUserIdを指定できるようにし、起動時から別投稿者の使い捨てデータを用意する。
- 初回はテストが非表示のloadMoreをクリックして3シナリオ×2ブラウザーで失敗。アプリの不具合ではなく試験の準備方法を修正。最終コードSHA `8388c821792023466383eb4d3339b53f7e495367` で再検証。
- `npm test`、型検査、`npm run verify:web`、`npm run test:e2e`、リリースscript構文/バンドル検査を[Web CI 41595817806](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41595817806)で成功。E2EはChromium50/WebKit50の**100/100成功**（追加10件を含む）。[Simulator](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41595817824)、[隔離課金](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41595817847)、[署名readiness](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41595817804)、[AIマスタ](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41595817800)も同SHAで成功。
- 1441は2026-11-03 16:16 JSTの読み取りCIで引き続きVALID・IN_BETA_TESTINGを確認。今回アプリ本体コードの変更、新IPA、再アップロードはなし。1441の実機成功を代替しない。
- APP_REVIEW_CHECKLIST_JA.mdを最新配布/既確認事項/保留事項へ更新。掲載候補4枚の寸法/形式/alpha有無をPillowで読み取り確認、Apple公式仕様と照合。3枚は1284×2778 PNG RGB、虫一覧は710×1536 JPEGのため最終原寸取得が必要。画像本体はGitHubに保存せず、加工/登録/公開は未実施。
- 本番API通信はPlaywrightで遮断しモック応答のみ使用。運営側の通報受信/本番RLS、実際のAuth/Storage削除、削除成功後の端末保存範囲、審査用アカウントは未確認。所有者アカウントの削除を求めない。
- 公開ゲート55%（11/20）維持。無料版に有料商品の設定/Sandbox購入を追加要求しない。main/本番DB/購入ゲート/一般公開提出は変更なし。本人の次の一手は1441でガチャ準備中案内の修正確認。


## 2026-11-06 1441実機：ガチャ準備中案内の解消

- 直前の「1441でガチャの準備中案内が消えたか」の問いに、所有者が「消えたよ」と回答。1441で当該表示修正を実機確認済みとする。抽選/コイン消費・写真選択/ホームの修正まで今回確認したとは扱わない。
- 次は記録フォームで写真を選択後、「写真はまだ選ばれていません」が残らないかを確認。投稿送信は不要。
- 文書のみ更新。コード変更/追加テスト/新IPA/再アップロードはなし。既存CI100件成功の証跡を維持。公開進捗55%（11/20）維持、残る実機/申請/UGC・削除等の項目を加算しない。
- main/本番DB/課金/一般公開申請は変更なし。


## 2026-11-06 1441実機：写真選択ステータスの整合

- 所有者の記録フォーム画像で、写真プレビューと「写真を選択しました」の表示が一致していることを確認。以前の「写真はまだ選ばれていません」が残る不具合の解消を実機確認済みとする。画像内容は公開資料/ソースへ転載しない。
- 撮影/ライブラリのどちらを経由したかは画像だけでは確定せず、ライブラリ権限/拒否/投稿保存やAI判定成功までは確認済みとしない。試験写真の投稿は不要。
- 次はホーム「フォロー中の新着採集」に、ログイン済みにもかかわらずログイン案内が残っていないかを確認。他ユーザー投稿や通報の実行は求めない。
- 文書のみ更新。コード/新テスト/IPA/アップロードなし。既存CI100件成功を維持。公開ゲート55%（11/20）は総合項目が未完了のため維持。main/本番DB/購入ゲート/一般公開申請は変更なし。


## 2026-11-06 1441実機：ホームの認証案内を確認・3表示修正完了

- 所有者のホーム画像で、ログイン済みHUDと「フォロー中の新着採集」欄の「まだフォロー中のユーザーはいません」が一致していることを確認。以前の「ログインすると…」の残留は解消済み。直前のマイページ画像でも未フォロー状態を確認したが、今回のホーム画像を当該修正の証拠とする。
- 1441に含めた3修正（ガチャの準備中案内、写真選択ステータス、ホームの認証案内）はすべて実機確認済み。フォロー相手の投稿表示、通報の本番受信等まで拡張しない。フォローや公開投稿の追加を本人へ求めない。
- 公開連絡先をcontact.htmlで再確認し、既にzeazzi244@gmail.comが明記されているため、メールアドレスの再提出は求めない。通報対応体制/保持期間などの未確定判断は別途残る。
- 文書のみ変更。新コード/追加試験/IPA/アップロードなし。既存100件成功のCI証跡を維持。3修正が実機確認済みでも、総合公開ゲートの未確認項目が残るため進捗55%（11/20）を維持。
- 残りは申請情報/Privacy/対象年齢/運営対応、最終掲載画像・審査アカウント、写真ライブラリ/拒否/投稿保存と実バックエンドの通報・削除検証。main/本番DB/課金/一般公開提出は変更なし。


## 2026-11-06 削除安全性の修正・実サービス隔離試験・TestFlight 1541

- 本番delete-account/submit-reportとFK/RLS/権限を読み取り確認。旧削除関数はStorage失敗を無視し、1,000件超/入れ子を処理せず、旧購入台帳の制限により写真/投稿の削除後にAuth削除が失敗し得る。[レビューと反映範囲](ACCOUNT_SAFETY_REVIEW.md)に候補/限界/旧コード参照を保存。
- サーバー候補は検証した本人のみ、旧購入参照を破壊前に確認し停止、Storageのページ送り/再帰/エラー検査、再一覧で並行追加を検出、Auth削除後だけdeleted=true。旧残高/購入記録を削除・移行しない。Storage/DB/Auth横断の原子性はなく、部分失敗・並行書込みの運営対応は残る。候補は未配備。
- 端末側index.htmlの削除成功処理を修正。全mushiverseキー消去をやめ、削除本人のプロフィール/下書き/無料ガチャの既知3キーだけ消去。別アカウント/ゲスト/旧データを保持し、応答待ち中に切り替えたアカウントをログアウトしない。
- ローカル: 候補単体10件と端末側5件成功。標準npm testへ追加。本人のアカウント/記録/写真の実削除はしていない。
- [隔離実連携CI 42203408405](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42203408405): SHA `7c93f8bffdd9c00dca3ff7343a7672c74e351e4f`。Deno型検査/候補単体10件と、実Auth/Storage/REST/Postgres最小FK/RLSの6ステップ成功、環境破棄成功。通報保存/なりすまし拒否/他者閲覧拒否、旧台帳の事前停止、Storage故障時保持、本人だけ削除/他者保持、再ログイン拒否を確認。Storage故障のみ注入。実配備Edge gateway/本番の全スキーマ/運営受信確認とは区別。
- [Web CI 42203969327](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42203969327): SHA `ad601874ce9e1cca00f2e055ff9e62ef6c235828`。npm test（上記15件を含む）/型/Web検証とChromium/WebKit **100/100成功**。後続の一部CIは資料更新に伴い取消されたため、全最新CI成功とは記載しない。
- [署名/配布 42204944777](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42204944777): ソースSHA `baac9c861bffdac10ad4252b331af0ec9004b5a2`（ad601以降は参照資料のみ）。正しい開発ブランチでupload_to_testflight=true、repair_approved_certificate=false。既存の暗号化署名identityを復元し、証明書の失効/再発行なし。Archive/IPA/アップロード成功、ビルド **1541**、Apple build ID `14aca9cf-c87e-4abc-ac51-86831be55560`。
- 2026-11-06 **19:51:01 JST**にApple processingState=VALID / internalBuildState=IN_BETA_TESTING / autoNotify=true。外部はREADY_FOR_BETA_SUBMISSION、betaGroups参照403は任意項目で未確認。内部TestFlight配布可能、1541は所有者がiPhoneで起動できたと報告。
- 1441の3表示修正はすべて実機確認済み。再操作を求めない。
- **次の承認対象**: 本番delete-accountの関数コード更新のみ。現行AGENTSでは本番サービス変更は禁止のため、具体的候補/試験/旧コードを揃えてから所有者へ承認を求める。既存記録の削除実行/DB構造変更/main/課金/一般公開申請は含めない。旧購入台帳があるアカウントの保持方針は別途未確定。
- 残る作業: 上記反映承認、配備gatewayの安全な検証、使い捨て専用アカウントによる最終UGC/削除、Privacy/保持方針/運営対応/審査アカウント/年齢区分/掲載画像、1541の端末確認。所有者の実アカウント削除を求めない。main/本番DB/本番関数/購入ゲート/一般公開申請は変更なし。
- 公開ゲート **55%（11/20）維持**。コード/隔離試験の追加だけでは、本番・実機・申請の未完了ゲートを完了にしない。


## 2026-11-07 無料版の掲載文案

- [App Store掲載文案](APP_STORE_DRAFT_JA.md)を1541の無料先行版に合わせた。採集クエストβの予定報酬を掲載から外し、無料カードと写真によるAI判定を明記。変更コミット `a3d2f4be3cd87d7c1b7b351a9a4be3b34daf70af`。
- GitHubのmainと開発ブランチのcontact/privacy/termsを読み取り比較。問い合わせページは同一。main側の規約・ポリシーは草案で、AI判定用画像の送信先は開発ブランチのプライバシー草案に記載。公開ページの反映は未実施。
- 資料のみの変更。アプリの検証対象・配布ビルドは前節の1541とCIを参照。追加のアプリ試験・再配布なし。公開ゲート55%（11/20）。次に必要な判断は本番delete-accountの関数コード更新の承認。一般公開申請は別途承認。


## 2026-11-08 本番反映

所有者の承認を受け、delete-account の関数コードを version 2 に更新。ACTIVE、verify_jwt=true、および配備済み2ファイルが隔離CI [42203408405](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42203408405) の対象 SHA `7c93f8bffdd9c00dca3ff7343a7672c74e351e4f` と一致することを反映後に確認。旧版の参照は [こちら](references/delete-account-live-v1.ts)。実アカウントへの削除リクエストは送っていない。本番での削除完走と通報の運営受信は未検証。旧購入台帳を持つアカウントの削除は事前に停止し、保持方針は未確定。

公開ゲートは **55%（11/20）**。関数配備と本番E2Eの確認は別。残りは本番の専用アカウント検証、1541での残りの機能確認、公開用ポリシーとストア情報の確定、一般公開申請の別途承認。今回の承認は関数コード更新のみ。


## TestFlight 1541のiPhone起動確認

所有者が更新後に「開けた」と報告。確認範囲は起動まで。写真ライブラリ、権限拒否、投稿保存などの残項目があるため、公開ゲート55%（11/20）を維持。


## 残り9ゲートのまとめ検証

所有者はiPhoneでの確認を最後にまとめる方針。実機で確認済みの起動・写真撮影・地図・ログイン維持を繰り返さない。公開ゲートは55%（11/20）。

|ゲート|完了判定に必要な証拠|
|---|---|
|11|署名版で写真ライブラリ、権限拒否、意図した投稿の保存。既に確認済みの動作は再試験しない|
|12|隔離CIの実Auth/Storage/REST結果に加え、配備済みEdge経由の検証結果|
|13–14|App Store Connectの契約・Sandbox商品・検証鍵の状態と、Sandboxでの購入・再送・拒否結果|
|15–16|本番の販売を有効にせず、Sandbox環境で消費の画面連携と返金・取消を検証|
|17|専用テストアカウントで通報・非表示・削除と運営側受信を検証|
|18|署名版のPrivacy manifest、配信ページのポリシー、掲載画像、審査アカウントと申告内容を照合|
|20|最終署名版の確認とApp Store Connectの申請結果|

次回署名ビルドのCIに、アーカイブ内のPrivacy manifestのAPI理由、収集カテゴリ数、追跡宣言を集計する手順を追加（`92a381798cb32c2d8f902c01858439fc1f37e1c9`）。YAMLを読み取り、manifestなしとバイナリplistの模擬アーカイブで当該手順をローカル実行済み。実際のmacOS署名CIとApple申告は未検証。1541のIPA成果物は1日保持のため現時点の成果物一覧にない。1541のApple配布結果は[元の署名実行](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42204944777)を参照。


### 署名版のPrivacy manifest集計を確認

[署名CI #15](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42430256227)を開発ブランチで実行。署名鍵を復元し、Archive・集計・IPAエクスポート成功。アップロードと証明書修復の入力はfalse。集計にはCapacitor/Cordovaの2ファイルが出力され、両方とも収集カテゴリ0、追跡宣言false、Required Reason API行なし。アプリ全体の収集区分はバックエンドと外部サービスも含めて棚卸しが必要。TestFlight確認対象は1541。Apple申告・Sandbox・本番専用アカウント検証・最終実機試験が残り、ゲートは55%（11/20）。


## App Store Connect 1.0申請下書き

所有者のApple認証後に、App Store ConnectのムシバースiOS 1.0へ日本語の販促文・説明・キーワード・サポートURL・著作権、英語の審査メモを保存。ビルド1541を選択し、公開方式を手動に設定。再読み込み後にビルド、掲載項目、手動設定が保存されていることを確認。アプリ一覧にApple Developer Program License Agreementの更新通知が表示され、提出にはAccount Holderのレビューと同意が必要。申請ステータスはPrepare for Submission。掲載画像・App Privacy・審査用ログイン情報・最終検証が残る。公開ゲート55%（11/20）。


## App Store Connect契約反映と基本情報

Apple Developer契約の同意日2026-11-08を所有者の画面で確認し、App Store Connectの契約更新通知が消えたことを確認。iOS 1.0の日本語サブタイトルと主カテゴリ「ライフスタイル」を設定。申請は未提出。掲載画像、権利・年齢区分、プライバシー、審査用ログイン、最終検証が残る。公開ゲート11/20。所有者は確認のたびに止めず完了まで継続し、端末確認をまとめるよう指示。


## Appleの提出前チェック結果

iOS 1.0で年齢区分質問票を入力し、Apple算定13+を保存。投稿・ソーシャル機能・コメント交流、継続ランキング、無料コインでのランダムカードを申告。AppleのAdd for Reviewは不足項目を表示し、提出されていない。必須はDynamic Island中型iPhone・13インチiPadの画像、Privacy Policy URLとApp Privacy、Content Rights、審査用ログインと連絡先。連絡先氏名は入力したが、電話・メールの検証エラーにより保存未確認。公開ゲート11/20。既存の本人ログインを審査用に転用しない。


## 2026-11-08 正式アイコンとTestFlight 1741

- 所有者が添付した深緑・白いチョウのJPEG（1022×1020）を1024×1024の不透明RGB PNGに変換し、iOSのAppIcon asset 1ファイルのみ差し替えた。PNGを再読込して形式・寸法を検証し、ローカルとGitHub blobのSHAが一致。ソースコミット `1704726dd685e2d49da18e2f0ef411dc15eac47e`。
- [署名CI #16](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42433076114)で既存署名を復元し、Archive、Privacy manifest集計、IPA作成、アップロード成功。Appleで **1741** のVALID・IN_BETA_TESTINGを09:16 JSTに確認。新アイコンの実機表示は未確認。
- 審査連絡先の氏名・メール・電話をApp Store Connectで保存し、再読み込み後の入力を確認。連絡先の値はGitHubに保存しない。住所は今回の連絡先フォームで求められていない。
- 停止理由：App Store Connectの下書きで旧ビルドの選択解除操作がタイムアウトし、1541のまま。提出必須のiPhone/iPad掲載画像、Privacy Policy URLとApp Privacy、Content Rights、審査専用ログインも残る。審査は未提出、公開ゲート11/20。
- 再開手順：フォームが読み込まれてから下書きのBuild欄で選択解除→1741を選択→保存・再読込確認。TestFlightの再アップロードや連絡先の再入力は不要。審査項目をまとめて埋め、AppleのAdd for Reviewで不足を再検証する。


### App Store Connectの審査対象を1741に更新

再ログイン後、ビルド行を画面内に表示してポインターを置くと解除ボタンが表示された。1541の関連付けを解除し、1741を選択・保存。Add for Reviewの再検証で、審査連絡先の不足は解消し、iPhone Dynamic Island中型と13インチiPad画像、Privacy Policy URL、App Privacy、Content Rights、審査用ログインのみが表示された。審査未提出。次回はビルドの再切替や連絡先再入力をせず、これらの不足項目から再開する。


### 1741のApp Privacy入力とポリシー改訂案

App Store ConnectのApp Privacyで、メール、概算位置、写真、その他の投稿内容、ユーザーID、製品操作の6項目を入力し、各項目をアプリ機能・アカウント関連付けあり・広告追跡目的なしとして下書き保存。6項目の用途表示を確認。外部サービスの保持・精密位置等の確認を残し、Publishは未実施。公開中mainのprivacy.htmlはAI送信先の記載がない草案。開発ブランチでGeminiの既存記載を保ち、プロフィール/フォロー、アプリ内削除と旧取引記録の例外、無料版広告なしを文面に反映（`8e6a730fe804286e61555dd969fa8155eedd3dc2`）。公開用ポリシーの確認・配信後にURL登録と申告公開。次は掲載画像、権利情報、審査用ログインと提出前チェック。審査未提出、公開ゲート11/20。アプリバイナリは1741のまま、コード試験や再配布は行っていない。


### iPhone・iPad掲載画像のCI撮影

開発ブランチで、実際のSimulatorアプリを起動して中型iPhoneと13インチiPadのPNGを撮るCI手順を追加（`b19bed638e4a4701b44e5ec764113ca83f6e5a02`）。YAML解析とbash構文をローカル検証。[Intel実行](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42438828097)ではコンパイルとSimulatorアプリ保存まで成功し、撮影は長引いたため後続実行でキャンセル。撮影をApple Siliconへ切り替え、7分の上限と起動ログを追加（`19a5b138c506e0c0a324d8dea2da349554cbfb19`）。[新実行](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42439470527)は確認時点で待機中。画像の取得・目視・寸法確認・App Store Connect登録は未完了。再開時は新実行の結果と撮影ログを確認し、候補画像があれば確認してアップロード。写真の作り直しや1741の再配布は不要。公開ゲート11/20。


### 所有者提供画像をApp Store Connectに登録

添付3点の実寸を確認。ホームPNGは1284×2778で、Media Managerが同寸法を許可するiPhone Face ID大画面枠に登録し、1/10件表示を確認。図鑑とマップのJPEGは710×1536のため規格枠に登録しなかった。必須のDynamic Island中型と13インチiPadは別枠として未確認。[Apple Silicon撮影](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42439470527)はSimulatorコンパイル成功・撮影中。残作業は成果物の確認と不足枠への登録、および他の提出必須項目。公開ゲート11/20。


### 必須のiPhone・iPad画像を登録

[Simulator CI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42439470527)が成功。成果物のゲスト状態ホームを目視し、iPhone 1206×2622とiPad 2064×2752を確認。元画像は全ピクセル不透明で、画面を変更せずRGB PNGに変換。App Store Connectの日本語Media Managerで中型Dynamic Island iPhoneと13インチiPadの必須枠へ各1枚登録し、各枠1/10件を確認。所有者提供の大画面iPhone画像も登録済み。配布対象1741の変更や再ビルドなし。残りはポリシー公開とURL、App Privacy公開、Content Rights、審査専用ログイン、提出前チェック。Content Rightsの調査ではアプリ内にEsriとOSMタイル・出典表示があることを確認したが、出典表示だけで利用権を確定していない。公開ゲート11/20、審査未提出。


### 画像登録後のApple提出前チェック

Add for Reviewを実行し、画像不足が表示されなくなったことを確認。残る必須項目はPrivacy Policy URL、App Privacyの公開、Content Rights、審査用ログインのユーザー名とパスワード。審査未提出。ソースではEsri World Imagery・OpenStreetMapタイルの利用と出典表示、Nominatim・国土地理院の検索先を確認。公式利用条件の取得は今回の検索で結果が返らず、利用権は未確定。ポリシー配信の既存PagesワークフローはmainのWeb一式を公開するため、ポリシー単独公開の承認と反映範囲を区別する。1741や画像を再登録せず、上記の残項目から再開。公開ゲート11/20。

## 2026-11-08 正式PNG・冒険UI・起動検証

- mainを基準に引き継ぎ資料・既存実装を確認。公開Pagesへの影響を避け、作業ブランチに反映した。PR #2は競合を検出。
- `abb0927` で承認済みRGB PNG（1024×1024）を `assets/MUSHIVERSE-AppIcon-1024.png` と既存のiOS AppIcon参照先に同一バイトで配置。6画面の冒険UIとWeb同梱検証を追加。既存66 script要素は変更していない。
- `1cd2164` と `51696ad` でホーム導線の回帰試験と作業ブランチ向けCIを追加。[Web CI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42452087808) はChromium/WebKit 102/102、インライン構文61本、単体・Web同梱・課金停止チェック成功。
- [Simulator CI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42451937611) はネイティブコンパイル成功。撮影画像を目視するとiPadは新ホーム、iPhoneは起動12秒後に白画面だった。従来のCIは撮影コマンド成功だけを確認していた。端末実機・歴史的事象との同一性・原因は未確認。
- `be9e1bc` / `edb314f` でSimulatorの描画待ち・白画面検出・失敗時のログ取得を追加。ワークフロー記述・画像読み込みコードのエラーを `47bd91c` / `b5b092c` で修正。[再検証](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42452902025) が成功。iPhone・iPadとも初回判定でホームを検出し、撮影結果を目視確認（iPhone 1206×2622、iPad 2064×2752）。アプリ本体は1841と同一。白画面は再現せず、初回の原因と物理端末での起動は未確認。
- [署名・TestFlight](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42452466758) は `51696ad` を対象にアップロード有効で実行。署名・IPA書き出し・アップロードに成功。Appleがビルド1841を `VALID` / `IN_BETA_TESTING` と判定。外部テストは `READY_FOR_BETA_SUBMISSION`。実機インストール未確認。
- 審査下書きは1741。残りは公開ポリシーURL、App Privacyの公開、コンテンツ権利確認、審査用アカウント、最終実機確認、提出承認。公開ゲート11/20。次は登録済みiPhoneで1841の初回起動と正式アイコンを確認。再現時は端末機種・iOS・更新直後かどうかを記録し、Simulatorの描画判定と照合する。

- 所有者のiPhoneホーム画面の画像で、MUSHIVERSEの深緑地・白いチョウの正式アイコンを確認。画像だけではビルド番号とアプリ内ホームの描画は未確認。公開ゲートの集計は維持。

- 所有者からiPhone実機でアプリ内ホームが開くことを確認。端末のビルド番号は未確認。アイコン外周の白い縁について、承認済みRGB PNG原本の上端・角に白系画素があることを確認。次の修正候補はチョウの図柄を保ち、深緑の背景を正方形の四辺まで延ばすこと。承認済み原本は維持。

## 2026-11-08 アイコン外周修正

- 所有者の承認に基づき、元のチョウの画素を保ち、背景の深緑を四辺に延長。1024×1024 RGB、四辺の最外12pxが緑であること、チョウを含む中央領域が原本とピクセル単位で一致することを検証。原本は前コミットに保管。素材とiOSアセットを同一blobで更新（`f15dfe3`）。
- [Web CI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42454008146) 成功。[Simulator](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42454008130) のiPhoneホーム画像を目視確認。iPadはSimulator OSのデータ移行待ちで撮影工程の7分制限に達し、起動確認未実施。
- [署名と配布](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42454088367) 成功。1941はApple `VALID` / `IN_BETA_TESTING`。所有者がiPhoneのホーム画面で白い縁が消えたことを確認。App Store審査下書きは1741、公開ゲート11/20。

## 2026-11-10 PR統合検証・AI写真送信の明示確認

- 40cb0f8でmainとの差分4ファイル・競合5箇所を解消。[リリースCI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42622598328)成功。PR #2は競合解消・ドラフト・未マージ。[Web CI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42622665616)は102/102、インライン構文61本確認。
- [Simulator CI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42622665500)はコンパイル成功。撮影工程でSimulator OSのデータ移行待ちと7分制限により失敗。bf8e223で撮影工程の上限を15分へ延長し、描画判定は維持。
- 7156a49でGoogle Geminiへ写真を送る前に日英の確認を追加。キャンセル時は送信・利用回数加算なし。画像変換中に写真またはアカウントが変わった場合も送信しない。Node VMで実ハンドラーを実行し、キャンセル・許可・写真差し替えの3ケースをモックで確認。最新CI・実通信・実機の結果は未確認。
- TestFlightは既存の1941、審査下書きは1741。新署名・再配布・main更新・本番変更・審査提出なし。公開ゲート55%（11/20）を維持。残りはポリシー確定と公開URL、App Privacy、地図利用権、審査用ログイン、最終実機確認。本人操作は今回なし。

## 2026-11-10 V6 リリース候補の検証・TestFlight

- PR #2は main 7de561e を基準に競合なし（mergeable=true）。ドラフト。mainへのマージ・本番変更・審査提出なし。
- ee7e70c: Playwrightに、Google Geminiへの送信キャンセル時の通信なし・手入力保持と、許可後の画像1件送信・候補反映の回帰検証を追加。[Web CI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42700678552)で実行。
- dc13d15: privacy.htmlの開発用草案に事前同意、キャンセル時の手入力、Geminiの適用条件へのリンクを追加。実運用のGemini契約・保持条件は未確認。ポリシー配信およびApp Privacy公開は未実施。
- dc13d15のリリーススクリプト、署名事前検証、AI図鑑、隔離課金とアカウント安全CIが成功。Web、Simulatorおよび[署名・内部配布](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42701199408)の最終結果は後続確認。署名修復フラグは無効。既存の配布確認済みは1941。
- 公開ゲート55%（11/20）。残りは公開ポリシーURL、App Privacy、地図利用権、審査用ログイン、最終実機、提出承認。審査下書きは1741。端末操作は次の配布結果後にまとめる。

### V6 検証と配布の結果

- [Web CI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42700771613) は dc13d15 でChromium/WebKit計104件・インライン構文61本成功。写真の送信同意の新規テストは両ブラウザー成功。6タブ・通信復帰・記録・ガチャ・図鑑・地図・プロフィールの既存回帰を含む。
- [Simulator撮影CI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42700417772) は7156a49のアプリをコンパイルし、iPhone 1206×2622とiPad 2064×2752のホーム描画を初回判定で検出。タイムアウト延長後の撮影成功。後続の[PRコンパイル](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42701337642)も成功。
- [署名・内部配布](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42701199408) はdc13d15で既存署名を使用。Archive・IPA・アップロード成功。Appleで2041のVALID・IN_BETA_TESTINGを11/10 06:25 JSTに確認。実機および実Gemini通信は未確認。
- 公開ゲート55%（11/20）。次の本人操作はTestFlightで2041へ更新し、起動と写真送信確認のキャンセル動作を1回確認。App Store下書き1741。ポリシーの公開・App Privacy公開・地図利用権・審査用ログイン・審査提出は残る。mainと本番設定に変更なし。

## 2026-11-10 起動用アセットの同梱検査

- [変更コミット](https://github.com/zeazzi244-jpg/mushiverse/commit/49143cbb9b29800c3837f99c26eb0ae176daefba) で、Webビルドの検証に冒険UIのCSS、SupabaseのJS、LeafletのJS/CSSの検査を追加。ファイル欠落、空ファイル、元ファイルとの不一致で失敗する。端末の過去の白画面の原因は未特定。
- ローカルで `node --check scripts/verify-web.mjs` と、正常な最小構成および4アセットの欠落・不一致8ケースを確認。実バンドルの検証はGitHub Actionsで確認する。
- 公開ゲート55%（11/20）。TestFlight 2041でのiPhone起動・写真送信キャンセルの確認と、審査準備の公開ポリシーURL、App Privacy、地図利用権、審査用ログインが残る。今回の変更はビルド時の検査のみで、新規配布は不要。

### iPhoneでの写真送信確認（2026-11-10）

- 所有者のiPhone画像で、記録画面・選択画像のプレビュー・Google Geminiへの写真送信前の日本語確認文とCancel/Okボタンの表示を確認。アプリは記録画面まで起動。画像内にビルド番号の表示はなく、Cancel押下後の画面や実送信は画像から確認できない。Cancel時の送信なし・手入力維持は既存のChromium/WebKit回帰試験で確認済み。
- 公開ゲートは55%（11/20）。本人に同じ確認画面の再撮影は求めない。

### AI判定の利用回数を送信開始時に加算（2026-11-10）

- `14de66f` で写真変換とアカウント・画像の再確認が完了してから利用回数を加算するよう変更。実ハンドラーを使ったローカルモックで、キャンセル・変換エラー・変換中の写真差し替えは加算も送信もせず、有効な写真は加算・送信を各1回行うことを確認。CIとTestFlightはこの変更について未確認。公開ゲート55%（11/20）。本人操作なし。残りは公開ポリシーURL、App Privacy、地図利用権、審査用ログインと審査提出。

### AI昆虫のカードアート初回4枚（2026-11-10）

- AI-001、AI-041、AI-071、AI-091のイラストを制作し、480×720 WebPを開発用図鑑に接続。ギャラリーJSの構文を確認。登録4/100、承認・本体図鑑・抽選接続・実機は未確認。公開ゲート55%（11/20）。

### AI昆虫イラスト8枚・アプリ内図鑑表示（2026-11-10）

- AI-002・042・072・092を制作。初回4枚と合わせ8/100枚をreview登録し、開発用ギャラリーと本体のAI昆虫図鑑へ接続。WebPは480×720。カタログ件数と両JSの構文を確認。実機・CI・抽選接続は未確認。既存カード・コインの保存処理に変更なし。公開ゲート55%（11/20）。

### AI昆虫アート登録 8/100（2026-11-10）

- 100枚が揃うと新しいカードを既存ガチャに接続。既存の残高・自然種カードを保持し、新カードはIDで結果画像と所持数を表示する。ガチャ関数を新旧プール×コイン/チケット各1000区間で検証し、SSRはコイン0.1%、チケット0%。構文確認済み。実機・TestFlightは未確認。公開ゲート55%（11/20）。

### AI昆虫アート登録 100/100（2026-11-10）

- 100枚が揃うと新しいカードを既存ガチャに接続。既存の残高・自然種カードを保持し、新カードはIDで結果画像と所持数を表示する。ガチャ関数を新旧プール×コイン/チケット各1000区間で検証し、SSRはコイン0.1%、チケット0%。構文確認済み。実機・TestFlightは未確認。公開ゲート55%（11/20）。

### AI昆虫100枚の検証

- 100枚のWebPを480×720で確認。SHA-256は100枚すべて異なり、一覧を目視確認した。開発ブランチではコイン・チケット抽選、結果画像、AI図鑑の所持表示へ接続済み。既存の自然種コレクションと残高は保持。
- 単体・カタログ検査成功。[ブラウザーCI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42726178233)はガチャ関連を含む105件成功。会員状態の取得失敗時に未定義のcurrentPlanを参照する1件が失敗したため0e018a3で修正。再検証結果は未確認。[iOS Simulatorビルド](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42726178523)成功。署名付きTestFlight配布と実機は未確認。公開ゲート55%（11/20）。

### AI昆虫100枚入り TestFlight 2141（2026-11-10）

- 所有者承認後に開発ブランチで署名ワークフローを実行。[実行ログ](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42736567119)で署名IPA・アップロード成功。10:38 JST時点でApple処理VALID、内部READY_FOR_BETA_TESTING、外部READY_FOR_BETA_SUBMISSION。App Store Connectのブラウザーは認証画面へ遷移したため内部グループ割当と実機インストールは未確認。審査提出なし。

### 図鑑を採集記録とAIカードに整理

- 旧ガチャの実在昆虫カード一覧を図鑑とガチャ画面から外し、図鑑上部のAI昆虫カードタブに100枚を表示。採集記録・旧保存データと残高を保持。AIカード読込前のガチャ操作はコイン・チケットを消費せず停止する。2141には未反映。

- 図鑑修正版はWeb CI成功。署名・TestFlightアップロード成功（ビルド2241、Apple処理VALID、内部IN_BETA_TESTING、実機未確認）。[署名CI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42743349620)

- 2241のiPhone実機でRギンハネチョウの所持1枚と50コイン消費を確認。AI図鑑は所持カードだけを描画する仕様へ変更。検索・レア度は所持カードに適用。0枚時と検索該当なしの案内を追加。2241には未反映。

### V7 一時的な開発休止のチェックポイント

- 2341はApple処理VALID・内部IN_BETA_TESTING、実機未確認。[配布](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42749161027)。
- AI図鑑とガチャのカタログ取得を一本化し、起動時に取得できなかった場合はタブの再操作で抽選も復旧するよう修正。モジュール構文確認済み。新しいCIはPRで追跡。公開ゲートの前回記録55%（11/20）を据え置き。本人操作は再開時の2341実機確認とApp Store Connectの残項目。
- 再開順と公開ゲートは [MUSHIVERSE_RETURN_HANDOFF.md](MUSHIVERSE_RETURN_HANDOFF.md)。

- 検証対象 `24e1500e681360ef68333b1b306639a73c48210d`。ローカルで起動時取得失敗、図鑑タブでの復旧、連打時の通信重複防止、SSRプール復元を確認。[Web CI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42754053157) は初回がブラウザーのインストール工程でキャンセルされたが、同じコミットの再実行で成功。[iOS Simulator](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42754053137)、AI図鑑、署名事前検証、隔離課金、アカウント安全、リリーススクリプトも成功。追記は資料のみ。

### V8 復元地点とガチャの再試行

- V7を `backup/v8-20261110`（`b87088a502c55b8ab0c4d4f48db77d926a98be43`）に保存。PR #2はドラフトのまま。追加・変更差分を代表的な鍵の形式で確認し一致なし。履歴全体の監査は未実施。
- `77e22f918febd573d7c59ebef3058b7e0b9e6000` でカタログ取得失敗からの復帰をガチャタブと通信復帰にも接続。対象モジュールと追加回帰試験はNode構文検査成功。ブラウザー・iOS結果は同じ変更を含むPR先端のCIで確認する。公開ゲート55%（11/20）据え置き。2341の次の配布・審査提出は未実施。
- [引き継ぎ](MUSHIVERSE_RETURN_HANDOFF.md)にビルド・テスト・署名設定名と復元手順を追記。

- V8検証対象 `f9804095f928ae11265b5785f3ba8b4b1310036f`。 [Web CI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42788692955) と [iOS Simulator](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42788693016) を含む全7件のCIが成功。初回カタログ取得失敗、抽選未成立時の残高保持、再選択後の抽選と50コイン消費をChromium・WebKitで確認。2341は署名・IPA・内部テスト中を確認済み。V8は未配布。追記は資料のみ。

### iOS配布前のカード同梱検査

- `910da1fd311e82898b4609da56429b884d9cc753` で、公開対象のカード画像をソースと配布用Webバンドルでバイト比較し、欠落・不一致ならカードIDを表示してビルド検査を失敗させる。AI図鑑モジュールも起動アセットの検査に含めた。Node構文と正常・不一致・欠落のローカル試験が成功。既存の配布はTestFlight 2341、公開ゲート55%（11/20）。残りの公開準備は [復帰用引き継ぎ](MUSHIVERSE_RETURN_HANDOFF.md) を参照。

### V10 CIのiOS同期と回帰検査

- 起動用ファイル照合を追加した後、既存のリリーススクリプトCIはWebのビルドのみでiOS同期を省いていた。CIを `npm run ios:sync` に切り替え、同期済みのiOS起動ページが変更された場合の拒否テストを追加した。[修正前のCI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42802802071)
- ローカルで `npm test`、`npm run verify:web`、`npm run test:release`、同期済みの `npm run ios:check` が成功。起動ページの意図的な変更も検出した。修正コミットのmacOS CI・署名・実機は別途確認する。
- 公開ゲートは前回の11/20（55%）を維持。最新候補の内部配布と実機起動、App Store Connectの登録内容と審査状態の確認が残る。

- 実装コミット `3851a9e894fd9fbfff073feb5c59102bf93c15d4` のリリースCI・iOS Simulatorは成功。[署名実行 #23](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42803214089) でIPAをアップロードし、2441のApple処理 `VALID`、内部状態 `READY_FOR_BETA_TESTING` を確認。グループ照会はHTTP 403で、割り当てと実機は未確認。ブラウザー結果は [Web CI](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42803055521) で追跡する。公開ゲートの再集計は実機と審査下書きの確認後。

### 冒険テーマの6タブと日替わり観察ヒント

- ホーム・記録・ガチャ・図鑑・マップ・マイページに共通の章番号を付け、各画面のヘッダー色を役割別に調整。ホームには端末の日付で切り替わる7種類の観察ヒントを追加した。日本語と英語に対応し、オフラインでも表示する。
- ローカルで単体テスト、Webバンドル検査とリリーステスト4件が成功。iPhoneでの見た目・動作は未確認。TestFlight 2441に含まれない追加変更として分離し、公開ゲートの集計には加えていない。

- 冒険ブランチで6画面の日本語・英語の見出しと説明、下部タブ名を見直し。ホームから記録とガチャに直接進める。Webバンドル検査とリリーステスト4件に合格。実機とTestFlightは未確認。

- 冒険ブランチのホームに「はじめての虫さがし」を追加。自分の読み込み済み観察記録にある異なる虫の名前を最大3種類まで数え、記録や図鑑へ案内する。既存記録も対象。キッズモードでは投稿への入口を隠す。Webバンドル検査・リリース4件と、ゲスト・初回・重複・達成・アカウント切替のローカル検証が成功。実機とTestFlightは未確認。

### 公開候補と冒険導線の横断確認

- 公開候補 `64b0c87` は [Chromium/WebKit 108件](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42804482674) と [iOS Simulator](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42804483001) を含む7ワークフロー成功。2441のApple処理は有効。内部グループ・実機・App Store Connect下書きは未確認。公開ゲートは11/20（55%）を維持。
- 冒険ブランチでホームの虫さがしから、自分の発見に絞った実在昆虫の図鑑へ直接遷移。既にAIカード図鑑を開いていても切り替え、ログアウト時に絞り込みを解除する。ホームからガチャへの期待値を回帰テストで更新し、図鑑遷移とログアウトのケースを追加。
- ローカルの `npm test`、`npm run verify:web`、`npm run test:release`（4件）、`npm run ios:sync` と `npm run ios:check` は成功。ローカルのブラウザー実行はダウンロードおよび実行環境の制約で開始できなかったため、冒険側のE2EとiOSコンパイルはGitHub Actionsで追跡する。
- 冒険PR #3 のiOS Simulator・リリース検査・署名準備は成功。ブラウザーCIの初回はUbuntu依存パッケージの取得中に10分で打ち切られたため、ジョブ上限を25分に延ばした。テストの合否は [PR #3](https://github.com/zeazzi244-jpg/mushiverse/pull/3/checks) で確認する。
### V12 公開候補の検査と低評価の予測

公開レビューは確認できなかった。以下は6タブの実装・既存CI・導線から見た予測。

| 画面 | 予測されるつまずき | 対応・次の検証 |
| --- | --- | --- |
| ホーム | 最初の行動が伝わりにくい、毎日開く理由が弱い | 記録とガチャの導線、日替わりヒントと虫さがしはPR #3。 |
| 記録 | 投稿範囲が心配、子どもが別導線から開ける | キッズ表示中は記録タブへの遷移と投稿処理をガード。 |
| ガチャ | 初入手と重複が同じに見える、購入可能か迷う | 初発見バッジを追加。課金停止と既存の排出・残高処理を検証。 |
| 図鑑 | 実在の発見とカードの区別がつきにくい | 別タブを維持し、個人の発見へ直接進む導線はPR #3。 |
| マップ | 小画面で操作しづらい、位置情報が心配 | キッズ表示中の地図遷移・位置取得をガード。配布用地図ファイルを絞る。 |
| マイページ | 設定が読みにくい、開発者向け表示が紛らわしい | 既存の開発表示の非表示を確認し、V11の読みやすさ改善を移植。 |

- ローカルで単体、Webバンドル・インライン構文・課金ゲート、リリース6件、Capacitor同期とアイコンを含む `npm run ios:prepare` が成功。ブラウザーにキッズ迂回と初発見バッジの回帰ケースを追加し、実行結果はPR #2で追跡する。
- 白画面はiPhoneでの再確認が必要。公開ゲートは前回の11/20（55%）を維持。最後に署名・Apple処理が確認できた2441は内部割り当て未確認。審査提出と正式公開は未確認。

- 冒険PRにオリジナルの32秒ループ「森のBGM」を追加。初期は無音で、ホームのボタンで再生・停止。バックグラウンドで一時停止し、選択中は復帰時に再生を試みる。音源は約160KBでアプリに同梱。Web検査、リリース6件、iOS同期・構造検査・音源照合、再生状態のローカル検証に合格。iPhoneでの聴感は未確認。

- 冒険PRのガチャを、筐体の登場・カプセル落下・レア度に応じた発光・結果見出しの順に更新。早送りと視覚効果の軽減を維持。筐体下の重複料金表示を削除し、販売準備中の購入情報を既定で折りたたんだ。残高・履歴と課金ゲートは維持。Web検査、単体、リリース6件、iOS同期後の構造検査が成功。iPhoneでの見た目・音とTestFlightは未確認。

### 予測レビューへの音声操作の改善
- 「BGMを止める場所が遠い」「再生に失敗しても状態がわからない」「素早いオン・オフで状態が戻る」を予測し、再生中の停止ボタン、読込・失敗の案内、古い再生失敗応答の無効化を追加。ガチャ演出中は停止ボタンを隠して結果操作を優先。Web検査・リリース6件と停止・応答競合・音源エラーのローカル検証が成功。iPhoneの聴感とTestFlight反映は未確認。

- 冒険ブランチの背景・カード・入力欄・下部ナビ・設定・図鑑・ガチャ筐体を深緑と黒緑へ統一。本文は明るい緑白、補足は淡い緑とし、地図ライブラリーの白い操作パネルの文字色は維持。Web検査とリリース6件を実施。iPhoneでの全画面の最終表示は未確認。

- 夜の配色を投稿カード・写真背景・図鑑タイル・プロフィール本文・統計・編集ボタンへ拡張。いいねとお気に入りの選択色、フォーカス枠、タップ反応と小画面の操作幅を調整。主要5組の文字と背景のコントラスト比は4.5以上。Web検査・リリース6件・iOS同期と構造検査に合格。全画面のiPhone表示、ネイティブ購入画面と地図タイルの配色は別途確認。
