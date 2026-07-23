(function () {
  "use strict";

  const config = window.VOYAGE_SUPABASE_CONFIG || {};
  const state = {
    client: null,
    session: null,
    trips: [],
    preview: null,
    lastImportReceipt: null,
    mounted: false,
    busy: false
  };
  let ui = null;

  function hasConfig() {
    return Boolean(config.url && (config.publishableKey || config.anonKey));
  }

  function getPublicKey() {
    return config.publishableKey || config.anonKey || "";
  }

  function getImportApi() {
    return window.VoyageCloudImport || null;
  }

  function refreshAccountCloudStyles() {
    const stylesheet = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .find((link) => link.getAttribute("href")?.split("?")[0] === "cloud-sync.css");
    if (!stylesheet) return;
    stylesheet.href = "cloud-sync.css?v=account_cloud_v5";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setStatus(message, tone = "neutral") {
    if (!ui) return;
    ui.status.textContent = message;
    ui.status.dataset.tone = tone;
  }

  function setMessage(message, isError = false) {
    if (!ui) return;
    ui.message.textContent = message || "";
    ui.message.dataset.error = isError ? "true" : "false";
  }

  function setBusy(nextBusy) {
    state.busy = Boolean(nextBusy);
    if (!ui) return;
    for (const button of ui.overlay.querySelectorAll("button")) {
      button.disabled = state.busy;
    }
  }

  function ensureClient() {
    if (state.client) return state.client;
    if (!hasConfig() || !window.supabase?.createClient) return null;
    state.client = window.supabase.createClient(config.url, getPublicKey());
    return state.client;
  }

  function getRole(trip) {
    const members = Array.isArray(trip.trip_members) ? trip.trip_members : [];
    return members.find((member) => member.user_id === state.session?.user?.id)?.role || "member";
  }

  function roleLabel(role) {
    return {
      owner: "擁有者",
      editor: "可編輯",
      viewer: "僅查看"
    }[role] || "成員";
  }

  function findImportedTrip(tripId) {
    const importApi = getImportApi();
    if (!importApi) return null;
    try {
      return importApi
        .parseLocalTrips(localStorage.getItem("voyage_trips") || "[]")
        .find((trip) => trip?._cloud?.tripId === tripId) || null;
    } catch (error) {
      console.warn("Could not inspect local cloud trips.", error);
      return null;
    }
  }

  function renderTrips() {
    if (!ui) return;
    ui.tripList.replaceChildren();

    if (!state.session) {
      ui.tripList.innerHTML = '<p class="account-cloud-empty">登入後才會讀取您的雲端旅程；目前本機資料不受影響。</p>';
      return;
    }

    if (state.trips.length === 0) {
      ui.tripList.innerHTML = '<p class="account-cloud-empty">這個帳號目前沒有可存取的雲端旅程。</p>';
      return;
    }

    for (const trip of state.trips) {
      const role = getRole(trip);
      const importedTrip = findImportedTrip(trip.id);
      const canSave = Boolean(importedTrip && (role === "owner" || role === "editor"));
      const item = document.createElement("article");
      item.className = "account-cloud-trip";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(trip.title)}</strong>
          <span>${escapeHtml(trip.destination || "未設定目的地")}</span>
        </div>
        <div class="account-cloud-trip-actions">
          <span class="account-cloud-role" data-role="${escapeHtml(role)}">${escapeHtml(roleLabel(role))}</span>
          <button type="button" class="btn btn-secondary account-cloud-preview" data-trip-id="${escapeHtml(trip.id)}">
            預覽匯入
          </button>
          ${canSave ? `
            <button type="button" class="btn btn-primary account-cloud-save" data-trip-id="${escapeHtml(trip.id)}">
              儲存本機修改
            </button>
          ` : ""}
        </div>
      `;
      ui.tripList.appendChild(item);
    }

    for (const button of ui.tripList.querySelectorAll(".account-cloud-preview")) {
      button.addEventListener("click", () => previewTrip(button.dataset.tripId));
    }
    for (const button of ui.tripList.querySelectorAll(".account-cloud-save")) {
      button.addEventListener("click", () => saveImportedTrip(button.dataset.tripId));
    }
  }

  function closePreview() {
    state.preview = null;
    if (!ui) return;
    ui.preview.hidden = true;
    ui.previewContent.replaceChildren();
  }

  function renderPreview(result) {
    const { summary, warnings } = result;
    ui.previewContent.innerHTML = `
      <dl class="account-cloud-preview-grid">
        <div><dt>旅程</dt><dd>${escapeHtml(summary.title)}</dd></div>
        <div><dt>目的地</dt><dd>${escapeHtml(summary.location || "未設定")}</dd></div>
        <div><dt>行程天數</dt><dd>${summary.itineraryDays}</dd></div>
        <div><dt>支出筆數</dt><dd>${summary.expenses}</dd></div>
        <div><dt>代墊筆數</dt><dd>${summary.advances}</dd></div>
        <div><dt>雲端版本</dt><dd>revision ${summary.revision}</dd></div>
      </dl>
      ${warnings.map((warning) => `<p class="account-cloud-warning">${escapeHtml(warning)}</p>`).join("")}
      <p class="account-cloud-import-note">
        確認後會先備份目前的本機旅程，再把這趟旅程新增到本機；不會覆蓋既有旅程。
      </p>
    `;
    ui.preview.hidden = false;
  }

  async function previewTrip(tripId) {
    const trip = state.trips.find((item) => item.id === tripId);
    const importApi = getImportApi();
    if (!trip || !importApi || state.busy) return;
    setBusy(true);
    setMessage("");
    closePreview();
    try {
      const { data, error } = await state.client
        .from("trip_documents")
        .select("trip_id, schema_version, revision, state, updated_at")
        .eq("trip_id", tripId)
        .single();
      if (error) throw error;
      state.preview = importApi.normalizeCandidate(trip, data);
      renderPreview(state.preview);
    } catch (error) {
      setMessage(error.message || "無法讀取這趟旅程的雲端內容。", true);
    } finally {
      setBusy(false);
    }
  }

  function importPreview() {
    const importApi = getImportApi();
    if (!state.preview || !importApi || state.busy) return;
    setBusy(true);
    setMessage("");
    try {
      state.lastImportReceipt = importApi.importCandidate(
        localStorage,
        state.preview.candidate
      );
      window.voyageApp?.rehydrateAndRender?.();
      ui.undoButton.hidden = false;
      closePreview();
      renderTrips();
      setMessage(`已安全新增旅程；本機備份：${state.lastImportReceipt.backupKey}`);
    } catch (error) {
      if (error.name === "DuplicateCloudTripError") {
        setMessage("這趟雲端旅程已匯入過；為避免覆蓋，本次沒有變更資料。", true);
      } else if (error.name === "QuotaExceededError") {
        setMessage("本機儲存空間不足，無法先建立備份，因此已取消匯入。", true);
      } else {
        setMessage(error.message || "匯入失敗，本機資料沒有變更。", true);
      }
    } finally {
      setBusy(false);
    }
  }

  function undoLastImport() {
    const importApi = getImportApi();
    if (!state.lastImportReceipt || !importApi || state.busy) return;
    setBusy(true);
    try {
      importApi.restoreImport(localStorage, state.lastImportReceipt);
      window.voyageApp?.rehydrateAndRender?.();
      state.lastImportReceipt = null;
      ui.undoButton.hidden = true;
      renderTrips();
      setMessage("已從最近備份還原，恢復到匯入前的本機旅程。");
    } catch (error) {
      setMessage(error.message || "撤銷失敗，請保留備份並停止繼續操作。", true);
    } finally {
      setBusy(false);
    }
  }

  async function saveImportedTrip(tripId) {
    const importApi = getImportApi();
    const trip = state.trips.find((item) => item.id === tripId);
    const role = getRole(trip);
    if (!importApi || !trip || state.busy) return;
    if (role !== "owner" && role !== "editor") {
      setMessage("目前帳號沒有修改這趟旅程的權限。", true);
      return;
    }
    if (!navigator.onLine) {
      setMessage("目前處於離線狀態；本機修改仍保留，恢復網路後再手動儲存。", true);
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      importApi.assertStorageWritable(localStorage);
      const payload = importApi.prepareCloudSave(localStorage, tripId);
      const { data, error } = await state.client.rpc("save_trip_document", {
        target_trip_id: payload.tripId,
        expected_revision: payload.expectedRevision,
        next_schema_version: payload.schemaVersion,
        next_state: payload.state,
        change_action: "update"
      });
      if (error) throw error;

      const savedRevision = Number(data?.revision);
      importApi.commitSavedRevision(localStorage, tripId, savedRevision);
      window.voyageApp?.rehydrateAndRender?.();
      renderTrips();
      setMessage(`已安全儲存到雲端 revision ${savedRevision}。`);
    } catch (error) {
      if (error.message?.includes("trip_revision_conflict")) {
        setMessage(
          "雲端已有其他成員的新版本，本次沒有覆蓋。本機修改仍保留，請先預覽最新雲端內容。",
          true
        );
      } else if (error.name === "QuotaExceededError") {
        setMessage("本機儲存空間不足，為避免版本失聯，本次沒有送出雲端修改。", true);
      } else {
        setMessage(error.message || "雲端儲存失敗，本機修改仍保留。", true);
      }
    } finally {
      setBusy(false);
    }
  }

  function renderSession() {
    if (!ui) return;
    const signedIn = Boolean(state.session);
    ui.authForm.hidden = signedIn;
    ui.accountPanel.hidden = !signedIn;
    ui.accountEmail.textContent = state.session?.user?.email || "";
    ui.authButton.textContent = signedIn ? "雲端旅程" : "登入雲端";
    setStatus(signedIn ? "帳號雲端已連線" : "本機模式（資料安全保留）", signedIn ? "live" : "neutral");
    renderTrips();
  }

  async function loadTrips() {
    if (!state.client || !state.session) {
      state.trips = [];
      renderTrips();
      return;
    }

    const { data, error } = await state.client
      .from("trips")
      .select(`
        id,
        title,
        destination,
        start_date,
        end_date,
        base_currency,
        updated_at,
        trip_members!inner(role, user_id)
      `)
      .is("archived_at", null)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    state.trips = data || [];
    renderTrips();
  }

  function openPanel() {
    if (!ui) return;
    ui.overlay.classList.add("is-open");
    ui.overlay.setAttribute("aria-hidden", "false");
    setMessage("");
    closePreview();
    if (state.session) {
      loadTrips().catch((error) => setMessage(error.message, true));
    } else {
      ui.email.focus();
    }
  }

  function closePanel() {
    if (!ui || state.busy) return;
    ui.overlay.classList.remove("is-open");
    ui.overlay.setAttribute("aria-hidden", "true");
  }

  async function signIn(event) {
    event.preventDefault();
    if (!state.client || state.busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await state.client.auth.signInWithPassword({
        email: ui.email.value.trim(),
        password: ui.password.value
      });
      if (error) throw error;
      state.session = data.session;
      ui.password.value = "";
      await loadTrips();
      renderSession();
    } catch (error) {
      setMessage(error.message || "登入失敗，請稍後再試。", true);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!state.client || state.busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await state.client.auth.signOut();
      if (error) throw error;
      state.session = null;
      state.trips = [];
      state.preview = null;
      renderSession();
    } catch (error) {
      setMessage(error.message || "登出失敗，請稍後再試。", true);
    } finally {
      setBusy(false);
    }
  }

  function mount() {
    if (state.mounted) return;
    const headerActions = document.querySelector(".header-actions");
    if (!headerActions) return;
    state.mounted = true;

    const shell = document.createElement("div");
    shell.className = "account-cloud-shell";
    shell.innerHTML = `
      <button type="button" class="btn btn-secondary account-cloud-open" aria-label="開啟帳號雲端">
        登入雲端
      </button>
      <span class="account-cloud-status" data-tone="neutral">本機模式（資料安全保留）</span>
    `;
    headerActions.insertBefore(shell, headerActions.firstChild);

    const overlay = document.createElement("div");
    overlay.className = "account-cloud-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <section class="account-cloud-modal glass" role="dialog" aria-modal="true" aria-labelledby="account-cloud-title">
        <div class="account-cloud-heading">
          <div>
            <p>旅遊小本本安全雲端</p>
            <h3 id="account-cloud-title">帳號與旅程</h3>
          </div>
          <button type="button" class="account-cloud-close" aria-label="關閉">✕</button>
        </div>
        <div class="account-cloud-safety">
          此階段只讀取帳號與旅程清單，不會覆蓋或刪除這台裝置的既有旅程。
        </div>
        <form class="account-cloud-auth">
          <label>
            Email
            <input type="email" autocomplete="username" required>
          </label>
          <label>
            密碼
            <input type="password" autocomplete="current-password" required>
          </label>
          <button type="submit" class="btn btn-primary">登入</button>
        </form>
        <div class="account-cloud-account" hidden>
          <div>
            <span>目前帳號</span>
            <strong class="account-cloud-email"></strong>
          </div>
          <div class="account-cloud-account-actions">
            <button type="button" class="btn btn-secondary account-cloud-refresh">重新整理</button>
            <button type="button" class="btn btn-secondary account-cloud-signout">登出</button>
          </div>
        </div>
        <div class="account-cloud-message" role="alert"></div>
        <div class="account-cloud-trip-list"></div>
        <section class="account-cloud-import-preview" hidden>
          <div class="account-cloud-preview-heading">
            <h4>匯入前預覽</h4>
            <button type="button" class="account-cloud-preview-close" aria-label="關閉匯入預覽">✕</button>
          </div>
          <div class="account-cloud-preview-content"></div>
          <button type="button" class="btn btn-primary account-cloud-import-confirm">建立備份並新增到本機</button>
        </section>
        <button type="button" class="btn btn-secondary account-cloud-undo" hidden>還原最近一次匯入前備份</button>
      </section>
    `;
    document.body.appendChild(overlay);

    ui = {
      shell,
      authButton: shell.querySelector(".account-cloud-open"),
      status: shell.querySelector(".account-cloud-status"),
      overlay,
      closeButton: overlay.querySelector(".account-cloud-close"),
      authForm: overlay.querySelector(".account-cloud-auth"),
      email: overlay.querySelector('input[type="email"]'),
      password: overlay.querySelector('input[type="password"]'),
      accountPanel: overlay.querySelector(".account-cloud-account"),
      accountEmail: overlay.querySelector(".account-cloud-email"),
      refreshButton: overlay.querySelector(".account-cloud-refresh"),
      signOutButton: overlay.querySelector(".account-cloud-signout"),
      message: overlay.querySelector(".account-cloud-message"),
      tripList: overlay.querySelector(".account-cloud-trip-list"),
      preview: overlay.querySelector(".account-cloud-import-preview"),
      previewContent: overlay.querySelector(".account-cloud-preview-content"),
      previewCloseButton: overlay.querySelector(".account-cloud-preview-close"),
      importButton: overlay.querySelector(".account-cloud-import-confirm"),
      undoButton: overlay.querySelector(".account-cloud-undo")
    };

    ui.authButton.addEventListener("click", openPanel);
    ui.closeButton.addEventListener("click", closePanel);
    ui.authForm.addEventListener("submit", signIn);
    ui.refreshButton.addEventListener("click", () => {
      setMessage("");
      loadTrips().catch((error) => setMessage(error.message, true));
    });
    ui.signOutButton.addEventListener("click", signOut);
    ui.previewCloseButton.addEventListener("click", closePreview);
    ui.importButton.addEventListener("click", importPreview);
    ui.undoButton.addEventListener("click", undoLastImport);
    ui.overlay.addEventListener("click", (event) => {
      if (event.target === ui.overlay) closePanel();
    });

    renderSession();
  }

  async function initialize() {
    refreshAccountCloudStyles();
    mount();
    state.lastImportReceipt = getImportApi()?.getLatestBackupReceipt(localStorage) || null;
    ui.undoButton.hidden = !state.lastImportReceipt;
    const client = ensureClient();
    if (!client) {
      setStatus("雲端設定未完成", "error");
      return;
    }

    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      state.session = data.session;
      if (state.session) await loadTrips();
      renderSession();
    } catch (error) {
      console.warn("Account cloud initialization failed; local mode remains available.", error);
      setStatus("雲端暫時無法連線，本機仍可使用", "error");
    }
  }

  document.addEventListener("voyage:app-ready", mount);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }

  window.voyageAccountCloud = Object.freeze({
    open: openPanel,
    refresh: loadTrips,
    getSession: () => state.session,
    getTrips: () => state.trips.map((trip) => ({ ...trip }))
  });
})();
