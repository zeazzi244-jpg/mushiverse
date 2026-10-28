# App Privacy・外部通信の申告用棚卸し（2026-10-28、未申告）

対象はPR #2のソースと接続先の読み取り調査。実機通信、外部事業者の契約/保持期間、Appleへの回答は未確定。「データを収集しない」は選択できない。

|情報|確認した用途/送信先|申告候補・未確認点|
|---|---|---|
|メール/認証ID|Supabase Auth、ログイン・所有者の識別|連絡先情報/ユーザーID、アカウントに関連付け、アプリ機能|
|昆虫写真・メモ・種類・観察日・地域|Supabase投稿/Storage、公開記録・図鑑・交流|写真/ユーザーコンテンツ、アカウントに関連付け。地域は粗い位置情報の候補|
|AI判定用画像|`identify-insect-gemini` へ画像を送信し、配備済み関数がGoogle Gemini (`generativelanguage.googleapis.com`) のinline_dataを使用|写真、機能提供。Google側の保持/学習利用条件と同意表示を確認。AIを使わない写真投稿と区別|
|現在位置|ブラウザーの位置APIで地図上に現在地を描画|精密位置の端末利用と地図事業者へのタイル通信を実機で確認。DBにGPSを保存しないことだけで「収集なし」と判断しない|
|地図・住所検索|Esri `server.arcgisonline.com`、国土地理院 `msearch.gsi.go.jp`、OSM Nominatim `nominatim.openstreetmap.org`|IP・検索語・表示範囲が外部へ送られる。利用規約/クレジット、保持と収集区分を確認|
|いいね・コメント・フォロー・通報|Supabase、交流/迷惑行為の対応|ユーザーコンテンツ/製品操作、アカウントに関連付け。通報者情報を公開しない|
|購入・消費・返金台帳候補|Apple Server API、Supabase。現在ゲートOFF、未配備|購入履歴、ユーザーIDとの関連付け。取引IDの削除後保存期間/法的根拠を確定して公開ポリシーへ反映|
|端末内設定・無料ガチャ・下書き|localStorage/WebViewのサイトデータ|端末内保存とサーバー送信を区別。iPhoneでログアウト/削除時の挙動を確認|
|ログ/診断|Supabase/ホスティング/地図等のサーバーアクセス|IP・障害ログの保持と用途を確認。生JWS、秘密鍵、認証トークンをログへ出さない|

広告・他社横断追跡用SDKは今回のpackage.jsonには追加していない。依存一覧だけで「トラッキングなし」を確定せず、外部サービスの用途と実機通信を照合する。CapacitorのPrivacyInfo.xcprivacyは依存内に存在するが、最終Archive内の集約Privacy Report/Required Reason APIの確認は残る。WebのlocalStorageとネイティブUserDefaultsの申告を混同しない。

申告前に、所有者がApp Store Connect > App Privacyでデータ種別、収集目的、本人関連付け、トラッキングを上表と実機結果から回答する。公開プライバシー文面、アプリ内説明、Apple申告の3つを一致させる。現行privacy.htmlは草案のままであり正式公開済みとは扱わない。

参考: https://developer.apple.com/app-store/app-privacy-details/ ／ https://developer.apple.com/documentation/bundleresources/privacy_manifest_files
