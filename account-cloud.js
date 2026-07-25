(function () {
  "use strict";

  const config = window.VOYAGE_SUPABASE_CONFIG || {};
  const state = {
    client: null,
    session: null,
    trips: [],
    queuedDrafts: [],
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

  function getQueueApi() {
    return window.VoyageCloudQueue || null;
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

  function queueStatusLabel(status) {
    return {
      pending: "等待同步",
      syncing: "同步中",
      conflict: "版本衝突",
      failed: "同步失敗"
    }[status] || status;
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

  async function saveImportedTrip(tripId) {
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
      await getQueueApi()?.deleteDraft(tripId).catch(() => {});
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
      accountPanel: overlay.querySelector(".account-cloud-account"),
      accountEmail: overlay.querySelector(".account-cloud-email"),
      refreshButton: overlay.querySelector(".account-cloud-refresh"),
      signOutButton: overlay.querySelector(".account-cloud-signout"),
      message: overlay.querySelector(".account-cloud-message"),
      queueSection: overlay.querySelector(".account-cloud-queue"),
      queueList: overlay.querySelector(".account-cloud-queue-list"),
      tripList: overlay.querySelector(".account-cloud-trip-list"),
      preview: overlay.querySelector(".account-cloud-import-preview"),
      previewContent: overlay.querySelector(".account-cloud-preview-content"),
      previewCloseButton: overlay.querySelector(".account-cloud-preview-close"),
      importButton: overlay.querySelector(".account-cloud-import-confirm"),
      conflictModal: overlay.querySelector(".account-cloud-conflict-comparison"),
      conflictContent: overlay.querySelector(".account-cloud-conflict-content"),
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
    await refreshQueue();
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

  window.addEventListener("online", () => {
    refreshQueue();
    if (state.queuedDrafts.length > 0) {
      setMessage("網路已恢復；離線草稿仍保留，請確認後手動重試。");
    }
  });
})();
