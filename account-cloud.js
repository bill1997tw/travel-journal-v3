(function () {
  "use strict";

  const config = window.VOYAGE_SUPABASE_CONFIG || {};
  const GUEST_SESSION_KEY = "voyage_guest_session";
  const REMEMBER_ME_KEY = "voyage_auth_remember_me";
  const REMEMBERED_EMAIL_KEY = "voyage_auth_remembered_email";
  const state = {
    client: null,
    session: null,
    trips: [],
    archivedTrips: [],
    queuedDrafts: [],
    remoteUpdates: {},
    realtimeChannel: null,
    authSubscription: null,
    savingTripIds: new Set(),
    ledgerTripId: null,
    ledgerSnapshot: null,
    ledgerTestMode: false,
    lineBindingTripId: null,
    lineBindingStatus: null,
    linePairingCode: null,
    lineMemberStatus: null,
    lineMemberPairingCode: null,
    collaborationTripId: null,
    collaborationMembers: [],
    previewRole: null,
    preview: null,
    lastImportReceipt: null,
    mounted: false,
    busy: false
  };
  let ui = null;
  let autoSaveTimer = null;
  let autoSaveTripId = null;
  let autoSaveMutedUntil = 0;

  function scheduleTripSave(tripId) {
    if (!tripId) return;
    autoSaveTripId = tripId;
    window.clearTimeout(autoSaveTimer);
    autoSaveTimer = window.setTimeout(async () => {
      autoSaveTimer = null;
      const targetTripId = autoSaveTripId;
      autoSaveTripId = null;

      if (Date.now() < autoSaveMutedUntil || !state.session) return;
      if (state.busy) {
        scheduleTripSave(targetTripId);
        return;
      }

      const trip = state.trips.find((item) => item.id === targetTripId);
      const role = trip ? getRole(trip) : null;
      if (role !== "owner" && role !== "editor") return;
      await saveImportedTrip(targetTripId, { automatic: true });
    }, 1200);
  }

  function hasConfig() {
    return Boolean(config.url && (config.publishableKey || config.anonKey));
  }

  function getPublicKey() {
    return config.publishableKey || config.anonKey || "";
  }

  function getImportApi() {
    return window.VoyageCloudImport || null;
  }

  function getQueueApi() {
    return window.VoyageCloudQueue || null;
  }

  function getLedgerApi() {
    return window.VoyageCloudLedger || null;
  }

  function closeLineBinding() {
    state.lineBindingTripId = null;
    state.lineBindingStatus = null;
    state.linePairingCode = null;
    state.lineMemberStatus = null;
    state.lineMemberPairingCode = null;
    if (!ui) return;
    ui.lineBindingSection.hidden = true;
    ui.lineBindingContent.replaceChildren();
  }

  function renderLineBinding() {
    if (!ui || !state.lineBindingStatus) return;
    const trip = state.trips.find((item) => item.id === state.lineBindingTripId);
    const canManage = trip && getRole(trip) === "owner";
    const status = state.lineBindingStatus;
    const memberStatus = state.lineMemberStatus;

    ui.lineBindingTitle.textContent = `${trip?.title || "旅程"}・LINE 連動`;
    ui.lineBindingContent.innerHTML = `
      <div class="account-cloud-line-status" data-bound="${status.is_bound ? "true" : "false"}">
        <strong>${status.is_bound ? "已綁定 LINE 群組" : "尚未綁定 LINE 群組"}</strong>
        <span>${status.is_bound
          ? `${status.chat_type === "room" ? "聊天室" : "群組"}，綁定時間 ${new Date(status.bound_at).toLocaleString("zh-TW")}`
          : "先產生一次性配對碼，再貼到要連動的小二算帳群組。"}</span>
      </div>
      ${state.linePairingCode ? `
        <div class="account-cloud-line-code">
          <span>一次性配對碼（10 分鐘內有效）</span>
          <strong>${escapeHtml(state.linePairingCode)}</strong>
          <button type="button" class="btn btn-secondary account-cloud-line-copy">複製配對碼</button>
        </div>
      ` : ""}
      ${status.has_open_claim && !state.linePairingCode ? `
        <p class="account-cloud-line-note">已有尚未過期的配對碼。為了安全，舊碼不會再次顯示；請等待到期後再產生新碼。</p>
      ` : ""}
      <div class="account-cloud-line-actions">
        ${canManage && !status.is_bound && !status.has_open_claim
          ? '<button type="button" class="btn btn-primary account-cloud-line-create">產生配對碼</button>'
          : ""}
        ${canManage && status.is_bound
          ? '<button type="button" class="btn btn-secondary account-cloud-line-revoke">解除 LINE 綁定</button>'
          : ""}
      </div>
      ${status.is_bound && memberStatus ? `
        <div class="account-cloud-line-status" data-bound="${memberStatus.is_linked ? "true" : "false"}">
          <strong>${memberStatus.is_linked ? "我的 LINE 身分已連結" : "我的 LINE 身分尚未連結"}</strong>
          <span>${memberStatus.is_linked
            ? `連結時間 ${new Date(memberStatus.linked_at).toLocaleString("zh-TW")}`
            : "每位旅程成員都要用自己的帳號完成一次，系統才不會把同名成員認錯。"}</span>
        </div>
        ${state.lineMemberPairingCode ? `
          <div class="account-cloud-line-code">
            <span>我的 LINE 身分碼（10 分鐘內有效）</span>
            <strong>${escapeHtml(state.lineMemberPairingCode)}</strong>
            <button type="button" class="btn btn-secondary account-cloud-line-member-copy">複製成員連結指令</button>
          </div>
        ` : ""}
        ${!memberStatus.is_linked && !memberStatus.has_open_claim ? `
          <div class="account-cloud-line-actions">
            <button type="button" class="btn btn-primary account-cloud-line-member-create">連結我的 LINE</button>
          </div>
        ` : ""}
        ${memberStatus.has_open_claim && !state.lineMemberPairingCode ? `
          <p class="account-cloud-line-note">已有尚未過期的成員身分碼；舊碼不會再次顯示，請等待到期後再產生。</p>
        ` : ""}
      ` : ""}
      <p class="account-cloud-line-note">配對碼只能使用一次；旅遊小本本不會儲存 LINE 原始群組 ID。</p>
    `;
    ui.lineBindingSection.hidden = false;

    ui.lineBindingContent.querySelector(".account-cloud-line-create")
      ?.addEventListener("click", createLineBindingClaim);
    ui.lineBindingContent.querySelector(".account-cloud-line-revoke")
      ?.addEventListener("click", revokeLineBinding);
    ui.lineBindingContent.querySelector(".account-cloud-line-copy")
      ?.addEventListener("click", async () => {
        await navigator.clipboard.writeText(`綁定旅程 ${state.linePairingCode}`);
        setMessage("配對碼已複製，請貼到要連動的小二算帳 LINE 群組。");
      });
    ui.lineBindingContent.querySelector(".account-cloud-line-member-create")
      ?.addEventListener("click", createLineMemberClaim);
    ui.lineBindingContent.querySelector(".account-cloud-line-member-copy")
      ?.addEventListener("click", async () => {
        await navigator.clipboard.writeText(`連結成員 ${state.lineMemberPairingCode}`);
        setMessage("成員連結指令已複製，請用自己的 LINE 帳號貼到已綁定的小二群組。");
      });
  }

  async function loadLineBinding(tripId) {
    if (!state.client || !state.session || state.busy) return;
    setBusy(true);
    setMessage("");
    state.lineBindingTripId = tripId;
    state.linePairingCode = null;
    state.lineMemberPairingCode = null;
    try {
      const [bindingResult, memberResult] = await Promise.all([
        state.client.rpc("get_line_trip_binding_status", { target_trip_id: tripId }),
        state.client.rpc("get_my_line_member_link_status", { target_trip_id: tripId })
      ]);
      if (bindingResult.error) throw bindingResult.error;
      if (memberResult.error) throw memberResult.error;
      state.lineBindingStatus = bindingResult.data;
      state.lineMemberStatus = memberResult.data;
      renderLineBinding();
    } catch (error) {
      closeLineBinding();
      setMessage(error.message || "無法讀取 LINE 綁定狀態。", true);
    } finally {
      setBusy(false);
    }
  }

  async function createLineMemberClaim() {
    const tripId = state.lineBindingTripId;
    if (!tripId || state.busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await state.client.rpc("create_my_line_member_link_claim", {
        target_trip_id: tripId
      });
      if (error) throw error;
      const { data: status, error: statusError } = await state.client.rpc(
        "get_my_line_member_link_status",
        { target_trip_id: tripId }
      );
      if (statusError) throw statusError;
      state.lineMemberStatus = status;
      state.lineMemberPairingCode = data.pairing_code;
      renderLineBinding();
    } catch (error) {
      setMessage(error.message || "無法產生成員 LINE 身分碼。", true);
    } finally {
      setBusy(false);
    }
  }

  async function createLineBindingClaim() {
    const tripId = state.lineBindingTripId;
    if (!tripId || state.busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await state.client.rpc("create_line_trip_binding_claim", {
        target_trip_id: tripId
      });
      if (error) throw error;
      const { data: status, error: statusError } = await state.client.rpc(
        "get_line_trip_binding_status",
        { target_trip_id: tripId }
      );
      if (statusError) throw statusError;
      state.lineBindingStatus = status;
      state.linePairingCode = data.pairing_code;
      renderLineBinding();
    } catch (error) {
      setMessage(error.message || "無法產生 LINE 配對碼。", true);
    } finally {
      setBusy(false);
    }
  }

  async function revokeLineBinding() {
    const tripId = state.lineBindingTripId;
    if (!tripId || state.busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await state.client.rpc("revoke_line_trip_binding", {
        target_trip_id: tripId
      });
      if (error) throw error;
      const { data: status, error: statusError } = await state.client.rpc(
        "get_line_trip_binding_status",
        { target_trip_id: tripId }
      );
      if (statusError) throw statusError;
      state.lineBindingStatus = status;
      state.linePairingCode = null;
      state.lineMemberStatus = {
        is_linked: false,
        has_open_claim: false,
        linked_at: null,
        claim_expires_at: null
      };
      state.lineMemberPairingCode = null;
      renderLineBinding();
      setMessage("LINE 群組綁定已解除。");
    } catch (error) {
      setMessage(error.message || "無法解除 LINE 綁定。", true);
    } finally {
      setBusy(false);
    }
  }

  function isCloudOffline() {
    const queueApi = getQueueApi();
    if (!queueApi?.isOfflineMode) return !navigator.onLine;
    return queueApi.isOfflineMode({
      online: navigator.onLine,
      hostname: window.location.hostname,
      search: window.location.search
    });
  }

  function isRealtimeTestMode() {
    return Boolean(getQueueApi()?.isRealtimeTestMode?.({
      hostname: window.location.hostname,
      search: window.location.search
    }));
  }

  function refreshAccountCloudStyles() {
    const stylesheet = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .find((link) => link.getAttribute("href")?.split("?")[0] === "cloud-sync.css");
    if (!stylesheet) return;
    stylesheet.href = "cloud-sync.css?v=account_cloud_v10";
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

  function friendlyCloudAuthError(error) {
    const text = String(error?.message || "").toLowerCase();
    if (
      !navigator.onLine
      || text.includes("failed to fetch")
      || text.includes("network")
      || text.includes("timeout")
    ) {
      return "目前網路不穩，無法驗證登入；本機旅程仍會安全保留。";
    }
    if (text.includes("invalid login credentials")) {
      return "Email 或密碼不正確，請重新確認。";
    }
    return error?.message || "登入失敗，請稍後再試。";
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
    state.client = window.supabase.createClient(config.url, getPublicKey(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.VOYAGE_AUTH_STORAGE
      }
    });
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

  function restoreAuthPreferences() {
    if (!ui?.rememberMe || !ui?.email) return;
    ui.rememberMe.checked = localStorage.getItem(REMEMBER_ME_KEY) !== "false";
    ui.email.value = localStorage.getItem(REMEMBERED_EMAIL_KEY) || "";
  }

  function updateAuthPreferences(email) {
    const rememberMe = Boolean(ui?.rememberMe?.checked);
    localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? "true" : "false");
    if (rememberMe) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      return;
    }
    localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  }

  function maskAccountEmail(email) {
    const normalized = String(email || "").trim();
    const separatorIndex = normalized.indexOf("@");
    if (separatorIndex <= 0) return "帳號";
    const localPart = normalized.slice(0, separatorIndex);
    const domain = normalized.slice(separatorIndex + 1);
    const visibleLength = localPart.length > 2 ? 2 : 1;
    return `${localPart.slice(0, visibleLength)}***@${domain}`;
  }

  function toggleCloudPasswordVisibility() {
    if (!ui?.password || !ui?.passwordToggle) return;
    const shouldReveal = ui.password.type === "password";
    ui.password.type = shouldReveal ? "text" : "password";
    ui.passwordToggle.textContent = shouldReveal ? "隱藏" : "顯示";
    ui.passwordToggle.setAttribute("aria-label", shouldReveal ? "隱藏密碼" : "顯示密碼");
    ui.passwordToggle.setAttribute("aria-pressed", shouldReveal ? "true" : "false");
  }

  function memberDisplayName(member) {
    const profile = Array.isArray(member?.profiles)
      ? member.profiles[0]
      : member?.profiles;
    return profile?.display_name || "已註冊旅伴";
  }

  function collaborationErrorMessage(error) {
    const message = error?.message || "";
    if (message.includes("member_account_not_found")) {
      return "找不到這個信箱的帳號。請旅伴先申請帳號，再由 Owner 邀請。";
    }
    if (message.includes("trip_manage_forbidden")) {
      return "只有這趟旅程的 Owner 可以管理旅伴。";
    }
    if (message.includes("owner_role_reserved")) {
      return "Owner 身分不能透過邀請轉讓。";
    }
    return message || "旅伴權限更新失敗，請稍後再試。";
  }

  function closeCollaboration() {
    state.collaborationTripId = null;
    state.collaborationMembers = [];
    if (!ui) return;
    ui.collaborationSection.hidden = true;
    ui.collaborationContent.replaceChildren();
    ui.collaborationEmail.value = "";
  }

  function renderCollaboration() {
    if (!ui || !state.collaborationTripId) return;
    const trip = state.trips.find((item) => item.id === state.collaborationTripId);
    if (!trip || getRole(trip) !== "owner") {
      closeCollaboration();
      return;
    }

    ui.collaborationTitle.textContent = `${trip.title}・旅伴權限`;
    ui.collaborationContent.replaceChildren();

    for (const member of state.collaborationMembers) {
      const row = document.createElement("article");
      const isOwner = member.role === "owner";
      row.className = "account-cloud-collaborator";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(memberDisplayName(member))}</strong>
          <span>${isOwner ? "旅程擁有者" : "已註冊旅伴"}</span>
        </div>
        <div class="account-cloud-collaborator-actions">
          ${isOwner ? `
            <span class="account-cloud-role" data-role="owner">擁有者</span>
          ` : `
            <label>
              權限
              <select class="account-cloud-collaborator-role" data-user-id="${escapeHtml(member.user_id)}">
                <option value="editor" ${member.role === "editor" ? "selected" : ""}>可編輯</option>
                <option value="viewer" ${member.role === "viewer" ? "selected" : ""}>僅查看</option>
              </select>
            </label>
            <button type="button" class="btn btn-secondary account-cloud-collaborator-remove" data-user-id="${escapeHtml(member.user_id)}">
              移除
            </button>
          `}
        </div>
      `;
      ui.collaborationContent.appendChild(row);
    }

    ui.collaborationSection.hidden = false;
    for (const select of ui.collaborationContent.querySelectorAll(".account-cloud-collaborator-role")) {
      select.addEventListener("change", () => updateCollaboratorRole(select.dataset.userId, select.value));
    }
    for (const button of ui.collaborationContent.querySelectorAll(".account-cloud-collaborator-remove")) {
      button.addEventListener("click", () => removeCollaborator(button.dataset.userId));
    }
  }

  async function loadCollaboration(tripId, options = {}) {
    const trip = state.trips.find((item) => item.id === tripId);
    if (!state.client || !state.session || !trip || getRole(trip) !== "owner" || state.busy) return;
    setBusy(true);
    if (!options.preserveMessage) setMessage("");
    state.collaborationTripId = tripId;
    try {
      const { data, error } = await state.client
        .from("trip_members")
        .select("trip_id, user_id, role, joined_at, profiles(display_name, avatar_url)")
        .eq("trip_id", tripId)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      state.collaborationMembers = data || [];
      renderCollaboration();
    } catch (error) {
      closeCollaboration();
      setMessage(collaborationErrorMessage(error), true);
    } finally {
      setBusy(false);
    }
  }

  async function inviteCollaborator(event) {
    event.preventDefault();
    const tripId = state.collaborationTripId;
    const email = ui.collaborationEmail.value.trim();
    const role = ui.collaborationRole.value;
    if (!tripId || !email || state.busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await state.client.rpc("add_trip_member_by_email", {
        target_trip_id: tripId,
        member_email: email,
        member_role: role
      });
      if (error) throw error;
      ui.collaborationEmail.value = "";
      setMessage(`已加入旅伴，權限為「${roleLabel(role)}」。`);
    } catch (error) {
      setMessage(collaborationErrorMessage(error), true);
      return;
    } finally {
      setBusy(false);
    }
    await loadCollaboration(tripId, { preserveMessage: true });
  }

  async function updateCollaboratorRole(userId, role) {
    const tripId = state.collaborationTripId;
    if (!tripId || !userId || state.busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await state.client
        .from("trip_members")
        .update({ role })
        .eq("trip_id", tripId)
        .eq("user_id", userId);
      if (error) throw error;
      setMessage(`旅伴權限已改為「${roleLabel(role)}」。`);
    } catch (error) {
      setMessage(collaborationErrorMessage(error), true);
    } finally {
      setBusy(false);
    }
    await loadCollaboration(tripId, { preserveMessage: true });
  }

  async function removeCollaborator(userId) {
    const tripId = state.collaborationTripId;
    const member = state.collaborationMembers.find((item) => item.user_id === userId);
    if (!tripId || !member || member.role === "owner" || state.busy) return;
    if (!window.confirm(`確定移除旅伴「${memberDisplayName(member)}」？移除後對方將無法再看到這趟旅程。`)) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await state.client
        .from("trip_members")
        .delete()
        .eq("trip_id", tripId)
        .eq("user_id", userId);
      if (error) throw error;
      setMessage("旅伴已移除。");
    } catch (error) {
      setMessage(collaborationErrorMessage(error), true);
    } finally {
      setBusy(false);
    }
    await loadCollaboration(tripId, { preserveMessage: true });
  }

  function queueStatusLabel(status) {
    return {
      pending: "等待同步",
      syncing: "同步中",
      conflict: "版本衝突",
      failed: "同步失敗"
    }[status] || status;
  }

  function cloudStateMeta(status) {
    return {
      local_only: { label: "僅本機", tone: "neutral" },
      cloud_only: { label: "僅雲端", tone: "neutral" },
      current: { label: "已同步", tone: "current" },
      unsaved: { label: "本機有未儲存修改", tone: "unsaved" },
      queued: { label: "離線草稿等待同步", tone: "queued" },
      conflict: { label: "版本衝突", tone: "conflict" },
      failed: { label: "同步失敗", tone: "failed" },
      refresh_available: { label: "雲端有新版本", tone: "remote" },
      compare_required: { label: "遠端更新待比較", tone: "conflict" }
    }[status] || { label: status, tone: "neutral" };
  }

  function renderCloudHomeTrips() {
    const section = document.getElementById("dashboard-cloud-trips");
    const list = document.getElementById("dashboard-cloud-trips-list");
    if (!section || !list) return;

    const signedInTrips = state.session ? state.trips : [];
    window.voyageApp?.setAccessibleCloudTripCount?.(signedInTrips.length);
    section.hidden = signedInTrips.length === 0;
    list.replaceChildren();
    if (signedInTrips.length === 0) return;

    for (const trip of signedInTrips) {
      const role = getRole(trip);
      const importedTrip = findImportedTrip(trip.id);
      const canEdit = role === "owner" || role === "editor";
      const item = document.createElement("article");
      item.className = "dashboard-cloud-trip";
      item.innerHTML = `
        <div class="dashboard-cloud-trip-main">
          <strong>${escapeHtml(trip.title)}</strong>
          <span>${escapeHtml(trip.destination || "尚未設定目的地")}</span>
          <div>
            <span class="account-cloud-role" data-role="${escapeHtml(role)}">${escapeHtml(roleLabel(role))}</span>
            <span class="dashboard-cloud-trip-state">${importedTrip ? "已載入此裝置" : "雲端旅程"}</span>
          </div>
        </div>
        <div class="dashboard-cloud-trip-actions">
          ${importedTrip && canEdit ? `
            <button type="button" class="btn btn-primary dashboard-cloud-trip-open" data-local-trip-id="${escapeHtml(importedTrip.id)}">
              開啟旅程
            </button>
          ` : `
            <button type="button" class="btn ${canEdit ? "btn-primary" : "btn-secondary"} dashboard-cloud-trip-preview" data-trip-id="${escapeHtml(trip.id)}">
              ${canEdit ? "安全載入" : "查看摘要"}
            </button>
          `}
          <button type="button" class="btn btn-secondary dashboard-cloud-trip-ledger" data-trip-id="${escapeHtml(trip.id)}">
            查看帳本
          </button>
          ${canEdit ? `
            <button type="button" class="btn btn-secondary dashboard-cloud-trip-clone" data-trip-id="${escapeHtml(trip.id)}">
              複製成我的旅程
            </button>
          ` : ""}
        </div>
      `;
      list.appendChild(item);
    }

    for (const button of list.querySelectorAll(".dashboard-cloud-trip-open")) {
      button.addEventListener("click", () => window.enterWorkspace?.(button.dataset.localTripId));
    }
    for (const button of list.querySelectorAll(".dashboard-cloud-trip-preview")) {
      button.addEventListener("click", () => {
        openPanel();
        previewTrip(button.dataset.tripId);
      });
    }
    for (const button of list.querySelectorAll(".dashboard-cloud-trip-ledger")) {
      button.addEventListener("click", () => {
        openPanel();
        loadLedgerSnapshot(button.dataset.tripId);
      });
    }
    for (const button of list.querySelectorAll(".dashboard-cloud-trip-clone")) {
      button.addEventListener("click", () => {
        openPanel();
        cloneTripAsOwner(button.dataset.tripId);
      });
    }
  }

  function renderQueue() {
    if (!ui) return;
    ui.queueSection.hidden = state.queuedDrafts.length === 0;
    ui.queueList.replaceChildren();
    for (const draft of state.queuedDrafts) {
      const item = document.createElement("article");
      item.className = "account-cloud-queue-item";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(draft.title)}</strong>
          <span>base revision ${draft.baseRevision} · ${escapeHtml(queueStatusLabel(draft.status))}</span>
          ${draft.lastError ? `<small>${escapeHtml(draft.lastError)}</small>` : ""}
        </div>
        <div class="account-cloud-queue-actions">
          <button type="button" class="btn btn-primary account-cloud-queue-retry" data-trip-id="${escapeHtml(draft.tripId)}">
            立即重試
          </button>
          <button type="button" class="btn btn-secondary account-cloud-queue-discard" data-trip-id="${escapeHtml(draft.tripId)}">
            捨棄佇列草稿
          </button>
        </div>
      `;
      ui.queueList.appendChild(item);
    }
    for (const button of ui.queueList.querySelectorAll(".account-cloud-queue-retry")) {
      button.addEventListener("click", () => retryQueuedDraft(button.dataset.tripId));
    }
    for (const button of ui.queueList.querySelectorAll(".account-cloud-queue-discard")) {
      button.addEventListener("click", () => discardQueuedDraft(button.dataset.tripId));
    }
  }

  async function refreshQueue() {
    const queueApi = getQueueApi();
    if (!queueApi) {
      state.queuedDrafts = [];
      renderQueue();
      return;
    }
    try {
      state.queuedDrafts = await queueApi.listDrafts();
    } catch (error) {
      console.warn("Could not read offline draft queue.", error);
      setMessage("無法讀取離線草稿佇列；請先不要清除瀏覽器資料。", true);
    }
    renderQueue();
    renderTrips();
  }

  async function queueImportedTrip(tripId, reason) {
    const importApi = getImportApi();
    const queueApi = getQueueApi();
    const cloudTrip = state.trips.find((trip) => trip.id === tripId);
    if (!importApi || !queueApi || !cloudTrip) {
      throw new Error("offline_queue_unavailable");
    }
    const payload = importApi.prepareCloudSave(localStorage, tripId);
    const baseRevision = queueApi.resolveQueuedBaseRevision
      ? queueApi.resolveQueuedBaseRevision(payload.expectedRevision, {
        hostname: window.location.hostname,
        search: window.location.search
      })
      : payload.expectedRevision;
    await queueApi.putDraft({
      tripId,
      title: cloudTrip.title,
      baseRevision,
      schemaVersion: payload.schemaVersion,
      state: payload.state,
      status: "pending",
      lastError: reason || null
    });
    await refreshQueue();
    setMessage("本機修改已存入離線草稿佇列；不會自動覆蓋雲端，請恢復網路後手動重試。");
  }

  async function retryQueuedDraft(tripId) {
    const queueApi = getQueueApi();
    const importApi = getImportApi();
    const draft = state.queuedDrafts.find((item) => item.tripId === tripId);
    if (!queueApi || !importApi || !draft || state.busy) return;
    if (isCloudOffline()) {
      setMessage("目前仍為離線狀態，草稿會繼續保留。", true);
      return;
    }

    setBusy(true);
    state.savingTripIds.add(tripId);
    setMessage("");
    try {
      await queueApi.updateDraftStatus(tripId, "syncing", {
        retryCount: draft.retryCount,
        lastError: null
      });
      await refreshQueue();
      const { data, error } = await state.client.rpc("save_trip_document", {
        target_trip_id: tripId,
        expected_revision: draft.baseRevision,
        next_schema_version: draft.schemaVersion,
        next_state: draft.state,
        change_action: "update"
      });
      if (error) throw error;

      const savedRevision = Number(data?.revision);
      importApi.commitSavedRevision(localStorage, tripId, savedRevision);
      delete state.remoteUpdates[tripId];
      await queueApi.deleteDraft(tripId);
      window.voyageApp?.rehydrateAndRender?.();
      renderTrips();
      await refreshQueue();
      setMessage(`離線草稿已安全同步到雲端 revision ${savedRevision}。`);
    } catch (error) {
      const classification = queueApi.classifySaveError(error);
      const status = classification === "conflict" ? "conflict" : "failed";
      await queueApi.updateDraftStatus(tripId, status, {
        retryCount: draft.retryCount + 1,
        lastError: error.message || "sync_failed"
      }).catch(() => {});
      await refreshQueue();
      if (classification === "conflict") {
        setMessage("離線草稿的 base revision 已過期；草稿仍保留，請使用版本比較。", true);
        const localTrip = findImportedTrip(tripId);
        if (localTrip) openConflictComparison(tripId, localTrip);
      } else {
        setMessage("離線草稿同步失敗，草稿仍保留，可稍後手動重試。", true);
      }
    } finally {
      state.savingTripIds.delete(tripId);
      setBusy(false);
    }
  }

  async function discardQueuedDraft(tripId) {
    const queueApi = getQueueApi();
    const draft = state.queuedDrafts.find((item) => item.tripId === tripId);
    if (!queueApi || !draft || state.busy) return;
    const confirmed = queueApi.shouldAutoConfirmDiscard?.({
      hostname: window.location.hostname,
      search: window.location.search
    }) || window.confirm(
      `確定捨棄「${draft.title}」的離線同步草稿嗎？本機旅程本身不會被刪除。`
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await queueApi.deleteDraft(tripId);
      await refreshQueue();
      setMessage("已捨棄離線同步草稿；本機旅程仍完整保留。");
    } catch (error) {
      setMessage(error.message || "無法捨棄離線草稿。", true);
    } finally {
      setBusy(false);
    }
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

  function findLocalTrip(localTripId) {
    const importApi = getImportApi();
    if (!importApi || !localTripId) return null;
    try {
      return importApi
        .parseLocalTrips(localStorage.getItem("voyage_trips") || "[]")
        .find((trip) => trip?.id === localTripId) || null;
    } catch (error) {
      console.warn("Could not inspect the active local trip.", error);
      return null;
    }
  }

  function clearRemoteUpdate(tripId) {
    if (!state.remoteUpdates[tripId]) return;
    delete state.remoteUpdates[tripId];
    renderTrips();
  }

  function handleRealtimeDocumentChange(payload) {
    const importApi = getImportApi();
    const documentRecord = payload?.new;
    const tripId = documentRecord?.trip_id;
    const remoteRevision = Number(documentRecord?.revision);
    if (!importApi || !tripId || state.savingTripIds.has(tripId)) return;
    if (!state.trips.some((trip) => trip.id === tripId)) return;

    const localTrip = findImportedTrip(tripId);
    const queuedDraft = state.queuedDrafts.find((draft) => draft.tripId === tripId) || null;
    const mode = importApi.classifyRemoteUpdate(localTrip, queuedDraft, remoteRevision);
    if (mode === "ignore") return;

    const previous = state.remoteUpdates[tripId];
    if (previous && previous.revision >= remoteRevision) return;
    state.remoteUpdates[tripId] = { revision: remoteRevision, mode };
    renderTrips();
    setMessage(
      mode === "refresh_available"
        ? "雲端已有新版本；本機沒有未儲存修改，可由您決定是否重新載入。"
        : "雲端已有新版本，但本機也有修改；請先比較版本，不會自動覆蓋。",
      mode === "compare_required"
    );
  }

  function stopRealtimeUpdates() {
    if (!state.client || !state.realtimeChannel) return;
    state.client.removeChannel(state.realtimeChannel);
    state.realtimeChannel = null;
  }

  function startRealtimeUpdates() {
    stopRealtimeUpdates();
    if (!state.client || !state.session) return;
    state.realtimeChannel = state.client
      .channel(`account-trip-documents:${state.session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trip_documents"
        },
        handleRealtimeDocumentChange
      )
      .subscribe();
  }

  async function fetchRemoteCandidate(tripId) {
    const importApi = getImportApi();
    const trip = state.trips.find((item) => item.id === tripId);
    if (!importApi || !trip) throw new Error("cloud_trip_not_found");
    const { data: remoteDoc, error } = await state.client
      .from("trip_documents")
      .select("trip_id, schema_version, revision, state, updated_at")
      .eq("trip_id", tripId)
      .single();
    if (error) throw error;
    return importApi.normalizeCandidate(trip, remoteDoc).candidate;
  }

  async function cloneTripAsOwner(sourceTripId) {
    const importApi = getImportApi();
    const sourceTrip = state.trips.find((item) => item.id === sourceTripId);
    const role = sourceTrip ? getRole(sourceTrip) : null;
    if (
      !state.client
      || !state.session
      || !importApi
      || !sourceTrip
      || (role !== "owner" && role !== "editor")
      || state.busy
    ) return;

    const confirmed = window.confirm(
      `確定將「${sourceTrip.title}」複製成自己的旅程？\n\n`
      + "新副本會由目前帳號擁有，並複製行程、預算、行李、票券與備忘內容。\n"
      + "LINE 帳本交易、LINE 綁定、分享連結、旅伴權限與修改歷史不會複製；兩份旅程之後不會同步。"
    );
    if (!confirmed) return;

    setBusy(true);
    setMessage("");
    try {
      importApi.assertStorageWritable(localStorage);
      const { data, error } = await state.client.rpc("clone_trip_as_owner", {
        source_trip_id: sourceTripId
      });
      if (error) throw error;
      if (!data?.trip_id || !Number.isSafeInteger(Number(data.revision))) {
        throw new Error("trip_clone_response_invalid");
      }

      await loadTrips();
      const existingLocalTrip = findImportedTrip(data.trip_id);
      if (!existingLocalTrip) {
        const clonedCandidate = await fetchRemoteCandidate(data.trip_id);
        state.lastImportReceipt = importApi.importCandidate(
          localStorage,
          clonedCandidate
        );
        ui.undoButton.hidden = false;
        window.voyageApp?.rehydrateAndRender?.();
        renderTrips();
      }

      setMessage(
        data.created
          ? `已建立「${data.title || `${sourceTrip.title}（副本）`}」；目前帳號是新 Owner，可設定旅伴、免登入分享與 LINE 連動。`
          : "這趟旅程先前已複製完成；已載入既有的新 Owner 副本，沒有重複建立。"
      );
    } catch (error) {
      const message = error?.message || "";
      setMessage(
        message.includes("trip_clone_forbidden")
          ? "只有這趟旅程目前的 Owner 或 Editor 可以建立自己的副本。"
          : message || "無法複製旅程；原旅程與本機資料都沒有變更，請稍後再試。",
        true
      );
    } finally {
      setBusy(false);
    }
  }

  async function triggerRealtimeTestUpdate(tripId) {
    if (!isRealtimeTestMode() || state.busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { data: remoteDoc, error: readError } = await state.client
        .from("trip_documents")
        .select("trip_id, schema_version, revision, state")
        .eq("trip_id", tripId)
        .single();
      if (readError) throw readError;
      const { error: saveError } = await state.client.rpc("save_trip_document", {
        target_trip_id: tripId,
        expected_revision: remoteDoc.revision,
        next_schema_version: remoteDoc.schema_version,
        next_state: remoteDoc.state,
        change_action: "update"
      });
      if (saveError) throw saveError;
      setMessage("已送出 localhost 即時通知測試；本機版本刻意保持不變。");
    } catch (error) {
      setMessage(error.message || "即時通知測試失敗。", true);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoteUpdateAction(tripId) {
    const importApi = getImportApi();
    const notice = state.remoteUpdates[tripId];
    const localTrip = findImportedTrip(tripId);
    if (!importApi || !notice || !localTrip || state.busy) return;

    const queuedDraft = state.queuedDrafts.find((draft) => draft.tripId === tripId) || null;
    const currentMode = importApi.classifyRemoteUpdate(localTrip, queuedDraft, notice.revision);
    if (currentMode === "ignore") {
      clearRemoteUpdate(tripId);
      return;
    }
    if (currentMode === "compare_required") {
      state.remoteUpdates[tripId].mode = "compare_required";
      renderTrips();
      await openConflictComparison(tripId, localTrip);
      return;
    }

    setBusy(true);
    state.savingTripIds.add(tripId);
    setMessage("");
    try {
      const remoteCandidate = await fetchRemoteCandidate(tripId);
      const latestMode = importApi.classifyRemoteUpdate(
        findImportedTrip(tripId),
        state.queuedDrafts.find((draft) => draft.tripId === tripId) || null,
        remoteCandidate._cloud.revision
      );
      if (latestMode !== "refresh_available") {
        state.remoteUpdates[tripId] = {
          revision: remoteCandidate._cloud.revision,
          mode: latestMode
        };
        renderTrips();
        if (latestMode === "compare_required") {
          await openConflictComparison(tripId, findImportedTrip(tripId));
        }
        return;
      }
      state.lastImportReceipt = importApi.replaceImportedCandidate(
        localStorage,
        remoteCandidate
      );
      delete state.remoteUpdates[tripId];
      ui.undoButton.hidden = false;
      window.voyageApp?.rehydrateAndRender?.();
      renderTrips();
      setMessage(`已載入雲端 revision ${remoteCandidate._cloud.revision}；載入前本機版本已備份。`);
    } catch (error) {
      setMessage(error.message || "無法載入雲端最新版，本機資料未變更。", true);
    } finally {
      state.savingTripIds.delete(tripId);
      setBusy(false);
    }
  }

  function renderTrips() {
    if (!ui) return;
    renderCloudHomeTrips();
    ui.tripList.replaceChildren();
    const importApi = getImportApi();
    let localTrips = [];
    try {
      localTrips = importApi?.parseLocalTrips(localStorage.getItem("voyage_trips") || "[]") || [];
    } catch (error) {
      console.warn("Could not inspect local trips for cloud state.", error);
    }
    const localOnlyTrips = localTrips.filter((trip) => !trip?._cloud?.tripId);

    if (!state.session) {
      ui.tripList.innerHTML = '<p class="account-cloud-empty">登入後才會讀取您的雲端旅程；目前本機資料不受影響。</p>';
      return;
    }

    if (state.trips.length === 0 && state.archivedTrips.length === 0 && localOnlyTrips.length === 0) {
      ui.tripList.innerHTML = '<p class="account-cloud-empty">這個帳號目前沒有可存取的雲端旅程。</p>';
      return;
    }

    for (const trip of state.trips) {
      const role = getRole(trip);
      const importedTrip = findImportedTrip(trip.id);
      const queuedDraft = state.queuedDrafts.find((draft) => draft.tripId === trip.id) || null;
      const remoteNotice = state.remoteUpdates[trip.id] || null;
      const cloudState = remoteNotice?.mode
        || importApi?.getCloudTripState(importedTrip, queuedDraft)
        || "cloud_only";
      const stateMeta = cloudStateMeta(cloudState);
      const canSave = Boolean(importedTrip && (role === "owner" || role === "editor"));
      const item = document.createElement("article");
      item.className = "account-cloud-trip";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(trip.title)}</strong>
          <span>${escapeHtml(trip.destination || "未設定目的地")}</span>
        </div>
        <div class="account-cloud-trip-actions">
          <span class="account-cloud-trip-state" data-state="${escapeHtml(stateMeta.tone)}">${escapeHtml(stateMeta.label)}</span>
          <span class="account-cloud-role" data-role="${escapeHtml(role)}">${escapeHtml(roleLabel(role))}</span>
          <button type="button" class="btn btn-secondary account-cloud-preview" data-trip-id="${escapeHtml(trip.id)}">
            預覽匯入
          </button>
          <button type="button" class="btn btn-secondary account-cloud-ledger-open" data-trip-id="${escapeHtml(trip.id)}">
            查看帳本
          </button>
          <button type="button" class="btn btn-secondary account-cloud-line-open" data-trip-id="${escapeHtml(trip.id)}">
            LINE 連動
          </button>
          ${role === "owner" || role === "editor" ? `
            <button type="button" class="btn btn-secondary account-cloud-clone" data-trip-id="${escapeHtml(trip.id)}">
              複製成我的旅程
            </button>
          ` : ""}
          ${role === "owner" ? `
            <button type="button" class="btn btn-secondary account-cloud-collaboration-open" data-trip-id="${escapeHtml(trip.id)}">
              管理旅伴
            </button>
            <button type="button" class="btn btn-secondary account-cloud-archive" data-trip-id="${escapeHtml(trip.id)}">
              封存雲端旅程
            </button>
          ` : ""}
          ${canSave ? `
            <button type="button" class="btn btn-primary account-cloud-save" data-trip-id="${escapeHtml(trip.id)}">
              儲存本機修改
            </button>
          ` : ""}
          ${remoteNotice ? `
            <button type="button" class="btn btn-secondary account-cloud-remote-action" data-trip-id="${escapeHtml(trip.id)}">
              ${remoteNotice.mode === "refresh_available" ? "載入雲端最新版" : "比較版本"}
            </button>
          ` : ""}
          ${canSave && isRealtimeTestMode() ? `
            <button type="button" class="btn btn-secondary account-cloud-realtime-test" data-trip-id="${escapeHtml(trip.id)}">
              觸發即時測試更新
            </button>
          ` : ""}
        </div>
      `;
      ui.tripList.appendChild(item);
    }

    for (const trip of localOnlyTrips) {
      const stateMeta = cloudStateMeta("local_only");
      const item = document.createElement("article");
      item.className = "account-cloud-trip account-cloud-trip-local-only";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(trip.title || "未命名旅程")}</strong>
          <span>${escapeHtml(trip.location || "尚未設定目的地")}</span>
        </div>
        <div class="account-cloud-trip-actions">
          <span class="account-cloud-trip-state" data-state="${escapeHtml(stateMeta.tone)}">${escapeHtml(stateMeta.label)}</span>
          <button type="button" class="btn btn-primary account-cloud-promote" data-local-trip-id="${escapeHtml(trip.id)}">
            建立雲端旅程
          </button>
        </div>
      `;
      ui.tripList.appendChild(item);
    }

    if (state.archivedTrips.length > 0) {
      const heading = document.createElement("div");
      heading.className = "account-cloud-archived-heading";
      heading.innerHTML = `
        <div>
          <strong>已封存旅程</strong>
          <span>資料與帳本仍安全保留，可由 Owner 隨時復原。</span>
        </div>
      `;
      ui.tripList.appendChild(heading);

      for (const trip of state.archivedTrips) {
        const item = document.createElement("article");
        item.className = "account-cloud-trip account-cloud-trip-archived";
        item.innerHTML = `
          <div>
            <strong>${escapeHtml(trip.title)}</strong>
            <span>${escapeHtml(trip.destination || "未設定目的地")}</span>
          </div>
          <div class="account-cloud-trip-actions">
            <span class="account-cloud-trip-state" data-state="neutral">已封存</span>
            <span class="account-cloud-role" data-role="owner">擁有者</span>
            <button type="button" class="btn btn-primary account-cloud-restore" data-trip-id="${escapeHtml(trip.id)}">
              復原旅程
            </button>
          </div>
        `;
        ui.tripList.appendChild(item);
      }
    }

    for (const button of ui.tripList.querySelectorAll(".account-cloud-preview")) {
      button.addEventListener("click", () => previewTrip(button.dataset.tripId));
    }
    for (const button of ui.tripList.querySelectorAll(".account-cloud-save")) {
      button.addEventListener("click", () => saveImportedTrip(button.dataset.tripId));
    }
    for (const button of ui.tripList.querySelectorAll(".account-cloud-ledger-open")) {
      button.addEventListener("click", () => loadLedgerSnapshot(button.dataset.tripId));
    }
    for (const button of ui.tripList.querySelectorAll(".account-cloud-line-open")) {
      button.addEventListener("click", () => loadLineBinding(button.dataset.tripId));
    }
    for (const button of ui.tripList.querySelectorAll(".account-cloud-clone")) {
      button.addEventListener("click", () => cloneTripAsOwner(button.dataset.tripId));
    }
    for (const button of ui.tripList.querySelectorAll(".account-cloud-collaboration-open")) {
      button.addEventListener("click", () => loadCollaboration(button.dataset.tripId));
    }
    for (const button of ui.tripList.querySelectorAll(".account-cloud-archive")) {
      button.addEventListener("click", () => setCloudTripArchived(button.dataset.tripId, true));
    }
    for (const button of ui.tripList.querySelectorAll(".account-cloud-restore")) {
      button.addEventListener("click", () => setCloudTripArchived(button.dataset.tripId, false));
    }
    for (const button of ui.tripList.querySelectorAll(".account-cloud-remote-action")) {
      button.addEventListener("click", () => handleRemoteUpdateAction(button.dataset.tripId));
    }
    for (const button of ui.tripList.querySelectorAll(".account-cloud-realtime-test")) {
      button.addEventListener("click", () => triggerRealtimeTestUpdate(button.dataset.tripId));
    }
    for (const button of ui.tripList.querySelectorAll(".account-cloud-promote")) {
      button.addEventListener("click", () => promoteLocalTrip(button.dataset.localTripId));
    }
  }

  async function setCloudTripArchived(tripId, archived) {
    const source = archived ? state.trips : state.archivedTrips;
    const trip = source.find((item) => item.id === tripId);
    if (!state.client || !state.session || !trip || state.busy) return;

    const confirmation = archived
      ? `確定封存「${trip.title}」？\n\n封存後將停止雲端編輯，並撤銷免登入分享與 LINE 群組連動。本機副本會保留，之後仍可復原。`
      : `確定復原「${trip.title}」？\n\n旅程會重新開放雲端編輯；為了安全，原本的分享連結與 LINE 綁定不會自動恢復。`;
    if (!window.confirm(confirmation)) return;

    setBusy(true);
    setMessage("");
    try {
      const { error } = await state.client.rpc("set_trip_archived", {
        target_trip_id: tripId,
        should_archive: archived
      });
      if (error) throw error;

      delete state.remoteUpdates[tripId];
      await getQueueApi()?.deleteDraft(tripId).catch(() => {});
      if (archived && window.getActiveCloudTripId?.() === tripId) {
        window.closeWorkspace?.();
      }
      await loadTrips();
      setMessage(
        archived
          ? "雲端旅程已封存；本機副本仍保留，且不會再自動同步。"
          : "雲端旅程已復原；分享連結與 LINE 群組需要重新設定。"
      );
    } catch (error) {
      const message = error?.message || "";
      setMessage(
        message.includes("trip_owner_required")
          ? "只有這趟旅程的 Owner 可以封存或復原。"
          : message || "無法更新旅程封存狀態，請稍後再試。",
        true
      );
    } finally {
      setBusy(false);
    }
  }

  function closeLedgerSnapshot() {
    state.ledgerTripId = null;
    state.ledgerSnapshot = null;
    if (!ui) return;
    ui.ledgerSection.hidden = true;
    ui.ledgerContent.replaceChildren();
  }

  function renderLedgerSnapshot() {
    if (!ui || !state.ledgerSnapshot) return;
    const ledgerApi = getLedgerApi();
    const trip = state.trips.find((item) => item.id === state.ledgerTripId);
    const view = ledgerApi.buildViewModel(state.ledgerSnapshot);
    const settlementHtml = view.settlements.length
      ? view.settlements.map((settlement) => `
        <li>
          <strong>${escapeHtml(settlement.summary)}</strong>
          <span>${escapeHtml(settlement.amountLabel)}</span>
        </li>
      `).join("")
      : "<li class=\"account-cloud-ledger-empty\">目前已結清，沒有待還款項。</li>";
    const entryHtml = view.entries.length
      ? view.entries.map((entry) => `
        <li class="${entry.voided ? "is-voided" : ""}">
          <span class="account-cloud-ledger-kind" data-kind="${escapeHtml(entry.kind)}">${escapeHtml(entry.kindLabel)}</span>
          <div>
            <strong>${escapeHtml(entry.summary)}</strong>
            <small>${escapeHtml(new Date(entry.occurredAt).toLocaleString("zh-TW"))}${entry.voided ? "｜已作廢" : ""}</small>
          </div>
          <span>${escapeHtml(entry.amountLabel)}</span>
        </li>
      `).join("")
      : "<li class=\"account-cloud-ledger-empty\">目前沒有帳本紀錄。</li>";

    ui.ledgerTitle.textContent = `${trip?.title || "雲端旅程"}的唯讀帳本`;
    const isTestMode = ui.ledgerSection.dataset.testMode === "true";
    ui.ledgerRevision.textContent = `revision ${view.revision}${isTestMode ? "｜本機測試資料" : ""}`;
    ui.ledgerContent.innerHTML = `
      <div class="account-cloud-ledger-block">
        <h5>目前結算</h5>
        <ul class="account-cloud-ledger-settlements">${settlementHtml}</ul>
      </div>
      <div class="account-cloud-ledger-block">
        <h5>帳本紀錄</h5>
        <ul class="account-cloud-ledger-entries">${entryHtml}</ul>
      </div>
      <p class="account-cloud-ledger-note">此區只會讀取雲端帳本，不會修改旅遊小本本或雲端資料。</p>
    `;
    ui.ledgerSection.hidden = false;
  }

  async function loadLedgerSnapshot(tripId) {
    const ledgerApi = getLedgerApi();
    if (!ledgerApi || !state.client || !state.session || state.busy) {
      setMessage("唯讀帳本模組尚未就緒，請重新整理頁面後再試。", true);
      return;
    }
    setBusy(true);
    setMessage("");
    state.ledgerTripId = tripId;
    ui.ledgerSection.hidden = false;
    ui.ledgerTitle.textContent = "正在讀取唯讀帳本…";
    ui.ledgerRevision.textContent = "";
    ui.ledgerContent.innerHTML = '<p class="account-cloud-ledger-empty">讀取中，尚未修改任何資料。</p>';
    try {
      const testSnapshot = ledgerApi.getLocalhostTestSnapshot?.(window.location);
      if (testSnapshot) {
        state.ledgerSnapshot = testSnapshot;
        state.ledgerTripId = tripId;
      } else {
        const repository = ledgerApi.createRepository(state.client);
        state.ledgerSnapshot = await repository.getSnapshot(tripId);
      }
      ui.ledgerSection.dataset.testMode = testSnapshot ? "true" : "false";
      renderLedgerSnapshot();
    } catch (error) {
      state.ledgerSnapshot = null;
      ui.ledgerContent.innerHTML = '<p class="account-cloud-ledger-empty">無法讀取帳本，其他本機資料不受影響。</p>';
      setMessage(error.message || "唯讀帳本讀取失敗。", true);
    } finally {
      setBusy(false);
    }
  }

  function closePreview() {
    state.preview = null;
    state.previewRole = null;
    if (!ui) return;
    ui.preview.hidden = true;
    ui.previewContent.replaceChildren();
    ui.importButton.hidden = true;
  }

  function renderPreview(result) {
    const { summary, warnings } = result;
    const canImport = state.previewRole === "owner" || state.previewRole === "editor";
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
        ${canImport
          ? "確認後會先備份目前的本機旅程，再把這趟旅程新增到本機；不會覆蓋既有旅程。"
          : "您在這趟旅程的權限是僅查看，因此不會把內容匯入可編輯的本機工作區。"}
      </p>
    `;
    ui.importButton.hidden = !canImport;
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
      state.previewRole = getRole(trip);
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
    if (
      !state.preview
      || !importApi
      || state.busy
      || (state.previewRole !== "owner" && state.previewRole !== "editor")
    ) return;
    setBusy(true);
    setMessage("");
    try {
      state.lastImportReceipt = importApi.importCandidate(
        localStorage,
        state.preview.candidate
      );
      delete state.remoteUpdates[state.lastImportReceipt.cloudTripId];
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
      const restoredCloudTripId = state.lastImportReceipt.cloudTripId;
      importApi.restoreImport(localStorage, state.lastImportReceipt);
      window.voyageApp?.rehydrateAndRender?.();
      state.lastImportReceipt = importApi.getLatestBackupReceipt(localStorage)
        || importApi.getRecoverableImportBackupReceipt(localStorage)
        || null;
      if (restoredCloudTripId) delete state.remoteUpdates[restoredCloudTripId];
      ui.undoButton.hidden = !state.lastImportReceipt;
      renderTrips();
      setMessage("已從最近備份還原，恢復到匯入前的本機旅程。");
    } catch (error) {
      setMessage(error.message || "撤銷失敗，請保留備份並停止繼續操作。", true);
    } finally {
      setBusy(false);
    }
  }

  function downloadLocalDraft(localTrip) {
    if (!localTrip) return;
    const blob = new Blob([JSON.stringify(localTrip, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `local-draft-${localTrip.title || "trip"}-rev${localTrip._cloud?.revision || 0}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("已下載本機草稿 JSON 備份。");
  }

  async function openConflictComparison(tripId, localTrip) {
    const importApi = getImportApi();
    const trip = state.trips.find((item) => item.id === tripId);
    if (!importApi || !trip) return;

    try {
      const { data: remoteDoc, error } = await state.client
        .from("trip_documents")
        .select("trip_id, schema_version, revision, state, updated_at")
        .eq("trip_id", tripId)
        .single();
      if (error) throw error;

      const remoteCandidateResult = importApi.normalizeCandidate(trip, remoteDoc);
      const remoteCandidate = remoteCandidateResult.candidate;
      const comparison = importApi.compareTripStates(localTrip, remoteCandidate);

      if (!ui || !ui.conflictModal) return;

      ui.conflictContent.innerHTML = `
        <div class="account-cloud-conflict-header">
          <div class="account-cloud-conflict-badge">⚠️ 雲端已有新版本</div>
          <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.35rem;">
            本機版本: <strong>revision ${comparison.revisions.local}</strong> ｜ <strong>revision ${comparison.revisions.remote}</strong>
          </p>
          <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">
            為保護雙方資料不被覆蓋，請參閱下方 8 大區塊差異摘要。您可匯出本機草稿，或將雲端最新版存為獨立副本。
          </p>
        </div>

        <table class="account-cloud-conflict-table">
          <thead>
            <tr>
              <th>主要區塊</th>
              <th>本機修改草稿 (rev ${comparison.revisions.local})</th>
              <th>雲端最新紀錄 (rev ${comparison.revisions.remote})</th>
              <th>狀態</th>
            </tr>
          </thead>
          <tbody>
            ${comparison.sections.map(section => `
              <tr class="${section.hasDiff ? 'has-diff' : ''}">
                <td><strong>${escapeHtml(section.label)}</strong></td>
                <td>${escapeHtml(section.local)}</td>
                <td>${escapeHtml(section.remote)}</td>
                <td>
                  ${section.hasDiff ? `<span class="diff-tag diff">差異</span>` : `<span class="diff-tag same">一致</span>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="account-cloud-conflict-actions">
          <button type="button" class="btn btn-secondary account-cloud-export-draft">
            💾 匯出本機草稿 (JSON)
          </button>
          <button type="button" class="btn btn-primary account-cloud-import-remote-copy">
            📥 將雲端最新版存為獨立副本
          </button>
          <button type="button" class="btn btn-secondary account-cloud-conflict-close">
            ✕ 關閉並繼續在本地工作
          </button>
        </div>
      `;

      ui.conflictModal.hidden = false;

      const exportBtn = ui.conflictContent.querySelector(".account-cloud-export-draft");
      const importRemoteBtn = ui.conflictContent.querySelector(".account-cloud-import-remote-copy");
      const closeBtn = ui.conflictContent.querySelector(".account-cloud-conflict-close");

      if (exportBtn) {
        exportBtn.addEventListener("click", () => downloadLocalDraft(localTrip));
      }
      if (importRemoteBtn) {
        importRemoteBtn.addEventListener("click", () => {
          try {
            const receipt = importApi.importRemoteAsCopy(localStorage, remoteCandidate);
            window.voyageApp?.rehydrateAndRender?.();
            renderTrips();
            ui.conflictModal.hidden = true;
            setMessage(`已將雲端最新版成功新增為獨立副本：「${receipt.copyTitle}」！`);
          } catch (err) {
            setMessage(err.message || "建立雲端副本失敗。", true);
          }
        });
      }
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          ui.conflictModal.hidden = true;
          setMessage("衝突視窗已關閉；本機草稿保持不變，可隨時繼續編輯。");
        });
      }

    } catch (error) {
      setMessage(`讀取雲端最新版本失敗: ${error.message}`, true);
    }
  }

  async function saveImportedTrip(tripId, options = {}) {
    const importApi = getImportApi();
    const trip = state.trips.find((item) => item.id === tripId);
    const role = getRole(trip);
    if (!importApi || !trip || state.busy) return;
    if (role !== "owner" && role !== "editor") {
      setMessage("目前帳號沒有修改這趟旅程的權限。", true);
      return;
    }
    if (isCloudOffline()) {
      try {
        await queueImportedTrip(tripId, "offline");
      } catch (error) {
        setMessage("目前離線且無法建立持久草稿；本機修改仍保留，請勿清除瀏覽器資料。", true);
      }
      return;
    }

    setBusy(true);
    state.savingTripIds.add(tripId);
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
      delete state.remoteUpdates[tripId];
      await getQueueApi()?.deleteDraft(tripId).catch(() => {});
      autoSaveMutedUntil = Date.now() + 3000;
      window.voyageApp?.rehydrateAndRender?.();
      renderTrips();
      await refreshQueue();
      setMessage(`已安全儲存到雲端 revision ${savedRevision}。`);
    } catch (error) {
      if (error.message?.includes("trip_revision_conflict")) {
        const localTrip = findImportedTrip(tripId);
        setMessage(
          "雲端已有其他成員的新版本，本次沒有覆蓋。本機修改已安全保留，已為您開啟版本比對。",
          true
        );
        if (localTrip) {
          openConflictComparison(tripId, localTrip);
        }
      } else if (error.name === "QuotaExceededError") {
        setMessage("本機儲存空間不足，為避免版本失聯，本次沒有送出雲端修改。", true);
      } else {
        const classification = getQueueApi()?.classifySaveError(error);
        if (classification === "transient") {
          try {
            await queueImportedTrip(tripId, error.message || "network_error");
          } catch (queueError) {
            setMessage("雲端儲存失敗，且無法建立離線佇列；本機修改仍保留。", true);
          }
        } else {
          setMessage(error.message || "雲端儲存失敗，本機修改仍保留。", true);
        }
      }
    } finally {
      state.savingTripIds.delete(tripId);
      setBusy(false);
    }
  }

  async function promoteLocalTrip(localTripId) {
    const importApi = getImportApi();
    if (!state.client || !state.session || !importApi || state.busy) return;
    setBusy(true);
    setMessage("");
    try {
      importApi.assertStorageWritable(localStorage);
      const payload = importApi.prepareLocalTripPromotion(localStorage, localTripId);
      const { data, error } = await state.client.rpc("create_trip_from_local_document", {
        source_key: payload.sourceKey,
        trip_title: payload.title,
        trip_destination: payload.destination,
        trip_start_date: payload.startDate,
        trip_end_date: payload.endDate,
        trip_base_currency: payload.baseCurrency,
        document_schema_version: payload.schemaVersion,
        document_state: payload.state
      });
      if (error) throw error;
      if (!data?.trip_id || !Number.isSafeInteger(Number(data.revision))) {
        throw new Error("cloud_promotion_response_invalid");
      }

      state.lastImportReceipt = importApi.commitLocalTripPromotion(
        localStorage,
        localTripId,
        data.trip_id,
        Number(data.revision),
        Number(data.schema_version) || payload.schemaVersion
      );
      ui.undoButton.hidden = false;
      window.voyageApp?.rehydrateAndRender?.();
      await loadTrips();
      setMessage(data.created
        ? "已安全建立雲端旅程；原本本機內容完整保留，現在可以設定 LINE 連動。"
        : "已重新連回先前建立的雲端旅程，沒有建立重複旅程。");
    } catch (error) {
      setMessage(error.message || "建立雲端旅程失敗；本機資料沒有變更。", true);
    } finally {
      setBusy(false);
    }
  }

  async function openLedgerForLocalTrip(localTripId) {
    openPanel();
    const localTrip = findLocalTrip(localTripId);
    const cloudTripId = localTrip?._cloud?.tripId || null;

    if (!cloudTripId) {
      setMessage("此旅程尚未連接雲端帳本，請先在「雲端旅程」建立或匯入旅程。", true);
      return;
    }
    if (!state.session) {
      setMessage("請先登入旅遊小本本雲端帳號，登入後即可查看這個旅程的帳本。", true);
      return;
    }

    try {
      if (!state.trips.some((trip) => trip.id === cloudTripId)) {
        await loadTrips();
      }
      if (!state.trips.some((trip) => trip.id === cloudTripId)) {
        setMessage("目前登入的帳號沒有這個旅程的查看權限。", true);
        return;
      }
      await loadLedgerSnapshot(cloudTripId);
    } catch (error) {
      setMessage(error.message || "無法開啟這個旅程的帳本。", true);
    }
  }

  function renderSession() {
    if (!ui) return;
    const signedIn = Boolean(state.session);
    const maskedEmail = maskAccountEmail(state.session?.user?.email);
    const shortAccount = maskedEmail.split("@")[0];
    ui.authForm.hidden = signedIn;
    ui.accountPanel.hidden = !signedIn;
    ui.accountEmail.textContent = state.session?.user?.email || "";
    ui.authButton.textContent = signedIn ? `雲端 · ${shortAccount}` : "登入雲端";
    ui.authButton.setAttribute(
      "aria-label",
      signedIn ? `開啟 ${maskedEmail} 的雲端旅程` : "登入雲端"
    );
    setStatus(signedIn ? `${maskedEmail} 已連線` : "本機模式（資料安全保留）", signedIn ? "live" : "neutral");
    renderTrips();
    renderCloudHomeTrips();
  }

  function clearSignedOutState() {
    stopRealtimeUpdates();
    state.session = null;
    state.trips = [];
    state.archivedTrips = [];
    state.remoteUpdates = {};
    state.preview = null;
    closeLedgerSnapshot();
    closeCollaboration();
    renderSession();
  }

  function startAuthUpdates() {
    if (!state.client || state.authSubscription) return;
    const { data } = state.client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearSignedOutState();
        return;
      }
      if (event !== "SIGNED_IN" || !session?.user?.id || session.user.id === state.session?.user?.id) {
        return;
      }
      state.session = session;
      sessionStorage.removeItem(GUEST_SESSION_KEY);
      window.setTimeout(async () => {
        try {
          await loadTrips();
          startRealtimeUpdates();
          renderSession();
        } catch (error) {
          setStatus(error.message || "帳號資料重新載入失敗，請重新整理頁面。", "error");
        }
      }, 0);
    });
    state.authSubscription = data?.subscription || null;
  }

  async function loadTrips() {
    if (state.ledgerTestMode) {
      renderTrips();
      return;
    }
    if (!state.client || !state.session) {
      state.trips = [];
      state.archivedTrips = [];
      renderTrips();
      return;
    }

    const tripFields = `
        id,
        title,
        destination,
        start_date,
        end_date,
        base_currency,
        updated_at,
        archived_at,
        trip_members!inner(role, user_id)
      `;
    const [activeResult, archivedResult] = await Promise.all([
      state.client
        .from("trips")
        .select(tripFields)
        .is("archived_at", null)
        .order("updated_at", { ascending: false }),
      state.client
        .from("trips")
        .select(tripFields)
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false })
    ]);

    if (activeResult.error) throw activeResult.error;
    if (archivedResult.error) throw archivedResult.error;
    state.trips = activeResult.data || [];
    state.archivedTrips = (archivedResult.data || [])
      .filter((trip) => getRole(trip) === "owner");
    renderTrips();
  }

  function openPanel() {
    if (!ui) return;
    ui.overlay.classList.add("is-open");
    ui.overlay.setAttribute("aria-hidden", "false");
    setMessage("");
    closePreview();
    closeLedgerSnapshot();
    closeCollaboration();
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
    if (!navigator.onLine) {
      setMessage("目前處於離線狀態，無法驗證新登入；本機旅程仍可安全使用。", true);
      return;
    }
    const email = ui.email.value.trim();
    updateAuthPreferences(email);
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await state.client.auth.signInWithPassword({
        email,
        password: ui.password.value
      });
      if (error) throw error;
      state.session = data.session;
      sessionStorage.removeItem(GUEST_SESSION_KEY);
      ui.password.value = "";
      await loadTrips();
      startRealtimeUpdates();
      renderSession();
    } catch (error) {
      setMessage(friendlyCloudAuthError(error), true);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!state.client || state.busy) return;
    const accountEmail = state.session?.user?.email || "目前帳號";
    const confirmed = window.confirm(
      `確定要登出 ${accountEmail}？\n\n雲端旅程不會被刪除，這台裝置的本機資料也會保留。`
    );
    if (!confirmed) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await state.client.auth.signOut();
      if (error) throw error;
      clearSignedOutState();
      window.location.reload();
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
          本機與雲端資料分開保護；雲端旅程只會在您確認後封存，並可由 Owner 復原。
        </div>
        <form class="account-cloud-auth">
          <label>
            Email
            <input type="email" autocomplete="username" required>
          </label>
          <label>
            密碼
            <span class="account-cloud-password-field">
              <input type="password" autocomplete="current-password" required>
              <button type="button" class="account-cloud-password-toggle"
                aria-label="顯示密碼" aria-pressed="false">顯示</button>
            </span>
          </label>
          <div class="account-cloud-login-options">
            <label class="account-cloud-remember">
              <input type="checkbox" checked>
              <span>記住我</span>
            </label>
            <span>保持登入；網站不儲存密碼</span>
          </div>
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
        <section class="account-cloud-queue" hidden>
          <div class="account-cloud-queue-heading">
            <div>
              <p>持久離線草稿</p>
              <h4>等待處理的雲端修改</h4>
            </div>
          </div>
          <div class="account-cloud-queue-list"></div>
        </section>
        <div class="account-cloud-trip-list"></div>
        <section class="account-cloud-collaboration" hidden>
          <div class="account-cloud-ledger-heading">
            <div>
              <p>多人共同編輯</p>
              <h4 class="account-cloud-collaboration-title">旅伴權限</h4>
            </div>
            <button type="button" class="account-cloud-collaboration-close" aria-label="關閉旅伴權限">✕</button>
          </div>
          <p class="account-cloud-collaboration-note">
            Editor 可查看並編輯這趟旅程；Viewer 登入後只能查看。免登入旅伴請使用「免登入唯讀分享」連結。
          </p>
          <form class="account-cloud-collaboration-form">
            <label>
              旅伴的註冊信箱
              <input type="email" autocomplete="email" placeholder="friend@example.com" required>
            </label>
            <label>
              權限
              <select>
                <option value="editor">可編輯</option>
                <option value="viewer">僅查看</option>
              </select>
            </label>
            <button type="submit" class="btn btn-primary">加入旅伴</button>
          </form>
          <div class="account-cloud-collaboration-content"></div>
        </section>
        <section class="account-cloud-ledger" hidden>
          <div class="account-cloud-ledger-heading">
            <div>
              <p>小二算帳連動</p>
              <h4 class="account-cloud-ledger-title">唯讀帳本</h4>
            </div>
            <div class="account-cloud-ledger-heading-actions">
              <span class="account-cloud-ledger-revision"></span>
              <button type="button" class="btn btn-secondary account-cloud-ledger-refresh">重新整理帳本</button>
              <button type="button" class="account-cloud-ledger-close" aria-label="關閉唯讀帳本">✕</button>
            </div>
          </div>
          <div class="account-cloud-ledger-content"></div>
        </section>
        <section class="account-cloud-line-binding" hidden>
          <div class="account-cloud-ledger-heading">
            <div>
              <p>小二算帳</p>
              <h4 class="account-cloud-line-title">LINE 連動</h4>
            </div>
            <button type="button" class="account-cloud-line-close" aria-label="關閉 LINE 連動">✕</button>
          </div>
          <div class="account-cloud-line-content"></div>
        </section>
        <section class="account-cloud-import-preview" hidden>
          <div class="account-cloud-preview-heading">
            <h4>匯入前預覽</h4>
            <button type="button" class="account-cloud-preview-close" aria-label="關閉匯入預覽">✕</button>
          </div>
          <div class="account-cloud-preview-content"></div>
          <button type="button" class="btn btn-primary account-cloud-import-confirm">建立備份並新增到本機</button>
        </section>
        <section class="account-cloud-conflict-comparison" hidden>
          <div class="account-cloud-conflict-content"></div>
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
      passwordToggle: overlay.querySelector(".account-cloud-password-toggle"),
      rememberMe: overlay.querySelector(".account-cloud-remember input"),
      accountPanel: overlay.querySelector(".account-cloud-account"),
      accountEmail: overlay.querySelector(".account-cloud-email"),
      refreshButton: overlay.querySelector(".account-cloud-refresh"),
      signOutButton: overlay.querySelector(".account-cloud-signout"),
      message: overlay.querySelector(".account-cloud-message"),
      queueSection: overlay.querySelector(".account-cloud-queue"),
      queueList: overlay.querySelector(".account-cloud-queue-list"),
      tripList: overlay.querySelector(".account-cloud-trip-list"),
      collaborationSection: overlay.querySelector(".account-cloud-collaboration"),
      collaborationTitle: overlay.querySelector(".account-cloud-collaboration-title"),
      collaborationContent: overlay.querySelector(".account-cloud-collaboration-content"),
      collaborationForm: overlay.querySelector(".account-cloud-collaboration-form"),
      collaborationEmail: overlay.querySelector('.account-cloud-collaboration-form input[type="email"]'),
      collaborationRole: overlay.querySelector(".account-cloud-collaboration-form select"),
      collaborationCloseButton: overlay.querySelector(".account-cloud-collaboration-close"),
      ledgerSection: overlay.querySelector(".account-cloud-ledger"),
      ledgerTitle: overlay.querySelector(".account-cloud-ledger-title"),
      ledgerRevision: overlay.querySelector(".account-cloud-ledger-revision"),
      ledgerContent: overlay.querySelector(".account-cloud-ledger-content"),
      ledgerRefreshButton: overlay.querySelector(".account-cloud-ledger-refresh"),
      ledgerCloseButton: overlay.querySelector(".account-cloud-ledger-close"),
      lineBindingSection: overlay.querySelector(".account-cloud-line-binding"),
      lineBindingTitle: overlay.querySelector(".account-cloud-line-title"),
      lineBindingContent: overlay.querySelector(".account-cloud-line-content"),
      lineBindingCloseButton: overlay.querySelector(".account-cloud-line-close"),
      preview: overlay.querySelector(".account-cloud-import-preview"),
      previewContent: overlay.querySelector(".account-cloud-preview-content"),
      previewCloseButton: overlay.querySelector(".account-cloud-preview-close"),
      importButton: overlay.querySelector(".account-cloud-import-confirm"),
      conflictModal: overlay.querySelector(".account-cloud-conflict-comparison"),
      conflictContent: overlay.querySelector(".account-cloud-conflict-content"),
      undoButton: overlay.querySelector(".account-cloud-undo")
    };

    restoreAuthPreferences();
    ui.passwordToggle.addEventListener("click", toggleCloudPasswordVisibility);
    ui.authButton.addEventListener("click", openPanel);
    ui.closeButton.addEventListener("click", closePanel);
    ui.authForm.addEventListener("submit", signIn);
    ui.refreshButton.addEventListener("click", () => {
      setMessage("");
      loadTrips().catch((error) => setMessage(error.message, true));
    });
    ui.signOutButton.addEventListener("click", signOut);
    ui.collaborationForm.addEventListener("submit", inviteCollaborator);
    ui.collaborationCloseButton.addEventListener("click", closeCollaboration);
    ui.previewCloseButton.addEventListener("click", closePreview);
    ui.importButton.addEventListener("click", importPreview);
    ui.ledgerRefreshButton.addEventListener("click", () => {
      if (state.ledgerTripId) loadLedgerSnapshot(state.ledgerTripId);
    });
    ui.ledgerCloseButton.addEventListener("click", closeLedgerSnapshot);
    ui.lineBindingCloseButton.addEventListener("click", closeLineBinding);
    ui.undoButton.addEventListener("click", undoLastImport);
    ui.overlay.addEventListener("click", (event) => {
      if (event.target === ui.overlay) closePanel();
    });

    renderSession();
  }

  async function initialize() {
    refreshAccountCloudStyles();
    mount();
    state.lastImportReceipt = getImportApi()?.getLatestBackupReceipt(localStorage)
      || getImportApi()?.getRecoverableImportBackupReceipt(localStorage)
      || null;
    ui.undoButton.hidden = !state.lastImportReceipt;
    await refreshQueue();
    const client = ensureClient();
    if (!client) {
      setStatus("雲端設定未完成", "error");
      return;
    }
    startAuthUpdates();

    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      state.session = data.session;
      const testSnapshot = getLedgerApi()?.getLocalhostTestSnapshot?.(window.location);
      if (!state.session && testSnapshot) {
        state.ledgerTestMode = true;
        state.session = {
          user: {
            id: testSnapshot.members[0].memberId,
            email: "localhost-ledger-test@example.invalid"
          }
        };
        state.trips = [{
          id: testSnapshot.tripId,
          title: "完整帳本驗收旅程",
          destination: "localhost 測試資料",
          base_currency: "TWD",
          trip_members: [{
            role: "owner",
            user_id: testSnapshot.members[0].memberId
          }]
        }];
        renderSession();
        return;
      }
      if (state.session) {
        await loadTrips();
        startRealtimeUpdates();
      }
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
    openLedgerForLocalTrip,
    refresh: loadTrips,
    scheduleTripSave,
    getSession: () => state.session,
    getTrips: () => state.trips.map((trip) => ({ ...trip })),
    getRoleForTrip: (tripId) => {
      const trip = state.trips.find((item) => item.id === tripId);
      return trip ? getRole(trip) : null;
    }
  });

  window.addEventListener("online", () => {
    refreshQueue();
    if (state.queuedDrafts.length > 0) {
      setMessage("網路已恢復；離線草稿仍保留，請確認後手動重試。");
    }
  });
})();
