(function () {
  const SYNCED_KEYS = new Set([
    "voyage_logo_text",
    "voyage_user_name",
    "voyage_trips",
    "voyage_quick_notes",
    "theme"
  ]);
  const LOCAL_EDIT_AT_KEY = "voyage_last_local_edit_at";
  const DEFAULTS = {
    logoText: "旅遊小本本",
    userName: "旅人",
    theme: "light"
  };

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  let client = null;
  let currentUser = null;
  let isApplyingRemoteState = false;
  let syncTimer = null;
  let installPromptEvent = null;
  let mobilePanelOpen = false;
  let ui = null;

  function getConfig() {
    return window.VOYAGE_SUPABASE_CONFIG || {};
  }

  function getClientKey() {
    const config = getConfig();
    return config.publishableKey || config.anonKey || "";
  }

  function hasCloudConfig() {
    const config = getConfig();
    return Boolean(config.url && getClientKey());
  }

  function getTableName() {
    return getConfig().appStateTable || "app_states";
  }

  function safeParse(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn("Failed to parse local state:", error);
      return fallback;
    }
  }

  function setLocalItemSilently(key, value) {
    originalSetItem.call(localStorage, key, value);
  }

  function touchLocalEditAt(timestamp) {
    originalSetItem.call(localStorage, LOCAL_EDIT_AT_KEY, timestamp || new Date().toISOString());
  }

  function getLocalEditAt() {
    return Date.parse(localStorage.getItem(LOCAL_EDIT_AT_KEY) || 0);
  }

  function serializeLocalState() {
    return {
      logo_text: localStorage.getItem("voyage_logo_text") || DEFAULTS.logoText,
      user_name: localStorage.getItem("voyage_user_name") || DEFAULTS.userName,
      theme: localStorage.getItem("theme") || DEFAULTS.theme,
      trips: safeParse(localStorage.getItem("voyage_trips"), []),
      quick_notes: safeParse(localStorage.getItem("voyage_quick_notes"), [])
    };
  }

  function applyRemoteState(record) {
    isApplyingRemoteState = true;
    try {
      setLocalItemSilently("voyage_logo_text", record.logo_text || DEFAULTS.logoText);
      setLocalItemSilently("voyage_user_name", record.user_name || DEFAULTS.userName);
      setLocalItemSilently("theme", record.theme || DEFAULTS.theme);
      setLocalItemSilently("voyage_trips", JSON.stringify(Array.isArray(record.trips) ? record.trips : []));
      setLocalItemSilently("voyage_quick_notes", JSON.stringify(Array.isArray(record.quick_notes) ? record.quick_notes : []));
      touchLocalEditAt(record.updated_at);
    } finally {
      isApplyingRemoteState = false;
    }
  }

  function setStatus(message, tone) {
    if (!ui) return;
    ui.status.textContent = message;
    ui.status.classList.remove("cloud-status-live", "cloud-status-warn", "cloud-status-error");
    if (tone === "live") ui.status.classList.add("cloud-status-live");
    if (tone === "warn") ui.status.classList.add("cloud-status-warn");
    if (tone === "error") ui.status.classList.add("cloud-status-error");
    if (ui.toggleDot) {
      ui.toggleDot.classList.remove("cloud-status-live", "cloud-status-warn", "cloud-status-error");
      if (tone === "live") ui.toggleDot.classList.add("cloud-status-live");
      if (tone === "warn") ui.toggleDot.classList.add("cloud-status-warn");
      if (tone === "error") ui.toggleDot.classList.add("cloud-status-error");
    }
  }

  function showToast(message, type) {
    window.voyageApp?.showToast?.(message, type);
  }

  function isCompactSyncUi() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function setMobilePanelOpen(nextOpen) {
    mobilePanelOpen = Boolean(nextOpen);
    if (!ui?.shell) return;

    ui.shell.classList.toggle("is-expanded", mobilePanelOpen);
    if (ui.toggleBtn) {
      ui.toggleBtn.setAttribute("aria-expanded", mobilePanelOpen ? "true" : "false");
    }
  }

  function closeMobilePanel() {
    if (isCompactSyncUi()) {
      setMobilePanelOpen(false);
    }
  }

  function updateUi() {
    if (!ui) return;

    if (!hasCloudConfig()) {
      ui.authBtn.textContent = "設定雲端";
      ui.syncBtn.hidden = true;
      ui.installBtn.hidden = !installPromptEvent;
      setStatus("未接上 Supabase，現在是本機模式", "warn");
      return;
    }

    if (currentUser) {
      ui.authBtn.textContent = "登出";
      ui.syncBtn.hidden = false;
      ui.installBtn.hidden = !installPromptEvent;
      setStatus(`已登入 ${currentUser.email}`, navigator.onLine ? "live" : "warn");
      return;
    }

    ui.authBtn.textContent = "登入同步";
    ui.syncBtn.hidden = true;
    ui.installBtn.hidden = !installPromptEvent;
    setStatus("本機模式，可登入後跨手機同步", "warn");
  }

  async function ensureClient() {
    if (client || !hasCloudConfig() || !window.supabase?.createClient) {
      return client;
    }

    const config = getConfig();
    client = window.supabase.createClient(config.url, getClientKey(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    const sessionResult = await client.auth.getSession();
    currentUser = sessionResult.data.session?.user || null;

    client.auth.onAuthStateChange(async (event, session) => {
      currentUser = session?.user || null;
      updateUi();

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        await syncAfterSignIn();
      }

      if (event === "SIGNED_OUT") {
        setStatus("已登出，資料保留在本機", "warn");
      }
    });

    return client;
  }

  async function fetchRemoteState() {
    if (!client || !currentUser) return null;

    const { data, error } = await client
      .from(getTableName())
      .select("user_id, logo_text, user_name, theme, trips, quick_notes, updated_at")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) {
      console.warn("Failed to load remote state:", error);
      setStatus("雲端讀取失敗，暫時回到本機模式", "error");
      return null;
    }

    return data;
  }

  function shouldApplyRemoteState(record) {
    if (!record?.updated_at) return false;
    const remoteEditedAt = Date.parse(record.updated_at);
    return remoteEditedAt > getLocalEditAt();
  }

  async function pushState(options = {}) {
    if (!client || !currentUser || isApplyingRemoteState) return false;

    const silent = Boolean(options.silent);
    const payload = {
      user_id: currentUser.id,
      ...serializeLocalState()
    };

    if (!silent) {
      setStatus("同步中...", "warn");
    }

    const { data, error } = await client
      .from(getTableName())
      .upsert(payload, { onConflict: "user_id" })
      .select("updated_at")
      .single();

    if (error) {
      console.warn("Failed to save remote state:", error);
      setStatus("同步失敗，請稍後再試", "error");
      if (!silent) {
        showToast("雲端同步失敗，請稍後再試。", "error");
      }
      return false;
    }

    if (data?.updated_at) {
      touchLocalEditAt(data.updated_at);
    }

    setStatus("已同步到雲端", "live");
    if (!silent) {
      showToast("雲端同步完成。", "success");
    }
    return true;
  }

  function scheduleSync() {
    if (!client || !currentUser || isApplyingRemoteState || !navigator.onLine) return;

    clearTimeout(syncTimer);
    setStatus("有新變更，準備同步", "warn");
    syncTimer = window.setTimeout(() => {
      pushState({ silent: true });
    }, 900);
  }

  async function syncAfterSignIn() {
    const remoteState = await fetchRemoteState();

    if (remoteState && shouldApplyRemoteState(remoteState)) {
      applyRemoteState(remoteState);
      window.voyageApp?.rehydrateAndRender?.();
      setStatus("已載入你的雲端旅程", "live");
      showToast("已載入你的雲端旅程。", "success");
      return;
    }

    await pushState({ silent: true });
  }

  function patchLocalStorage() {
    if (window.__voyageStoragePatched) return;
    window.__voyageStoragePatched = true;

    Storage.prototype.setItem = function (key, value) {
      originalSetItem.call(this, key, value);
      if (this === localStorage && SYNCED_KEYS.has(key) && !isApplyingRemoteState) {
        touchLocalEditAt();
        scheduleSync();
      }
    };

    Storage.prototype.removeItem = function (key) {
      originalRemoveItem.call(this, key);
      if (this === localStorage && SYNCED_KEYS.has(key) && !isApplyingRemoteState) {
        touchLocalEditAt();
        scheduleSync();
      }
    };
  }

  function closeAuthModal() {
    if (!ui) return;
    ui.authOverlay.classList.remove("is-open");
  }

  function openAuthModal() {
    if (!ui) return;
    ui.authOverlay.classList.add("is-open");
    ui.emailInput.focus();
  }

  async function handleAuthButtonClick() {
    closeMobilePanel();

    if (!hasCloudConfig()) {
      showToast("請先在 supabase-config.js 填入 Supabase URL 與 publishable key。", "info");
      return;
    }

    await ensureClient();

    if (currentUser) {
      await client.auth.signOut();
      showToast("已登出雲端同步。", "info");
      return;
    }

    openAuthModal();
  }

  async function handleEmailLogin(event) {
    event.preventDefault();

    const email = ui.emailInput.value.trim();
    if (!email) {
      showToast("請先輸入 Email。", "info");
      return;
    }

    await ensureClient();

    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`
      }
    });

    if (error) {
      console.warn("Email login failed:", error);
      showToast("登入連結寄送失敗，請稍後再試。", "error");
      return;
    }

    closeAuthModal();
    ui.emailForm.reset();
    setStatus("登入連結已寄出，請回信箱開啟", "warn");
    showToast("已寄出登入連結，請到信箱收信。", "success");
  }

  async function handleInstallClick() {
    closeMobilePanel();

    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    installPromptEvent = null;
    updateUi();
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
    });
  }

  function mountUi() {
    if (ui || !document.querySelector(".header-actions")) return;

    const headerActions = document.querySelector(".header-actions");
    const wrapper = document.createElement("div");
    wrapper.className = "cloud-sync-panel";
    wrapper.innerHTML = `
      <div class="cloud-sync-copy">
        <span class="cloud-sync-title">雲端同步</span>
        <span class="cloud-sync-status" id="cloud-sync-status">準備中...</span>
      </div>
      <div class="cloud-sync-actions">
        <button type="button" class="btn btn-secondary cloud-sync-btn" id="cloud-auth-btn">登入同步</button>
        <button type="button" class="btn btn-secondary cloud-sync-btn" id="cloud-sync-now-btn" hidden>立即同步</button>
        <button type="button" class="btn btn-secondary cloud-sync-btn" id="cloud-install-btn" hidden>安裝 App</button>
      </div>
    `;
    headerActions.insertBefore(wrapper, headerActions.firstChild);

    const overlay = document.createElement("div");
    overlay.className = "cloud-auth-overlay";
    overlay.innerHTML = `
      <div class="cloud-auth-modal glass">
        <h3>登入你的旅遊本</h3>
        <p>輸入 Email 後，我們會寄一封登入連結給你。登入後，資料就能在手機與電腦之間同步。</p>
        <form class="cloud-auth-form" id="cloud-auth-form">
          <input type="email" class="cloud-auth-input" id="cloud-auth-email" placeholder="you@example.com" autocomplete="email" required>
          <div class="cloud-auth-footer">
            <button type="button" class="btn btn-secondary" id="cloud-auth-cancel">取消</button>
            <button type="submit" class="btn btn-primary">寄送登入連結</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    ui = {
      authBtn: wrapper.querySelector("#cloud-auth-btn"),
      syncBtn: wrapper.querySelector("#cloud-sync-now-btn"),
      installBtn: wrapper.querySelector("#cloud-install-btn"),
      status: wrapper.querySelector("#cloud-sync-status"),
      authOverlay: overlay,
      emailForm: overlay.querySelector("#cloud-auth-form"),
      emailInput: overlay.querySelector("#cloud-auth-email"),
      cancelBtn: overlay.querySelector("#cloud-auth-cancel")
    };

    ui.authBtn.addEventListener("click", handleAuthButtonClick);
    ui.syncBtn.addEventListener("click", () => pushState());
    ui.installBtn.addEventListener("click", handleInstallClick);
    ui.emailForm.addEventListener("submit", handleEmailLogin);
    ui.cancelBtn.addEventListener("click", closeAuthModal);
    ui.authOverlay.addEventListener("click", (event) => {
      if (event.target === ui.authOverlay) {
        closeAuthModal();
      }
    });

    updateUi();
  }

  function mountResponsiveUi() {
    if (ui || !document.querySelector(".header-actions")) return;

    const headerActions = document.querySelector(".header-actions");
    const shell = document.createElement("div");
    shell.className = "cloud-sync-shell";
    shell.innerHTML = `
      <button type="button" class="cloud-sync-toggle btn-icon" id="cloud-sync-toggle" aria-expanded="false" aria-label="Cloud sync">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 18a4 4 0 1 1 .8-7.92A5.5 5.5 0 0 1 18.5 11a3.5 3.5 0 1 1 .5 7H7Z"></path>
        </svg>
        <span class="cloud-sync-dot cloud-status-warn" id="cloud-sync-dot"></span>
      </button>
      <div class="cloud-sync-panel" id="cloud-sync-panel">
        <div class="cloud-sync-copy">
          <span class="cloud-sync-title">雲端同步</span>
          <span class="cloud-sync-status" id="cloud-sync-status">準備中...</span>
        </div>
        <div class="cloud-sync-actions">
          <button type="button" class="btn btn-secondary cloud-sync-btn" id="cloud-auth-btn">登入同步</button>
          <button type="button" class="btn btn-secondary cloud-sync-btn" id="cloud-sync-now-btn" hidden>立即同步</button>
          <button type="button" class="btn btn-secondary cloud-sync-btn" id="cloud-install-btn" hidden>安裝 App</button>
        </div>
      </div>
    `;
    headerActions.insertBefore(shell, headerActions.firstChild);

    const overlay = document.createElement("div");
    overlay.className = "cloud-auth-overlay";
    overlay.innerHTML = `
      <div class="cloud-auth-modal glass">
        <h3>登入你的旅遊本</h3>
        <p>輸入 Email 後，我們會寄一封登入連結給你。登入後，資料就能在手機與電腦之間同步。</p>
        <form class="cloud-auth-form" id="cloud-auth-form">
          <input type="email" class="cloud-auth-input" id="cloud-auth-email" placeholder="you@example.com" autocomplete="email" required>
          <div class="cloud-auth-footer">
            <button type="button" class="btn btn-secondary" id="cloud-auth-cancel">取消</button>
            <button type="submit" class="btn btn-primary">寄送登入連結</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    ui = {
      shell,
      panel: shell.querySelector("#cloud-sync-panel"),
      toggleBtn: shell.querySelector("#cloud-sync-toggle"),
      toggleDot: shell.querySelector("#cloud-sync-dot"),
      authBtn: shell.querySelector("#cloud-auth-btn"),
      syncBtn: shell.querySelector("#cloud-sync-now-btn"),
      installBtn: shell.querySelector("#cloud-install-btn"),
      status: shell.querySelector("#cloud-sync-status"),
      authOverlay: overlay,
      emailForm: overlay.querySelector("#cloud-auth-form"),
      emailInput: overlay.querySelector("#cloud-auth-email"),
      cancelBtn: overlay.querySelector("#cloud-auth-cancel")
    };

    ui.toggleBtn.addEventListener("click", () => {
      if (!isCompactSyncUi()) return;
      setMobilePanelOpen(!mobilePanelOpen);
    });
    ui.authBtn.addEventListener("click", handleAuthButtonClick);
    ui.syncBtn.addEventListener("click", () => {
      closeMobilePanel();
      pushState();
    });
    ui.installBtn.addEventListener("click", handleInstallClick);
    ui.emailForm.addEventListener("submit", handleEmailLogin);
    ui.cancelBtn.addEventListener("click", closeAuthModal);
    ui.authOverlay.addEventListener("click", (event) => {
      if (event.target === ui.authOverlay) {
        closeAuthModal();
      }
    });
    document.addEventListener("click", (event) => {
      if (!isCompactSyncUi() || !mobilePanelOpen) return;
      if (!ui.shell.contains(event.target)) {
        setMobilePanelOpen(false);
      }
    });
    window.addEventListener("resize", () => {
      if (!isCompactSyncUi()) {
        setMobilePanelOpen(false);
      }
    });

    updateUi();
  }

  async function hydrateBeforeAppStart() {
    patchLocalStorage();
    if (!localStorage.getItem(LOCAL_EDIT_AT_KEY)) {
      touchLocalEditAt();
    }

    if (!hasCloudConfig()) {
      return;
    }

    await ensureClient();
    if (!currentUser) {
      return;
    }

    const remoteState = await fetchRemoteState();
    if (remoteState && shouldApplyRemoteState(remoteState)) {
      applyRemoteState(remoteState);
    } else if (!remoteState) {
      await pushState({ silent: true });
    }
  }

  window.addEventListener("online", () => {
    setStatus("已重新連線，準備同步", "warn");
    scheduleSync();
  });

  window.addEventListener("offline", () => {
    setStatus("離線中，先存本機，恢復網路後再同步", "warn");
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPromptEvent = event;
    updateUi();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pushState({ silent: true });
    }
  });

  document.addEventListener("voyage:app-ready", () => {
    mountResponsiveUi();
    updateUi();
  });

  registerServiceWorker();

  window.voyageCloud = {
    hydrateBeforeAppStart
  };
})();
