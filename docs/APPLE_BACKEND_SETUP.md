# Appleコイン検証の設定候補

本番適用前の手順。現在の購入停止ゲートを解除する手順ではない。

## サーバー設定

Supabase Edge Functions Secretsでのみ管理する。フロントエンド・GitHubソースに設定しない。

|変数|内容|
|---|---|
|APPLE_COIN_CREDIT_ENABLED|未設定またはfalseを維持。検証前にtrueにしない|
|APPLE_IAP_ENVIRONMENT|SandboxまたはProduction。クライアント値を採用しない|
|APPLE_APP_ID|App Store Connectの数値Apple ID（Bundle IDではない）|
|APPLE_IAP_PRIVATE_KEY|Apple App Store Server APIの権限を持つ秘密鍵PEM|
|APPLE_IAP_KEY_ID|その鍵のID|
|APPLE_IAP_ISSUER_ID|Issuer ID|
|APPLE_ROOT_CERTIFICATES_BASE64_JSON|Apple公式PKIから取得したルートDER証明書をbase64化した文字列配列のJSON。端末から受け取ったx5cのルートを登録しない|
|SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY|Edge実行環境のみ。service-roleは端末に渡さない|

公式資料:
- https://github.com/apple/app-store-server-library-node
- https://www.apple.com/certificateauthority/
- https://developer.apple.com/documentation/appstoreserverapi/get-transaction-info
- https://supabase.com/docs/guides/functions/secrets

## ステージングからの順序

1. 本番スキーマと既存購入レコードを再調査。旧creditsにenvironmentがない点を解決する。環境不明の既存取引を自動でSandbox/Productionと決めない。
2. `supabase/sql/coin-wallet-v2.sql` をステージングに適用。関数はservice_role限定、一般ユーザーは自分のウォレット閲覧のみ。ローカルPostgres試験に加え、別接続で同時購入/同時ガチャを試験する。
3. 停止状態でEdge Functionをステージングへ配備し、認証なし401・停止時503・ウォレット不変を確認。
4. ステージング専用のSandboxビルド/サーバー構成を作る。本番の固定停止フラグは変更しない。
5. 有効なApple署名、証明書失効確認、正しい購入者UUIDでの付与を確認。異なるUUID・商品・Bundle ID・失効取引・偽署名では拒否。鍵/Apple通信障害でも残高不変。
6. ネット切断後の再送、Transaction.updatesとunfinishedによる二重配信、アカウント切替、期限切れJWTを試す。
7. 購入コイン消費API/UIと返金通知/照合ジョブを実装・検証。通知署名も公式ライブラリで検証し、返金済みの残高と消費済み分の扱いを決める。
8. サーバーの秘密鍵・レート制限・ログに個人情報やJWSを出さないこと、削除ユーザーのトークンが拒否されることを確認し、最終リリース判定を記録する。

JWSポリシーテストや型チェックの合格だけでは、Apple Sandboxの署名/ネットワーク/課金検証に合格したことにはならない。
