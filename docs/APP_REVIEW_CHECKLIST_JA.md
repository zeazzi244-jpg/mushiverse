# 申請・実機確認パケット（未提出）

App Store原稿は [APP_STORE_DRAFT_JA.md](APP_STORE_DRAFT_JA.md)、データ申告は [APP_PRIVACY_INVENTORY.md](APP_PRIVACY_INVENTORY.md)、進捗の正は [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md)。本資料は申請許可ではない。

## 最新の配布・本人確認（2026-11-03）
 
- 最新TestFlight **1441** はApple処理VALID、内部テストIN_BETA_TESTINGを確認済み。写真選択表示・ホーム認証表示・ガチャ準備中案内の3修正を含む。1441の端末インストールと修正確認は本人報告待ち。
- 1341で確認済み: 起動/ホーム、撮影から写真プレビュー、航空写真/採集マーカー、現在地への移動、既存投稿1件の写真/内容保持、再起動後のログイン維持、アカウント削除入口。繰り返し確認を求めない。写真ライブラリ/権限拒否/新規投稿保存/新規ログイン/実際の削除とは区別する。
- 無料機能の先行公開を優先する。有料コイン・有料ガチャ・広告の導入、AI画像100種の完成を先行公開の作業に混ぜない。購入ゲートはOFFのまま。
- 課金機能のSandbox購入/返金検証は将来の課金版に必要。無料版では購入が利用できないことを確認する。未検証の有料機能を利用可能な状態で提出しない。
- mainへのマージ/公開・本番DB変更・一般公開申請は現在の許可範囲外。本資料の準備は提出完了を意味しない。

## App Store Connectへの転記候補

- 名前: ムシバース - 昆虫採集の記録
- サブタイトル: 身近な虫との出会いを、記録して共有
- キーワード: 昆虫,虫,採集,観察,図鑑,自然,写真,記録
- サポート: https://zeazzi244-jpg.github.io/mushiverse/contact.html
- プライバシー: https://zeazzi244-jpg.github.io/mushiverse/privacy.html
- 運営者表示: **ムシバース運営**（2026-11-02、所有者指定で確定）。
- 主言語: 日本語。カテゴリ候補: ライフスタイル/教育。年齢区分、権利、連絡先、配信国は本人が確定。
- 有料ガチャは停止中。説明文/スクリーンショットに「購入可能」と書かない。外部決済への誘導・Premiumの旧画面も実機で点検し、IAP審査を終えるまで販売機能を提出しない。

2026-10-28にcontact/privacy/termsのHTTP 200を確認。候補URLは現在の公開mainを指す。PR内の内容をそのまま公開済みと扱わず、マージ/公開の別途許可後に到達性と文面を再確認する。

## 審査メモ候補（英語、最終機能と一致させる）

MUSHIVERSE is a Japanese insect observation community. Users record photos, species, dates and regions, and browse a community encyclopedia and map. AI identification provides suggestions, not a guarantee of species or safety.

Purchases and paid draws are disabled in this build. Free collection features remain separate from purchased currency. No purchase is required to use the core observation features.

Please use the dedicated review account entered in App Review Information. Open the profile to access account deletion. On another user's post, open the details to report content or hide the author. These instructions must be validated on the final signed build before submission. No production deletion should be performed using the owner's account.

## テストアカウントとUGC

専用レビューアカウントと削除専用アカウントを用意する。パスワードはApp Store ConnectのApp Review Informationのみに入力し、GitHub/チャットへ記載しない。ログインできること、2FA/メール確認で審査が止まらないことを実機で確認する。審査用アカウントは不要な権限を持たせない。

|確認|合格の証拠|状態|
|---|---|---|
|通報|別アカウントから送信し運営側で1件だけ受信|未実施|
|ブロック|対象投稿/プロフィール/地図/ランキングの公開範囲を確認|実機未確認|
|削除|使い捨てアカウントの投稿/画像/Auth/セッションを確認、再ログイン不可|未実施|
|運営対応|連絡先、禁止事項、通報担当、対応期限、緊急時の停止手順|本人の運営判断が必要|
|子どもの安全|正確な位置/学校/個人情報を公開しない。Kidsカテゴリや年齢区分を画面表示だけで決めない|最終判断待ち|

## iPhoneスクリーンショット撮影表

TestFlightの最終ビルドをiPhoneで撮影。架空の安全な観察データを使い、個人メール・生息地点・Apple支払い画面を写さない。画像加工で未実装の機能を足さない。実機の対応サイズをAppleの最新仕様で確認する: https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/

1. みんなの発見（タイムライン）
2. 写真・種類・日付・地域を記録
3. 種類別の図鑑
4. 地域のマップ（自宅周辺は避ける）
5. 無料カードとクエスト（有料購入の宣伝はしない）
6. 自分の記録・プロフィール

## 署名後の実機確認順

