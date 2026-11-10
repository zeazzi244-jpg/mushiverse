# アカウント削除・通報の確認と修正候補（2026-11-06）

## 現在の配備と問題

本番の `delete-account` / `submit-report` は読み取りで調査。両方ACTIVE、version 1、verify_jwt=true。本番サービス/DB/ユーザー/写真を変更していない。既存削除関数の[読み取り参照](references/delete-account-live-v1.ts)を保存した。

削除関数の問題:
- insect-photosの一覧取得/削除エラーを無視して次へ進む。
- 1,000件を超える写真のページ送りと入れ子フォルダーを処理しない。
- 本番FKを読み取り確認したところ、旧購入台帳4表がauth.users削除を制限する。旧処理では写真/投稿の削除後にAuth削除が失敗し得る。

端末側の問題:
- v34DeleteAccountの成功処理がmushiverseで始まる全キーを消去し、同じ端末に保存された別アカウントの無料ガチャ/プロフィール/下書きまで消し得る。
- 削除応答を待つ間のアカウント切替を確認せずsignOut/reloadしていた。

## 作成した修正

[サーバー候補](../supabase/candidates/delete-account/handler.mjs)と[Edge入口](../supabase/candidates/delete-account/index.ts)は11月8日に本番version 2として配備。修正版は以下を行う。

1. getUserで検証した本人のIDだけを使用。bodyのuser_idで対象を選ばせない。
2. 旧購入台帳への参照を破壊前に確認し、記録がある場合は409で停止する。購入記録/残高は削除・移行しない。
3. 本人のフォルダーのみをページ送り/再帰で一覧化し、最大1,000件単位でStorage APIから削除。失敗時は完了を返さない。
4. 写真の再一覧で並行アップロードを検出。投稿/Authのエラーを検査し、実際にAuth削除が成功した後だけdeleted=trueを返す。
5. 監査の失敗とAuth削除済みを区別。監査は識別子なしの件数/バージョンのみ。新候補は投稿/写真件数を記録し、いいねの件数を別途集計しない。

index.htmlの端末側は、成功した本人の既知3キー（プロフィール・下書き・無料ガチャ）だけを削除するよう変更。別アカウント/ゲスト/所有者不明の旧データは保持。応答待ち中に別アカウントへ切り替わった場合は、そのアカウントをログアウト/再読込しない。ログイン状態の照会失敗時もsignOut/reloadしない。端末内消去エラーはユーザーへ通知する。

## 検証

- [候補単体10件](../tests/account-deletion-candidate.test.mjs): 本人範囲、1,151写真/入れ子/ページ送り、一覧/削除/DB/Auth失敗、旧購入参照、並行アップロード、監査失敗の結果。ローカルNodeとCIで成功。
- [端末側5件](../tests/account-deletion-client.test.mjs): 本人の3キーのみ消去、別アカウント/ゲスト/旧データ保持、待機中のアカウント切替、サーバー失敗、端末消去失敗、セッション照会失敗。ローカルNodeと[Web CI 42203969327](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42203969327)で成功。標準npm testに追加済み。
- [実連携試験](../tests/integration/account-deletion.test.mjs): [42203408405](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42203408405)、コードSHA `7c93f8bffdd9c00dca3ff7343a7672c74e351e4f` で6項目成功。Auth/Storage/REST/Postgresは実サービス、データは使い捨て。本人のAuth/投稿/写真/コメント/いいね/通報の削除、他ユーザーの保持、残る他者通報の参照NULL化、再ログイン拒否/旧JWTによる再削除拒否を確認。
- 通報では本人INSERT/他者閲覧不可/他者IDでのなりすましINSERT拒否を確認。Storage故障の1箇所だけは意図的に注入してデータ保持を確認。
- [CI](../.github/workflows/safety-integration.yml) は型検査、候補単体、実連携を実行。初回は試験用アダプターの構文エラーを修正して再実行し、上記で成功。Stack起動ログにはローカル鍵が含まれ得るため公開しない。鍵は子プロセスのメモリのみ。
- 実行: `supabase --workdir staging-safety start --exclude realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor` → `node scripts/run-safety-integration.mjs` → `supabase --workdir staging-safety stop --no-backup`。runnerは固定project名・コンテナ・127.0.0.1:55321を検査し、任意/本番URLを受け付けない。

## 限界と反映条件

- 実連携は観測したFK/RLSの最小fixture。配備済みEdge gatewayと本番全スキーマでの成功を証明しない。
- StorageとDB/Authは横断トランザクションではない。途中失敗の際は既に完了した削除を取り消せず、再試行/運営対応が必要。並行書込みを完全にロックする設計ではない。
- 旧購入台帳があるアカウントは事前停止する。保存期間/法的取扱い/手動対応を所有者が確定するまで削除を通過させない。
- 所有者不明の旧端末データや共有キャッシュの消去方針は未確定。既存記録・旧残高を無断で一括消去しない。
- 本番metadata上のcontent_reportsには本人INSERTのRLSとGRANTがある。既存モデレーター数1を確認。moderator RPCは所属確認/空search_pathを持つ。本番の運営受信/処理/対応期限は未確認。
- [AGENTS.md](../AGENTS.md)の現在の許可範囲では本番サービス変更をしない。反映する場合は、本番delete-accountの関数更新のみについて別途具体的承認を受ける。DB構造/既存レコードの書換え、実ユーザーの削除実行、mainマージ、課金有効化、App Store一般公開申請を含めない。
- 本人のアカウントで削除の動作試験をしない。端末修正のTestFlight配布は既に許可済みであり、本番関数の反映とは別に進める。

公式参照（2026-11-06）:
- https://supabase.com/docs/guides/auth/managing-user-data （Auth削除だけで発行済JWTが直ちに無効になるわけではない）
- https://supabase.com/docs/guides/storage/management/delete-objects （Storage API/最大1,000件）

端末修正はTestFlight **1541**へ配布済み。Apple処理VALID・IN_BETA_TESTINGを2026-11-06 19:51 JSTに確認。端末インストールは未確認。本番反映は下記参照。


## 2026-11-08 本番反映

所有者の承認を受け、delete-account の関数コードを version 2 に更新。ACTIVE、verify_jwt=true、および配備済み2ファイルが隔離CI [42203408405](https://github.com/zeazzi244-jpg/mushiverse/actions/runs/42203408405) の対象 SHA `7c93f8bffdd9c00dca3ff7343a7672c74e351e4f` と一致することを反映後に確認。旧版の参照は [こちら](references/delete-account-live-v1.ts)。実アカウントへの削除リクエストは送っていない。本番での削除完走、通報の運営受信、1541の端末確認は未検証。旧購入台帳を持つアカウントの削除は事前に停止し、保持方針は未確定。
