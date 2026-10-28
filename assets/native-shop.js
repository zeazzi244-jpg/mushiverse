(() => {
  const plugin = window.Capacitor?.Plugins?.MushiverseCoins;
  if (!window.Capacitor?.isNativePlatform?.() || !plugin) return;
  function mount() {
    const host = document.getElementById('mv134CoinStore');
    if (!host || document.getElementById('nativeCoinShop')) return;
    const button = document.createElement('button');
    button.id = 'nativeCoinShop'; button.type = 'button';
    button.textContent = 'Appleコインショップを確認（販売準備中）';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const { data, error } = await window.db.auth.getSession();
        if (error || !data.session?.user?.id) throw Error('マイページからログインしてください');
        await plugin.openShop({ accessToken: data.session.access_token, userID: data.session.user.id });
      } catch (error) { alert(error.message || 'ショップを開けませんでした'); }
      finally { button.disabled = false; }
    });
    host.append(button);
  }
  document.addEventListener('mushiverse:auth-changed', () => { plugin.closeShop().catch(() => {}); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true}); else mount();
})();
