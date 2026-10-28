# 申請・実機確認パケット（未提出）

App Store原稿は [APP_STORE_DRAFT_JA.md](APP_STORE_DRAFT_JA.md)、データ申告は [APP_PRIVACY_INVENTORY.md](APP_PRIVACY_INVENTORY.md)、進捗の正は [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md)。本資料は申請許可ではない。

## App Store Connectへの転記候補

- 名前: ムシバース - 昆虫採集の記録
- サブタイトル: 身近な虫との出会いを、記録して共有
- キーワード: 昆虫,虫,採集,観察,図鑑,自然,写真,記録
- サポート: https://zeazzi244-jpg.github.io/mushiverse/contact.html
- プライバシー: https://zeazzi244-jpg.github.io/mushiverse/privacy.html
- 主言語: 日本語。カテゴリ候補: ライフスタイル/教育。年齢区分、権利、運営者、連絡先、配信国は本人が確定。
- 有料ガチャは停止中。説明文/スクリーンショットに「購入可能」と書かない。外部決済への誘導・Premiumの旧画面も実機で点検し、IAP審査を終えるまで販売機能を提出しない。

候補URLは現在の公開mainを指す。PR内の内容をそのまま公開済みと扱わず、マージ/公開の別途許可後に到達性と文面を再確認する。

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

## 本人のiPhoneで行う設定（順序）

1. Safariで developer.apple.com/account と appstoreconnect.apple.com を開き、Developer登録/本人確認と契約・税務/銀行情報の状態を確認。
2. App Store ConnectでBundle ID `com.rikuto.mushiverse` のアプリとConsumable商品 `mushiverse.coins.100` / `.550` / `.1200`、価格・地域を確認。
3. GitHubリポジトリ > Settings > Secrets and variables > Actionsで `ASC_KEY_ID`、`ASC_ISSUER_ID`、`ASC_API_KEY_P8_BASE64` を登録/確認。App Store Connect API用のP-256 p8をbase64にした値を使用し、チャットへ貼らない。Apple IAPサーバー検証用の鍵と用途を混同しない。
4. 自動の「iOS signing readiness」の結果を確認。未登録なら不足名が表示される。成功しても配布証明書/Provisioning/署名IPA成功ではない。公開ワークフローを実行する前に成果物・送信先と許可範囲を確認。
5. 配布準備完了後にTestFlightをiPhoneへ入れ、上記の実機確認を実施。現時点ではアップロード/申請は実行していない。
6. App Privacy、年齢区分、運営情報、正式アイコン、審査アカウントを確定する。Appleへの提出は別途許可後。
