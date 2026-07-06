(function () {
  const SYNCED_KEYS = new Set([
    "voyage_logo_text",
    "voyage_user_name",
    "voyage_trips",
    "voyage_quick_notes",
    "theme"
  ]);
  const LOCAL_EDIT_AT_KEY = "voyage_last_local_edit_at";
  const REMOTE_PULL_INTERVAL_MS = 20000;
  const DEFAULTS = {
    logoText: "旅遊小本本",
    userName: "旅人",
    theme: "light"
  };

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  let client = null;
  let isApplyingRemoteState = false;
  let syncTimer = null;
  let remotePullTimer = null;
  let remoteChannel = null;
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
    return "sync_states";
  }

  function generateSyncCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "VOYAGE-";
    for (let i = 0; i < 8; i++) {
      if (i === 4) code += "-";
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
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

    const syncCode = localStorage.getItem("voyage_sync_code");
    ui.authBtn.textContent = "金鑰同步設定";
    ui.syncBtn.hidden = false;
    ui.installBtn.hidden = !installPromptEvent;
    setStatus(`雲端同步中 (${syncCode})`, navigator.onLine ? "live" : "warn");
  }

  async function ensureClient() {
    if (client || !hasCloudConfig() || !window.supabase?.createClient) {
      return client;
    }

    const config = getConfig();
    client = window.supabase.createClient(config.url, getClientKey());

    // 初始化/取得金鑰
    let syncCode = localStorage.getItem("voyage_sync_code");
    if (!syncCode) {
      syncCode = generateSyncCode();
      localStorage.setItem("voyage_sync_code", syncCode);
    }

    setupRemoteSyncChannel();
    startRemotePullLoop();

    return client;
  }

  async function fetchRemoteState() {
    const syncCode = localStorage.getItem("voyage_sync_code");
    if (!client || !syncCode) return null;

    const { data, error } = await client
      .from(getTableName())
      .select("sync_code, logo_text, user_name, theme, trips, quick_notes, updated_at")
      .eq("sync_code", syncCode)
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

    // 安全防護：如果本機有旅程資料，但雲端是空的（可能是新裝置登入誤蓋掉雲端）
    // 則不應讓雲端的空資料覆蓋本機資料，而是應該保留本機資料
    const localTrips = safeParse(localStorage.getItem("voyage_trips"), []);
    const remoteTrips = Array.isArray(record.trips) ? record.trips : [];
    if (localTrips.length > 0 && remoteTrips.length === 0) {
      console.warn("Safety check: Local has trips but remote is empty. Preventing overwrite.");
      return false;
    }

    const remoteEditedAt = Date.parse(record.updated_at);
    return remoteEditedAt > getLocalEditAt();
  }

  function stopRemotePullLoop() {
    if (!remotePullTimer) return;
    window.clearInterval(remotePullTimer);
    remotePullTimer = null;
  }

  function teardownRemoteChannel() {
    if (!client || !remoteChannel) return;
    client.removeChannel(remoteChannel);
    remoteChannel = null;
  }

  function rehydrateFromRemote(record) {
    if (!record || !shouldApplyRemoteState(record)) return false;
    applyRemoteState(record);
    window.voyageApp?.rehydrateAndRender?.();
    return true;
  }

  async function pullRemoteState(options = {}) {
    if (!client || !navigator.onLine) return false;

    const remoteState = await fetchRemoteState();
    if (!remoteState) return false;

    const applied = rehydrateFromRemote(remoteState);
    if (applied && !options.silent) {
      setStatus("已取得其他裝置的最新資料", "live");
      if (!options.skipToast) {
        showToast("已同步其他裝置剛剛儲存的最新內容", "success");
      }
    }
    return applied;
  }

  function startRemotePullLoop() {
    stopRemotePullLoop();
    if (!client) return;

    remotePullTimer = window.setInterval(() => {
      pullRemoteState({ silent: true, skipToast: true });
    }, REMOTE_PULL_INTERVAL_MS);
  }

  function setupRemoteSyncChannel() {
    teardownRemoteChannel();
    const syncCode = localStorage.getItem("voyage_sync_code");
    if (!client || !syncCode || typeof client.channel !== "function") return;

    remoteChannel = client
      .channel(`voyage-app-state:${syncCode}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: getTableName(),
        filter: `sync_code=eq.${syncCode}`
      }, (payload) => {
        const nextRecord = payload?.new;
        if (!nextRecord || isApplyingRemoteState) return;

        if (rehydrateFromRemote(nextRecord)) {
          setStatus("已取得其他裝置的最新資料", "live");
        }
      })
      .subscribe();
  }

  async function pushState(options = {}) {
    const syncCode = localStorage.getItem("voyage_sync_code");
    if (!client || !syncCode || isApplyingRemoteState) return false;

    const silent = Boolean(options.silent);
    const payload = {
      sync_code: syncCode,
      ...serializeLocalState()
    };

    if (!silent) {
      setStatus("同步中...", "warn");
    }

    const { data, error } = await client
      .from(getTableName())
      .upsert(payload, { onConflict: "sync_code" })
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
    if (!client || isApplyingRemoteState || !navigator.onLine) return;

    clearTimeout(syncTimer);
    setStatus("有新變更，準備同步", "warn");
    syncTimer = window.setTimeout(() => {
      pushState({ silent: true });
    }, 900);
  }

  async function linkDevice(newCode) {
    newCode = newCode.trim().toUpperCase();
    if (!newCode) return;

    setStatus("正在連結裝置...", "warn");

    // 1. 取得該金鑰的雲端資料
    const { data, error } = await client
      .from(getTableName())
      .select("sync_code, logo_text, user_name, theme, trips, quick_notes, updated_at")
      .eq("sync_code", newCode)
      .maybeSingle();

    if (error) {
      showToast("連結失敗，請檢查網路或金鑰是否正確。", "error");
      setStatus("連結失敗", "error");
      return;
    }

    // 2. 如果雲端有這組金鑰的資料
    if (data) {
      const localHasData = hasAnyLocalData();
      let confirmLink = true;
      if (localHasData) {
        confirmLink = confirm(`偵測到金鑰 ${newCode} 內已有旅程資料，是否要載入它並【覆蓋】目前本機的旅程資料？\n（注意：本機目前的資料將會被清除，此動作無法復原）`);
      }

      if (confirmLink) {
        localStorage.setItem("voyage_sync_code", newCode);
        applyRemoteState(data);
        window.voyageApp?.rehydrateAndRender?.();
        showToast("連結成功！已載入雲端資料。", "success");
      }
    } else {
      // 3. 如果雲端沒有這組金鑰（全新金鑰），問使用者是否要把目前本機的資料用這組金鑰上傳
      const confirmCreate = confirm(`雲端查無金鑰 ${newCode} 的資料。您是否要以此金鑰建立新備份，並將目前的旅程資料推上雲端？`);
      if (confirmCreate) {
        localStorage.setItem("voyage_sync_code", newCode);
        await pushState();
        showToast(`已成功建立金鑰 ${newCode} 並上傳本機資料！`, "success");
      }
    }
    updateUi();
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
    const syncCode = localStorage.getItem("voyage_sync_code") || "";
    ui.codeDisplay.value = syncCode;
    ui.emailInput.value = "";
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
    openAuthModal();
  }

  async function handleCodeSubmit(event) {
    event.preventDefault();
    const newCode = ui.emailInput.value.trim().toUpperCase();
    if (!newCode) return;

    await ensureClient();
    await linkDevice(newCode);
    closeAuthModal();
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
          <button type="button" class="btn btn-secondary cloud-sync-btn" id="cloud-auth-btn">金鑰同步</button>
          <button type="button" class="btn btn-secondary cloud-sync-btn" id="cloud-sync-now-btn" hidden>立即同步</button>
          <button type="button" class="btn btn-secondary cloud-sync-btn" id="cloud-install-btn" hidden>安裝 App</button>
        </div>
      </div>
    `;
    headerActions.insertBefore(shell, headerActions.firstChild);

    const overlay = document.createElement("div");
    overlay.className = "cloud-auth-overlay";
    overlay.innerHTML = `
      <div class="cloud-auth-modal glass" style="max-width: 460px;">
        <h3>金鑰碼雲端同步</h3>
        <p style="font-size: 0.88rem; margin-bottom: 1.25rem; color: var(--text-secondary);">不需要帳號密碼，只要輸入或複製下方金鑰，即可在多個裝置間同步您的旅遊小本本！</p>
        
        <div style="background: var(--bg-body); border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem; border: 1px dashed var(--accent-color);">
          <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">🔑 這台裝置的金鑰：</label>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <input type="text" class="cloud-auth-input" id="cloud-sync-code-display" readonly style="margin: 0; font-family: monospace; font-weight: bold; letter-spacing: 1px; background: rgba(0,0,0,0.05); text-align: center; font-size: 1.1rem; border-color: var(--border-color); color: var(--accent-color);">
            <button type="button" class="btn btn-secondary" id="cloud-copy-code-btn" style="padding: 0.5rem 1rem; flex-shrink: 0;">複製</button>
          </div>
        </div>

        <form class="cloud-auth-form" id="cloud-auth-form">
          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label for="cloud-auth-code" style="font-size: 0.85rem; font-weight: 600; display: block; margin-bottom: 0.5rem;">🔗 連結其他裝置的金鑰：</label>
            <input type="text" class="cloud-auth-input" id="cloud-auth-code" placeholder="例如: VOYAGE-XXXX-XXXX" autocomplete="off" required style="text-transform: uppercase; font-family: monospace; text-align: center; font-size: 1.1rem; letter-spacing: 1px;">
          </div>
          <div class="cloud-auth-footer" style="display: flex; gap: 0.75rem; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" id="cloud-auth-cancel">取消</button>
            <button type="submit" class="btn btn-primary">確認連結</button>
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
      emailInput: overlay.querySelector("#cloud-auth-code"),
      cancelBtn: overlay.querySelector("#cloud-auth-cancel"),
      codeDisplay: overlay.querySelector("#cloud-sync-code-display"),
      copyBtn: overlay.querySelector("#cloud-copy-code-btn")
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
    ui.emailForm.addEventListener("submit", handleCodeSubmit);
    ui.cancelBtn.addEventListener("click", closeAuthModal);
    ui.copyBtn.addEventListener("click", () => {
      const code = ui.codeDisplay.value;
      navigator.clipboard.writeText(code).then(() => {
        showToast("已複製同步金鑰至剪貼簿！", "success");
      }).catch(() => {
        showToast("複製失敗，請手動複製。", "warn");
      });
    });
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

  function hasAnyLocalData() {
    const trips = safeParse(localStorage.getItem("voyage_trips"), []);
    const notes = safeParse(localStorage.getItem("voyage_quick_notes"), []);
    const userName = localStorage.getItem("voyage_user_name");
    const logoText = localStorage.getItem("voyage_logo_text");
    const theme = localStorage.getItem("theme");

    if (trips.length > 0) return true;
    if (notes.length > 0) return true;
    if (userName && userName !== DEFAULTS.userName) return true;
    if (logoText && logoText !== DEFAULTS.logoText) return true;
    if (theme && theme !== DEFAULTS.theme) return true;

    return false;
  }

  async function hydrateBeforeAppStart() {
    patchLocalStorage();
    if (!localStorage.getItem(LOCAL_EDIT_AT_KEY)) {
      if (hasAnyLocalData()) {
        touchLocalEditAt();
      } else {
        originalSetItem.call(localStorage, LOCAL_EDIT_AT_KEY, new Date(0).toISOString());
      }
    }

    if (!hasCloudConfig()) {
      return;
    }

    await ensureClient();

    const remoteState = await fetchRemoteState();
    if (remoteState && shouldApplyRemoteState(remoteState)) {
      applyRemoteState(remoteState);
    } else {
      await pushState({ silent: true });
    }
  }

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

  window.addEventListener("online", () => {
    pullRemoteState({ silent: true, skipToast: true });
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      pullRemoteState({ silent: true, skipToast: true });
    }
  });

  window.addEventListener("focus", () => {
    pullRemoteState({ silent: true, skipToast: true });
  });

  window.addEventListener("pageshow", () => {
    pullRemoteState({ silent: true, skipToast: true });
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
