(function () {
  "use strict";

  const config = window.VOYAGE_SUPABASE_CONFIG || {};
  const state = {
    client: null,
    session: null,
    trips: [],
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

  function refreshAccountCloudStyles() {
    const stylesheet = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .find((link) => link.getAttribute("href")?.split("?")[0] === "cloud-sync.css");
    if (!stylesheet) return;
    stylesheet.href = "cloud-sync.css?v=account_cloud_v1";
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
      const item = document.createElement("article");
      item.className = "account-cloud-trip";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(trip.title)}</strong>
          <span>${escapeHtml(trip.destination || "未設定目的地")}</span>
        </div>
        <span class="account-cloud-role" data-role="${escapeHtml(role)}">${escapeHtml(roleLabel(role))}</span>
      `;
      ui.tripList.appendChild(item);
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
      tripList: overlay.querySelector(".account-cloud-trip-list")
    };

    ui.authButton.addEventListener("click", openPanel);
    ui.closeButton.addEventListener("click", closePanel);
    ui.authForm.addEventListener("submit", signIn);
    ui.refreshButton.addEventListener("click", () => {
      setMessage("");
      loadTrips().catch((error) => setMessage(error.message, true));
    });
    ui.signOutButton.addEventListener("click", signOut);
    ui.overlay.addEventListener("click", (event) => {
      if (event.target === ui.overlay) closePanel();
    });

    renderSession();
  }

  async function initialize() {
    refreshAccountCloudStyles();
    mount();
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
