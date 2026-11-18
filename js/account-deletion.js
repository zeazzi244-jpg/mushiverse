(() => {
  'use strict';
  const receiptKey = 'mushiverse-account-deletion-receipt-v21';
  const authKey = 'sb-jhowxtdemlsmetcwhekr-auth-token';
  const errors = {
    unauthorized: 'ログインが必要です。再度ログインしてください。',
    reauthentication_required: '本人確認の有効期限が切れました。パスワードを入力し直してください。',
    billing_retention_review: '取引記録の確認が必要なため削除を開始できません。サポートへお問い合わせください。',
    busy: '削除処理が進行中です。少し待ってから完了状況を確認してください。',
    rate_limited: '再試行の上限に達しました。24時間後に再試行してください。',
    existing_request: '以前の削除処理を引き継ぎました。もう一度実行してください。',
    deletion_incomplete: '削除が完了していません。一部のデータが削除されている可能性があります。通信状態を確認して、同じ画面から再試行してください。',
  };

  async function callServer(client, store, body) {
    const result = await client.functions.invoke('delete-account', { body });
    let data = result.data;
    if (result.error?.context?.json) {
      try { data = await result.error.context.json(); } catch { /* Use the transport error below. */ }
    }
    if (data?.request_id) store.setItem(receiptKey, data.request_id);
    if (result.error || data?.error) throw new Error(data?.error || 'deletion_incomplete');
    return data;
  }

  function createFlow({ client, store, randomUUID, onDeleted }) {
    let busy = false;
    return {
      get busy() { return busy; },
      async remove({ password, confirmation, expectedUserId }) {
        if (busy) throw new Error('busy');
        busy = true;
        try {
          if (confirmation !== '削除' && confirmation !== 'DELETE') throw new Error('confirmation_required');
          const { data, error } = await client.auth.getUser();
          const user = data?.user;
          if (error || !user?.id || user.id !== expectedUserId) throw new Error('unauthorized');
          if (!password || !user.email) throw new Error('reauthentication_required');
          const reauth = await client.auth.signInWithPassword({ email: user.email, password });
          if (reauth.error || reauth.data?.user?.id !== user.id) throw new Error('reauthentication_required');
          let receipt = store.getItem(receiptKey);
          if (!receipt) {
            receipt = randomUUID();
            // Persist before sending so a lost response can be checked after restart.
            store.setItem(receiptKey, receipt);
          }
          const response = await callServer(client, store, { action: 'delete', request_id: receipt, confirmation: 'DELETE_MY_ACCOUNT' });
          if (response?.deleted !== true) throw new Error('deletion_incomplete');
          await onDeleted();
        } finally { busy = false; }
      },
      async check() {
        if (busy) throw new Error('busy');
        const receipt = store.getItem(receiptKey);
        if (!receipt) return false;
        busy = true;
        try {
          const result = await callServer(client, store, { action: 'status', request_id: receipt });
          if (result?.deleted === true) { await onDeleted(); return true; }
          return false;
        } finally { busy = false; }
      },
    };
  }

  async function clearLocalData({ local, session, cacheStorage, databaseFactory }) {
    const clearStore = store => {
      const keys = [];
      for (let i = 0; i < store.length; i++) keys.push(store.key(i));
      for (const key of keys) {
        if (key?.startsWith('mushiverse') || key === authKey || key?.startsWith(authKey + '-')) store.removeItem(key);
      }
    };
    if (cacheStorage) {
      for (const name of await cacheStorage.keys()) {
        if (!(await cacheStorage.delete(name))) throw new Error('cache_cleanup_failed');
      }
    }
    if (databaseFactory?.databases) {
      for (const database of await databaseFactory.databases()) {
        if (!database.name?.startsWith('mushiverse')) continue;
        await new Promise((resolve, reject) => {
          const request = databaseFactory.deleteDatabase(database.name);
          request.onsuccess = resolve;
          request.onerror = request.onblocked = () => reject(new Error('database_cleanup_failed'));
        });
      }
    }
    clearStore(session);
    clearStore(local);
  }

  let flow, dialog, status, deleteButton, completedOnServer = false;
  const showError = error => {
    status.textContent = completedOnServer
      ? 'アカウントはサーバーから削除済みです。端末データの消去が完了していません。「端末データ消去を再試行」を押してください。'
      : errors[error.message] || '削除が完了していません。通信状態と入力内容を確認し、再試行してください。';
    if (completedOnServer) {
      deleteButton.textContent = '端末データ消去を再試行';
      deleteButton.formNoValidate = true;
    }
  };
  async function finish() {
    completedOnServer = true;
    // Auth removal already invalidated refresh sessions. Clear the SDK's local
    // state even when the now-deleted user cannot call the remote logout API.
    try { await window.db.auth.signOut({ scope: 'local' }); } catch { /* Explicit storage cleanup follows. */ }
    await clearLocalData({ local: localStorage, session: sessionStorage, cacheStorage: window.caches, databaseFactory: window.indexedDB });
    sessionStorage.setItem('mushiverse-account-deletion-notice', '1');
    window.location.replace(window.location.pathname);
  }
  function open() {
    if (!dialog) return;
    dialog.querySelector('form').reset();
    status.textContent = '';
    dialog.showModal();
  }
  function mount() {
    const settings = document.getElementById('mv128Settings');
    if (!settings || document.getElementById('mv21DeleteAccount')) return Boolean(settings);
    const section = document.createElement('section');
    section.id = 'mv21DeleteAccount';
    section.innerHTML = '<h3>アカウント管理</h3><p>アカウントと本人のデータをアプリ内で削除できます。</p><button type="button" class="btn danger" id="mv21OpenDeletion">アカウントを削除</button><p><a href="./contact.html">お問い合わせ・サポート</a></p>';
    settings.append(section);
    dialog = document.createElement('dialog');
    dialog.id = 'mv21DeletionDialog';
    dialog.setAttribute('aria-labelledby', 'mv21DeletionTitle');
    dialog.innerHTML = '<form><h2 id="mv21DeletionTitle">アカウントを削除</h2><p>削除すると元に戻せません。次のデータを削除します。</p><ul><li>ログイン情報、プロフィール、ユーザー名</li><li>自分の投稿・写真・記録・コメント・いいね</li><li>フォロー・フォロワー関係、ランキング情報</li><li>この端末のカード所持・履歴・下書き・設定</li></ul><p>この版では有料購入は無効です。法令保存を理由に本人のアプリデータを残す処理はありません。削除完了の確認用には、本人を示す情報を除いたランダム番号を保存します。</p><p>削除を開始するとアカウントの利用を制限します。途中で通信が切れた場合はこの画面で完了状況を確認し、再試行してください。</p><label>本人確認用パスワード<input id="mv21DeletionPassword" type="password" autocomplete="current-password" required></label><label>最終確認として「削除」と入力<input id="mv21DeletionConfirm" autocomplete="off" required></label><p><label><input id="mv21DeletionConsent" type="checkbox" required>削除対象と、元に戻せないことを確認しました</label></p><p id="mv21DeletionStatus" role="status" aria-live="polite"></p><button type="submit" class="btn danger" id="mv21ConfirmDeletion">完全に削除する</button><button type="button" class="btn outline" id="mv21CheckDeletion">完了状況を確認</button><button type="button" class="btn outline" id="mv21CancelDeletion">閉じる</button></form>';
    document.body.append(dialog);
    status = dialog.querySelector('#mv21DeletionStatus');
    deleteButton = dialog.querySelector('#mv21ConfirmDeletion');
    flow = createFlow({ client: window.db, store: localStorage, randomUUID: () => crypto.randomUUID(), onDeleted: finish });
    section.querySelector('button').addEventListener('click', open);
    const disable = value => {
      dialog.querySelectorAll('button,input').forEach(element => { element.disabled = value; });
      dialog.setAttribute('aria-busy', String(value));
    };
    dialog.addEventListener('cancel', event => { if (flow.busy) event.preventDefault(); });
    dialog.querySelector('#mv21CancelDeletion').addEventListener('click', () => dialog.close());
    dialog.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      if (flow.busy) return;
      disable(true);
      status.textContent = '本人確認と削除を処理しています…';
      const password = dialog.querySelector('#mv21DeletionPassword');
      try {
        if (completedOnServer) await finish();
        else await flow.remove({ password: password.value, confirmation: dialog.querySelector('#mv21DeletionConfirm').value.trim(), expectedUserId: window.user?.id });
      } catch (error) { showError(error); }
      finally { password.value = ''; disable(false); }
    });
    dialog.querySelector('#mv21CheckDeletion').addEventListener('click', async () => {
      disable(true);
      try { if (!(await flow.check())) status.textContent = '削除完了は確認できませんでした。パスワードと最終確認を入力して再試行してください。'; }
      catch (error) { showError(error); }
      finally { disable(false); }
    });
    if (sessionStorage.getItem('mushiverse-account-deletion-notice') === '1') {
      sessionStorage.removeItem('mushiverse-account-deletion-notice');
      const notice = document.createElement('p');
      notice.setAttribute('role', 'status'); notice.textContent = 'アカウントを削除し、この端末の個人データを消去しました。';
      section.prepend(notice);
    }
    // A completed request whose HTTP response was lost can be recovered without
    // signing into an account that no longer exists.
    if (localStorage.getItem(receiptKey)) void flow.check().catch(() => {});
    return true;
  }
  window.mushiverseAccountDeletion = { open, createFlow, clearLocalData };
  const start = () => {
    if (mount()) return;
    const observer = new MutationObserver(() => { if (mount()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
