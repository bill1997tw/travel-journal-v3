(function () {
  "use strict";

  const KIND_META = Object.freeze({
    place: { icon: "📍", label: "景點" },
    food: { icon: "🍜", label: "美食" },
    video: { icon: "🎬", label: "短影片" },
    article: { icon: "📖", label: "攻略文章" },
    note: { icon: "📝", label: "備忘" }
  });
  const state = {
    client: null,
    user: null,
    collections: [],
    items: [],
    selectedCollectionId: "all",
    query: "",
    view: "gallery",
    mounted: false,
    loading: false
  };
  let ui = null;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeWebUrl(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    try {
      const url = new URL(candidate);
      return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
    } catch (error) {
      return "";
    }
  }

  function parseTags(value) {
    return [...new Set(String(value || "")
      .split(/[，,]/)
      .map(tag => tag.trim())
      .filter(Boolean))]
      .slice(0, 12);
  }

  function setStatus(message = "", isError = false) {
    if (!ui?.status) return;
    ui.status.textContent = message;
    ui.status.dataset.error = String(Boolean(isError));
  }

  function showToast(message, type = "info") {
    window.voyageApp?.showToast?.(message, type);
  }

  function getClient() {
    return typeof window.getVoyageSupabaseClient === "function"
      ? window.getVoyageSupabaseClient()
      : null;
  }

  function closeModal(modal) {
    modal?.classList.remove("active");
  }

  function openModal(modal) {
    modal?.classList.add("active");
  }

  function getCollectionName(collectionId) {
    return state.collections.find(collection => collection.id === collectionId)?.name || "未分類";
  }

  function filteredItems() {
    const query = state.query.toLocaleLowerCase("zh-Hant");
    return state.items.filter(item => {
      if (state.selectedCollectionId === "unfiled" && item.collection_id) return false;
      if (state.selectedCollectionId !== "all" && state.selectedCollectionId !== "unfiled"
        && item.collection_id !== state.selectedCollectionId) return false;
      if (!query) return true;
      return [item.title, item.location, item.notes, ...(item.tags || [])]
        .join(" ")
        .toLocaleLowerCase("zh-Hant")
        .includes(query);
    });
  }

  function renderCollections() {
    if (!ui) return;
    const countFor = collectionId => state.items.filter(item => item.collection_id === collectionId).length;
    const buttons = [
      { id: "all", label: "全部收藏", count: state.items.length },
      ...state.collections.map(collection => ({
        id: collection.id,
        label: collection.name,
        count: countFor(collection.id)
      })),
      { id: "unfiled", label: "未分類", count: state.items.filter(item => !item.collection_id).length }
    ];
    ui.collectionList.innerHTML = buttons.map(item => `
      <button type="button" class="favorite-collection-button${state.selectedCollectionId === item.id ? " is-active" : ""}" data-favorite-collection="${escapeHtml(item.id)}">
        <span>${item.id === "all" ? "✦" : item.id === "unfiled" ? "○" : "▣"} ${escapeHtml(item.label)}</span>
        <small>${item.count}</small>
      </button>`).join("");
    ui.collectionList.querySelectorAll("[data-favorite-collection]").forEach(button => {
      button.addEventListener("click", () => {
        state.selectedCollectionId = button.dataset.favoriteCollection;
        render();
      });
    });
  }

  function renderCards() {
    const items = filteredItems();
    ui.grid.classList.toggle("is-list", state.view === "list");
    ui.count.textContent = `${items.length} 則收藏`;
    if (state.selectedCollectionId === "all") {
      ui.currentSubtitle.textContent = "所有收藏";
      ui.currentTitle.textContent = "旅行靈感牆";
    } else if (state.selectedCollectionId === "unfiled") {
      ui.currentSubtitle.textContent = "尚未整理";
      ui.currentTitle.textContent = "未分類收藏";
    } else {
      ui.currentSubtitle.textContent = "整理分頁";
      ui.currentTitle.textContent = getCollectionName(state.selectedCollectionId);
    }

    if (!state.user) {
      ui.grid.innerHTML = `<div class="favorites-empty"><strong>登入後即可使用私人收藏日記</strong><span>收藏只會保存在您的帳號，不會公開給旅伴。</span></div>`;
      return;
    }
    if (state.loading) {
      ui.grid.innerHTML = `<div class="favorites-empty"><strong>正在整理收藏日記…</strong><span>請稍候。</span></div>`;
      return;
    }
    if (!items.length) {
      ui.grid.innerHTML = `<div class="favorites-empty"><strong>${state.query ? "沒有符合的收藏" : "這一頁還是空的"}</strong><span>${state.query ? "換個關鍵字試試看。" : "按右上角「新增收藏」，把第一個旅行靈感放進來。"}</span></div>`;
      return;
    }

    ui.grid.innerHTML = items.map(item => {
      const meta = KIND_META[item.kind] || KIND_META.note;
      const coverUrl = safeWebUrl(item.cover_url);
      const sourceUrl = safeWebUrl(item.source_url);
      return `
        <article class="favorite-card">
          <div class="favorite-card-cover">
            ${coverUrl ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(item.title)}" loading="lazy">` : ""}
            <span class="favorite-card-kind">${meta.icon} ${meta.label}</span>
          </div>
          <div class="favorite-card-body">
            <p class="favorite-card-location">${item.location ? `📍 ${escapeHtml(item.location)}` : escapeHtml(getCollectionName(item.collection_id))}</p>
            <h3>${escapeHtml(item.title)}</h3>
            ${item.notes ? `<p class="favorite-card-notes">${escapeHtml(item.notes)}</p>` : ""}
            ${(item.tags || []).length ? `<div class="favorite-tags">${item.tags.map(tag => `<span class="favorite-tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
            <div class="favorite-card-actions">
              <button type="button" class="favorite-add-trip" data-favorite-add-trip="${escapeHtml(item.id)}">＋ 加入行程</button>
              ${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">查看來源</a>` : ""}
              <button type="button" data-favorite-edit="${escapeHtml(item.id)}">編輯</button>
              <button type="button" class="favorite-delete" data-favorite-delete="${escapeHtml(item.id)}">刪除</button>
            </div>
          </div>
        </article>`;
    }).join("");

    ui.grid.querySelectorAll("img").forEach(image => {
      image.addEventListener("error", () => image.remove(), { once: true });
    });
    ui.grid.querySelectorAll("[data-favorite-edit]").forEach(button => {
      button.addEventListener("click", () => openFavoriteModal(button.dataset.favoriteEdit));
    });
    ui.grid.querySelectorAll("[data-favorite-delete]").forEach(button => {
      button.addEventListener("click", () => deleteFavorite(button.dataset.favoriteDelete));
    });
    ui.grid.querySelectorAll("[data-favorite-add-trip]").forEach(button => {
      button.addEventListener("click", () => openTripModal(button.dataset.favoriteAddTrip));
    });
  }

  function render() {
    if (!ui) return;
    const dashboardCount = document.getElementById("dashboard-favorites-count");
    if (dashboardCount) {
      dashboardCount.textContent = state.user && state.items.length
        ? `${state.items.length} 則靈感 →`
        : "開始收藏 →";
    }
    renderCollections();
    renderCards();
  }

  function fillCollectionSelect(selectedId = "") {
    ui.collectionSelect.innerHTML = [
      `<option value="">未分類</option>`,
      ...state.collections.map(collection => `<option value="${escapeHtml(collection.id)}">${escapeHtml(collection.name)}</option>`)
    ].join("");
    ui.collectionSelect.value = selectedId || "";
  }

  function openFavoriteModal(itemId = "") {
    if (!state.user) {
      showToast("請先登入帳號再使用私人收藏。", "error");
      return;
    }
    const item = state.items.find(candidate => candidate.id === itemId);
    ui.form.reset();
    ui.favoriteId.value = item?.id || "";
    ui.title.value = item?.title || "";
    ui.kind.value = item?.kind || "place";
    fillCollectionSelect(item?.collection_id || (state.selectedCollectionId !== "all" && state.selectedCollectionId !== "unfiled" ? state.selectedCollectionId : ""));
    ui.location.value = item?.location || "";
    ui.sourceUrl.value = item?.source_url || "";
    ui.coverUrl.value = item?.cover_url || "";
    ui.tags.value = (item?.tags || []).join("、");
    ui.notes.value = item?.notes || "";
    ui.modalTitle.textContent = item ? "編輯收藏" : "新增收藏";
    openModal(ui.modal);
  }

  async function saveFavorite(event) {
    event.preventDefault();
    if (!state.client || !state.user) return;
    const rawSource = ui.sourceUrl.value.trim();
    const rawCover = ui.coverUrl.value.trim();
    const sourceUrl = safeWebUrl(rawSource);
    const coverUrl = safeWebUrl(rawCover);
    if (rawSource && !sourceUrl) {
      showToast("來源網址格式不正確，請使用 http 或 https 連結。", "error");
      return;
    }
    if (rawCover && !coverUrl) {
      showToast("封面網址格式不正確，請使用 http 或 https 連結。", "error");
      return;
    }
    const payload = {
      user_id: state.user.id,
      collection_id: ui.collectionSelect.value || null,
      title: ui.title.value.trim(),
      kind: ui.kind.value,
      source_url: sourceUrl,
      cover_url: coverUrl,
      location: ui.location.value.trim(),
      tags: parseTags(ui.tags.value),
      notes: ui.notes.value.trim(),
      updated_at: new Date().toISOString()
    };
    if (!payload.title) return;
    setStatus("正在儲存收藏…");
    const id = ui.favoriteId.value;
    const query = id
      ? state.client.from("favorite_items").update(payload).eq("id", id).eq("user_id", state.user.id)
      : state.client.from("favorite_items").insert(payload);
    const { error } = await query;
    if (error) {
      setStatus(error.message || "收藏儲存失敗。", true);
      showToast("收藏儲存失敗，請稍後再試。", "error");
      return;
    }
    closeModal(ui.modal);
    await loadData();
    showToast(id ? "收藏已更新" : "收藏已新增", "success");
  }

  async function deleteFavorite(itemId) {
    if (!state.client || !state.user || !window.confirm("確定要刪除這筆私人收藏嗎？")) return;
    const { error } = await state.client
      .from("favorite_items")
      .delete()
      .eq("id", itemId)
      .eq("user_id", state.user.id);
    if (error) {
      showToast("收藏刪除失敗。", "error");
      return;
    }
    await loadData();
    showToast("收藏已刪除", "info");
  }

  async function createCollection(event) {
    event.preventDefault();
    if (!state.client || !state.user) return;
    const name = ui.collectionName.value.trim();
    if (!name) return;
    const { error } = await state.client.from("favorite_collections").insert({
      user_id: state.user.id,
      name,
      sort_order: state.collections.length
    });
    if (error) {
      showToast(error.code === "23505" ? "這個分頁名稱已經存在。" : "分頁建立失敗。", "error");
      return;
    }
    closeModal(ui.collectionModal);
    ui.collectionForm.reset();
    await loadData();
    showToast("整理分頁已建立", "success");
  }

  function updateTripDays() {
    const targets = window.voyageApp?.getFavoriteTripTargets?.() || [];
    const trip = targets.find(item => item.id === ui.tripSelect.value);
    const duration = trip?.duration || 1;
    ui.tripDay.innerHTML = Array.from({ length: duration }, (_, index) => `<option value="${index + 1}">DAY ${index + 1}</option>`).join("");
  }

  function openTripModal(itemId) {
    const targets = window.voyageApp?.getFavoriteTripTargets?.() || [];
    if (!targets.length) {
      showToast("目前沒有可編輯的旅程，請先建立旅程或確認 Editor 權限。", "error");
      return;
    }
    ui.tripItemId.value = itemId;
    ui.tripSelect.innerHTML = targets.map(trip => `<option value="${escapeHtml(trip.id)}">${escapeHtml(trip.title)}</option>`).join("");
    updateTripDays();
    openModal(ui.tripModal);
  }

  function addToTrip(event) {
    event.preventDefault();
    const item = state.items.find(candidate => candidate.id === ui.tripItemId.value);
    const added = window.voyageApp?.addFavoriteSnapshotToTrip?.(
      ui.tripSelect.value,
      ui.tripDay.value,
      ui.tripTime.value,
      item
    );
    if (!added) {
      showToast("無法加入旅程，請重新整理後再試。", "error");
      return;
    }
    closeModal(ui.tripModal);
    showToast(`已把「${item.title}」加入 DAY ${ui.tripDay.value}`, "success");
  }

  function friendlyLoadError(error) {
    if (error?.code === "42P01" || /favorite_(items|collections)/i.test(error?.message || "")) {
      return "收藏日記的雲端資料表尚未啟用；完成本次資料庫更新後即可使用。";
    }
    return error?.message || "目前無法讀取收藏日記。";
  }

  async function loadData() {
    if (!state.client || !state.user || state.loading) {
      render();
      return;
    }
    state.loading = true;
    setStatus("正在從私人雲端載入收藏…");
    render();
    const [collectionsResult, itemsResult] = await Promise.all([
      state.client.from("favorite_collections").select("id,user_id,name,sort_order,created_at,updated_at").order("sort_order").order("created_at"),
      state.client.from("favorite_items").select("id,user_id,collection_id,title,kind,source_url,cover_url,location,tags,notes,created_at,updated_at").order("created_at", { ascending: false })
    ]);
    state.loading = false;
    const error = collectionsResult.error || itemsResult.error;
    if (error) {
      state.collections = [];
      state.items = [];
      setStatus(friendlyLoadError(error), true);
      render();
      return;
    }
    state.collections = collectionsResult.data || [];
    state.items = itemsResult.data || [];
    setStatus("私人收藏只對目前登入帳號可見。", false);
    render();
  }

  async function refreshSession() {
    state.client = getClient();
    if (!state.client) {
      setStatus("雲端帳號服務尚未連線。", true);
      render();
      return;
    }
    const { data, error } = await state.client.auth.getSession();
    if (error) {
      setStatus("無法確認登入狀態。", true);
      return;
    }
    state.user = data.session?.user || null;
    if (!state.user) {
      state.collections = [];
      state.items = [];
      setStatus("登入後即可使用私人收藏日記。", false);
      render();
      return;
    }
    await loadData();
  }

  function cacheUi() {
    ui = {
      status: document.getElementById("favorite-status"),
      grid: document.getElementById("favorite-card-grid"),
      count: document.getElementById("favorite-count"),
      currentTitle: document.getElementById("favorite-current-title"),
      currentSubtitle: document.getElementById("favorite-current-subtitle"),
      collectionList: document.getElementById("favorite-collection-list"),
      modal: document.getElementById("favorite-modal"),
      modalTitle: document.getElementById("favorite-modal-title"),
      form: document.getElementById("favorite-form"),
      favoriteId: document.getElementById("favorite-id"),
      title: document.getElementById("favorite-title"),
      kind: document.getElementById("favorite-kind"),
      collectionSelect: document.getElementById("favorite-collection"),
      location: document.getElementById("favorite-location"),
      sourceUrl: document.getElementById("favorite-source-url"),
      coverUrl: document.getElementById("favorite-cover-url"),
      tags: document.getElementById("favorite-tags"),
      notes: document.getElementById("favorite-notes"),
      collectionModal: document.getElementById("favorite-collection-modal"),
      collectionForm: document.getElementById("favorite-collection-form"),
      collectionName: document.getElementById("favorite-collection-name"),
      tripModal: document.getElementById("favorite-trip-modal"),
      tripForm: document.getElementById("favorite-trip-form"),
      tripItemId: document.getElementById("favorite-trip-item-id"),
      tripSelect: document.getElementById("favorite-trip-select"),
      tripDay: document.getElementById("favorite-trip-day"),
      tripTime: document.getElementById("favorite-trip-time")
    };
  }

  function bindEvents() {
    document.getElementById("favorite-add-btn")?.addEventListener("click", () => openFavoriteModal());
    document.getElementById("favorite-collection-add")?.addEventListener("click", () => {
      if (!state.user) {
        showToast("請先登入帳號。", "error");
        return;
      }
      openModal(ui.collectionModal);
      ui.collectionName.focus();
    });
    document.getElementById("favorite-search")?.addEventListener("input", event => {
      state.query = event.target.value.trim();
      renderCards();
    });
    document.querySelectorAll("[data-favorite-view]").forEach(button => {
      button.addEventListener("click", () => {
        state.view = button.dataset.favoriteView;
        document.querySelectorAll("[data-favorite-view]").forEach(candidate => candidate.classList.toggle("is-active", candidate === button));
        renderCards();
      });
    });
    ui.form.addEventListener("submit", saveFavorite);
    ui.collectionForm.addEventListener("submit", createCollection);
    ui.tripForm.addEventListener("submit", addToTrip);
    ui.tripSelect.addEventListener("change", updateTripDays);
    ["favorite-modal-close", "favorite-modal-cancel"].forEach(id => document.getElementById(id)?.addEventListener("click", () => closeModal(ui.modal)));
    ["favorite-collection-close", "favorite-collection-cancel"].forEach(id => document.getElementById(id)?.addEventListener("click", () => closeModal(ui.collectionModal)));
    ["favorite-trip-close", "favorite-trip-cancel"].forEach(id => document.getElementById(id)?.addEventListener("click", () => closeModal(ui.tripModal)));
  }

  async function mount() {
    if (state.mounted || !document.getElementById("view-favorites")) return;
    state.mounted = true;
    cacheUi();
    bindEvents();
    render();
    await refreshSession();
    state.client?.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id || null;
      if (nextUserId === state.user?.id) return;
      state.user = session?.user || null;
      state.collections = [];
      state.items = [];
      window.setTimeout(() => refreshSession(), 0);
    });
  }

  window.voyageFavorites = { render, reload: loadData };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
