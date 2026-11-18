# MUSHIVERSE iOS 1.0 — App Review notes

Replace the bracketed items only after verifying the final TestFlight build on a physical iPhone. Keep the account listed under App Review Sign-In Information available and use a separate disposable account to demonstrate deletion.

> MUSHIVERSE is a free Japanese-language app for people who observe insects. Users can maintain photo records, browse the insect guide and observation map, and collect fictional insect cards using free coins. This submission is for Japan. No in-app purchases are enabled in this build.
>
> On the My Page tab (マイページ), tap Register or Sign In (登録・ログイン) and enter the email and password provided in App Review Sign-In Information. Use Record (記録) to create an observation, Guide (図鑑) to browse insects, Map (マップ) to view observations by area, and Gacha (ガチャ) to view free card collection. Open a public post to find reporting and blocking controls.
>
> To delete a disposable account, open My Page → App Settings (アプリの設定) → Delete Account (アカウントを削除). Read the data list, enter the current password and the word 削除, check the confirmation box, and tap 完全に削除する. The app signs out and clears the device data after the server confirms deletion. Please keep the primary review login active for testing other features.
>
> Supabase provides email/password authentication, the database, photo storage, and server-side functions. The Geospatial Information Authority of Japan provides map tiles and place search. Photo-based AI species identification is disabled. The App Store distribution territory is Japan, and the current facility for mapping observations focuses on Japan. Map attribution appears on the map and the source terms are linked below. [Insert real-device recording link and build number after verification.]

- [GSI map tiles and attribution terms](https://maps.gsi.go.jp/development/ichiran.html)
- [Public privacy policy](https://zeazzi244-jpg.github.io/mushiverse/privacy.html)

## iPhone録画

1. TestFlightで今回のビルド番号を確認。削除専用のテストアカウントを用意し、審査用ログインとは分ける。
2. コントロールセンターで画面収録を開始し、アプリの起動、マイページからのログイン、サンプル投稿、図鑑、地図、ガチャを順に映す。認証情報の入力部分は録画から除く。
3. 「マイページ」→「アプリの設定」→「アカウントを削除」と進み、削除対象、確認チェック、実行ボタン、削除完了とログアウトを映す。
4. 削除したテストアカウントで再ログインできないことを確認。個人情報が映っていない録画を審査へ添付し、上の英文に実際のビルド番号と録画リンクを入れる。
