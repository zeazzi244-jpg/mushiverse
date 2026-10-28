# 隔離した課金統合環境（本番未変更）

## 今回の構成

接続済みSupabaseは本番 `mushi-log` のみ、開発ブランチなし、組織はFreeプラン。所有者の追加料金同意を得ずに有料ブランチ/プロジェクトは作らない。本番をステージングの代わりに使用しない。

PR #2には追加課金のない **ローカル/CIの使い捨て検証環境** を用意した。`staging/supabase/config.toml` に固定されたプロジェクト名 `mushiverse-billing-integration` と127.0.0.1上の54321/54322のみを使用する。ホストされた常設ステージング、実機が接続できるURL、Apple Sandbox環境ではない。

- Supabase GoTrue Auth、PostgREST、Postgres 17を実行。
- 実際のAuth発行JWT/session_id、RLS、service-role限定RPCを使用。
- 本体と同じHTTPハンドラー/認証/RPCアダプターを使用し、Apple検証済みデータを返す境界だけテスト用に注入。
- プロダクションの環境変数/ゲートやSwift固定フラグは変更しない。
- 正常購入の同時再送、同一draw再送、異なるdrawの競合、返金前受信、消費後返金/負債/取消、別ユーザーの権限、JWT失効/削除を試験。
- テストユーザーはランダム生成し、finallyでAuth削除。ローカルの取引トゥームストーンは環境破棄まで保持。
- ローカルAPI/サービス鍵はプロセスメモリだけで子プロセスへ渡す。キーを表示/保存/成果物化しない。CLI startのログにも開発用鍵が含まれ得るため、CIログへcatしない。

## 再現

Dockerが使えるマシン/CIで実行（所有者のiPhoneにCLIを入れる必要はない）。Supabase CLIは検証用に2.90.0を固定した。2.122.0のnpm CLIは現在の制限付き作業環境で `/home/agent/.supabase` の書込に失敗したため、2.90.0の公式配布バイナリを公開checksum照合後に使用している。更新は別途互換検証する。

```sh
npm ci
supabase --workdir staging start --exclude realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor > /tmp/mushiverse-local-start.log 2>&1
node scripts/run-billing-integration.mjs
supabase --workdir staging stop --no-backup
```

CLIがPATH外なら `SUPABASE_BIN=/path/to/supabase node scripts/run-billing-integration.mjs`。Denoのnpm解決にネットワークが必要な初回は事前に `npx deno check --no-config --node-modules-dir=manual tests/integration/billing.test.ts` を行う。

GitHubの **Isolated billing integration** は変更対象に応じて自動実行する。DBに `supabase/sql/coin-wallet-v2.sql` を適用するが、コンテナ名・API URLを固定検査し、リンク先/任意DB URLを受け付けない。`supabase link` / `db push` / remote deployは使わない。ホスト側へ一般公開する用途は禁止。作業環境ではDocker既定のポートを使うため、ネットワークが信頼できないPCでそのまま公開せず、CLI公式のloopback専用Dockerネットワーク手順を適用する。

## ホスト型ステージングを後で構築する場合

所有者が組織と見積費用を確認し、別プロジェクト/開発ブランチ作成に明示同意してから進める。既存本番のユーザー/画像/鍵を複製せず、独立Auth・Storage・API設定を作る。Server API鍵/ルート証明書とApple Sandbox専用商品/ビルドを接続する。全ゲートOFFで401/503と残高不変を確認し、別途承認されたSandbox専用構成でのみ実購入を検証する。公開前のゲート解除や本番へのマージはこの手順の対象外。

残る検証: Supabase Edge gateway/OCSP/Apple有効署名、通知の配信/取りこぼし照合、部分返金/消費情報報告、Storage/UGC、外部SMTP、iPhoneからの接続、運用監視/レート制限。ローカル統合成功でこれらを完了扱いしない。
