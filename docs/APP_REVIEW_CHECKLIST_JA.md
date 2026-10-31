# 申請・実機確認パケット（未提出）

App Store原稿は [APP_STORE_DRAFT_JA.md](APP_STORE_DRAFT_JA.md)、データ申告は [APP_PRIVACY_INVENTORY.md](APP_PRIVACY_INVENTORY.md)、進捗の正は [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md)。本資料は申請許可ではない。

## 最新の配布・本人確認（2026-10-31）
 
- TestFlight **1341** はApple処理VALID、内部テスト配布中。所有者から「更新しました」の報告を受領。インストール更新は確認済み、起動・カメラ・地図・ログインの合格とは分けて扱う。
- 無料機能の先行公開を優先する。有料コイン・有料ガチャ・広告の導入、AI画像100種の完成を先行公開の作業に混ぜない。購入ゲートはOFFのまま。
- 課金機能のSandbox購入/返金検証は将来の課金版に必要。無料版では購入が利用できないことを確認する。未検証の有料機能を利用可能な状態で提出しない。
- mainへのマージ/公開・本番DB変更・一般公開申請は現在の許可範囲外。本資料の準備は提出完了を意味しない。

## App Store Connectへの転記候補

- 名前: ムシバース - 昆虫採集の記録
- サブタイトル: 身近な虫との出会いを、記録して共有
- キーワード: 昆虫,虫,採集,観察,図鑑,自然,写真,記録
- サポート: https://zeazzi244-jpg.github.io/mushiverse/contact.html
- プライバシー: https://zeazzi244-jpg.github.io/mushiverse/privacy.html
- 主言語: 日本語。カテゴリ候補: ライフスタイル/教育。年齢区分、権利、運営者、連絡先、配信国は本人が確定。
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
|1|TestFlightで1341へ更新|所有者報告済み。繰り返さない|
|2|起動してホームが表示される|本人確認待ち|
|3|カメラ/写真選択/位置情報の許可・拒否で操作不能にならない|本人確認待ち|
|4|ログイン、既存記録・図鑑・無料ガチャ・地図の表示|1341の実機は未確認|
|5|専用テストアカウントで通報/ブロック/削除|未確認。本番所有者の削除をしない|
|6|最終ビルドのスクリーンショット、審査用アカウント、申請情報|未確定|
 
Apple Developer登録/署名/API鍵/Provisioningを最初からやり直す操作は不要。現在の署名鍵は暗号化artifactに90日保存、次の署名ビルドで更新される。長期保管とAPI鍵ローテーション時の移行はDEVELOPMENT_STATUS.md参照。
 
無料先行版の準備中に、有料コインの商品作成・価格設定・銀行口座設定を定例の本人手順として求めない。無料版を提出するために必要なApple契約/アカウント状態は別途確認する。
 
## 提出前に残る文面と運営判断
 
- mainのprivacy.html/terms.htmlをソースで再確認したところ「公開前確認用ドラフト」と表示されている。公開mainのprivacy.htmlはAI送信先の説明が未確定、PR内草案にはGoogle Geminiへの説明がある。URLが存在することと正式な文面の完成を混同しない。
- 運営者表示、外部サービスの取扱い、保持期間、通報対応体制を確定する。未確認の事実や対応期限は作らない。
- AI判定への写真送信の説明/同意、App Privacy、年齢区分、Kidsカテゴリの扱いを最終ビルドと照合する。
- Apple公式のUGC要件・アプリ内アカウント削除要件を確認。ソースやモックの存在だけで実機/本番の合格とはしない。
- 申請資料が揃ってから、App Store一般公開申請の具体的な最終内容を提示し、別途承認を得る。

公式参照（2026-10-31確認）:
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/