1. カメラ/写真/位置情報を各「拒否→必要時のみ許可」で試し、停止/クラッシュしないことを確認。
2. ログイン→投稿→再起動→別アカウント→ログアウトで記録・下書きが混ざらないことを確認。
3. 記録/図鑑/ランキング/マップ/プロフィール/無料ガチャ/週間クエストを操作。
4. 機内モード、送信中の画面切替、連打、復帰時の再試行を確認。
5. 専用テストアカウントで通報/ブロック/削除を試す。本番所有者の削除はしない。
6. Sandbox専用構成が別途用意できた段階でApple購入/再配信/返金/取消を実機確認。本PRの固定停止ゲートは変更しない。

## 本人のiPhoneで行う確認（無料先行公開）
 
一度にすべての操作を求めず、失敗した箇所を修正してから次に進む。既存記録を消さない。
 
|順番|確認|現在の証拠|
|---|---|---|
|1|TestFlightで1441へ更新|配布中。本人の更新完了報告はまだない|
|2|1441の3修正を確認|ガチャ準備中案内、写真選択案内、ホームのログイン案内。1341での起動確認等は繰り返さない|
|3|写真ライブラリ・権限拒否・投稿保存|未確認。既存記録を消さず、公開する意図のない試験写真の投稿を求めない|
|4|通報/投稿者非表示|他ユーザーの投稿がないため実機保留。テスト用データによるブラウザー試験を追加。本番受信/運営対応とは区別|
|5|専用テストアカウントの削除|入口のみ確認済み。キャンセル/失敗時のデータ保持をモック検証。本番所有者の削除をしない|
|6|最終画像・審査アカウント・申告|候補画像受領済み、最終化前。Privacy/年齢区分/運営対応などの判断が残る|
 
Apple Developer登録/署名/API鍵/Provisioningを最初からやり直す操作は不要。現在の署名鍵は暗号化artifactに90日保存、次の署名ビルドで更新される。長期保管とAPI鍵ローテーション時の移行はDEVELOPMENT_STATUS.md参照。
 
無料先行版の準備中に、有料コインの商品作成・価格設定・銀行口座設定を定例の本人手順として求めない。無料版を提出するために必要なApple契約/アカウント状態は別途確認する。
 
## 提出前に残る文面と運営判断
 
- mainのprivacy.html/terms.htmlをソースで再確認したところ「公開前確認用ドラフト」と表示されている。公開mainのprivacy.htmlはAI送信先の説明が未確定、PR内草案にはGoogle Geminiへの説明がある。URLが存在することと正式な文面の完成を混同しない。
- 運営者表示は「ムシバース運営」に確定。外部サービスの取扱い、保持期間、通報対応体制は引き続き確定する。未確認の事実や対応期限は作らない。
- AI判定への写真送信の説明/同意、App Privacy、年齢区分、Kidsカテゴリの扱いを最終ビルドと照合する。
- Apple公式のUGC要件・アプリ内アカウント削除要件を確認。ソースやモックの存在だけで実機/本番の合格とはしない。
- 申請資料が揃ってから、App Store一般公開申請の具体的な最終内容を提示し、別途承認を得る。

公式参照（2026-10-31確認）:
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/


## 2026-11-03 こちらで完了した追加検証

- テスト対象SHA `8388c821792023466383eb4d3339b53f7e495367`。[Web CI 41595817806](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/41595817806)でChromium/WebKit各50件、合計100件成功。追加した5シナリオは両ブラウザーで成功。
- 追加対象: 通報取消/短すぎる理由の送信阻止、通報失敗後の投稿保持と再送payload、投稿者非表示の地図/図鑑への反映と再読込後の保持、削除の入力確認/最終確認取消で送信なし、削除失敗/未確定応答で保存データとログイン保持。
- 全外部通信を既存Playwright fixtureで遮断してモック応答。実際の運営キュー受信・本番RLS・Auth/Storage削除・実機インストール成功とは扱わない。アプリ本体コードの変更なし、再配布不要。1441を確認対象とする。

### 掲載候補画像の形式確認

|候補|実寸・形式|判断|
|---|---|---|
|ホーム IMG_5954.png|1284×2778、PNG/RGB、alphaなし|Face ID大画面枠の規格寸法。修正前の認証案内があるため最終採用保留|
|図鑑上部 IMG_5955.png|1284×2778、PNG/RGB、alphaなし|同規格寸法。最終候補|
|虫一覧 IMG_5956.jpeg|710×1536、JPEG/RGB|指定寸法に不足。最終撮影時に原寸画像を取得し、引き伸ばして完了扱いにしない|
|ガチャ IMG_5957.png|1284×2778、PNG/RGB、alphaなし|同規格寸法。修正前の準備中表示があるため最終採用保留|

Apple公式[スクリーンショット仕様](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)を2026-11-03に確認。1284×2778はiPhone with Face ID (large display)の受入寸法。最終登録時にデバイス枠と必要な表示サイズを確認する。iPad対応の場合の画像も別に必要で、iPhone画像だけで全プラットフォーム完了とは扱わない。私的な画像本体をGitHubへ追加していない。
