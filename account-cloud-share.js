const INVALID_SHARE_MESSAGE = "這份旅程邀請已失效，請向旅程建立者索取新連結。";
const TEMPORARY_SHARE_MESSAGE = "目前無法連線讀取旅程，請確認網路後重新整理。";

function createClient() {
  const config = window.VOYAGE_SUPABASE_CONFIG || {};
  const key = config.publishableKey || config.anonKey;
  if (!window.supabase?.createClient || !config.url || !key) return null;
  return window.supabase.createClient(config.url, key);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMinorUnits(value, currency = "TWD") {
  const minor = Number(value);
  if (!Number.isSafeInteger(minor)) return "";
  const digits = ["JPY", "KRW"].includes(currency) ? 0 : 2;
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(minor / (digits === 0 ? 1 : 100));
}

function renderSimpleList(items, emptyText) {
  if (!Array.isArray(items) || items.length === 0) {
    return `<p class="guest-share-muted">${escapeHtml(emptyText)}</p>`;
  }
  return `<ul class="guest-share-list">${items.map(item => `
    <li class="${item?.checked ? "is-done" : ""}">
      <span>${item?.checked ? "✓" : "○"}</span>
      <span>${escapeHtml(item?.name || item?.text || item?.title || "")}</span>
    </li>
  `).join("")}</ul>`;
}

function parseExpiry(days) {
  const count = Number(days);
  if (!Number.isFinite(count) || count <= 0) return null;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + count);
  return expiresAt.toISOString();
}

function formatRefreshTime(date = new Date()) {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function getGuestTripSignature(result) {
  return JSON.stringify({
    revision: result?.revision ?? null,
    trip: result?.trip ?? null
  });
}

export function createGuestShareManager(client) {
  if (!client?.rpc) throw new TypeError("supabase_client_required");

  return Object.freeze({
    async create(tripId, {
      expiresAt = null,
      includeAlternatives = true,
      includeChecklists = false,
      includeBudget = false,
      includeLedger = false,
      includeVouchers = false
    } = {}) {
      const { data, error } = await client.rpc("create_guest_readonly_share", {
        target_trip_id: tripId,
        share_expires_at: expiresAt,
        share_alternatives: includeAlternatives,
        share_checklists: includeChecklists,
        share_budget: includeBudget,
        share_ledger: includeLedger,
        share_vouchers: includeVouchers
      });
      if (error) throw error;
      if (!data?.token || !/^[0-9a-f]{64}$/.test(data.token)) {
        throw new Error("share_token_missing");
      }
      return data;
    },

    async status(tripId) {
      const { data, error } = await client.rpc("get_guest_readonly_share_status", {
        target_trip_id: tripId
      });
      if (error) throw error;
      return data;
    },

    async revoke(tripId) {
      const { error } = await client.rpc("revoke_guest_readonly_share", {
        target_trip_id: tripId
      });
      if (error) throw error;
    },

    async read(token) {
      if (!/^[0-9a-f]{64}$/.test(String(token || ""))) {
        return { ok: false, error: "invalid_or_expired" };
      }
      const { data, error } = await client.rpc("get_trip_by_guest_readonly_token", {
        raw_token: token
      });
      if (error) return { ok: false, error: "temporarily_unavailable", retryable: true };
      return data;
    }
  });
}

function renderGuestTrip(result, refreshStatus = "") {
  const trip = result.trip || {};
  const days = Array.isArray(trip.itinerary?.days) ? trip.itinerary.days : [];
  const alternatives = trip.alternativeSpots || {};
  const sights = Array.isArray(alternatives.sights) ? alternatives.sights : [];
  const restaurants = Array.isArray(alternatives.restaurants) ? alternatives.restaurants : [];
  const checklists = trip.checklists || {};
  const budget = Array.isArray(trip.budget) ? trip.budget : [];
  const ledger = trip.ledger || {};
  const ledgerEntries = Array.isArray(ledger.entries) ? ledger.entries : [];
  const settlements = Array.isArray(ledger.settlements) ? ledger.settlements : [];
  const vouchers = Array.isArray(trip.vouchers) ? trip.vouchers : [];

  const dayHtml = days.map((day, index) => {
    const items = Array.isArray(day.items) ? day.items : [];
    const itemHtml = items.map(item => `
      <article class="guest-share-item">
        <time>${escapeHtml(item.time || "")}</time>
        <div>
          <h4>${escapeHtml(item.title || "未命名行程")}</h4>
          ${item.content ? `<p>${escapeHtml(item.content)}</p>` : ""}
          ${item.address ? `<p class="guest-share-muted">📍 ${escapeHtml(item.address)}</p>` : ""}
        </div>
      </article>
    `).join("");
    return `
      <section class="guest-share-day">
        <h2>DAY ${escapeHtml(day.dayNum || index + 1)}　${escapeHtml(day.theme || "")}</h2>
        ${day.date ? `<p class="guest-share-muted">${escapeHtml(day.date)}</p>` : ""}
        ${day.desc ? `<p>${escapeHtml(day.desc)}</p>` : ""}
        <div class="guest-share-timeline">${itemHtml || "<p>這一天尚未安排行程。</p>"}</div>
      </section>
    `;
  }).join("");

  const alternativeHtml = [...sights, ...restaurants].map(item => `
    <article class="guest-share-alt">
      <h4>${escapeHtml(item.name || "未命名備案")}</h4>
      <p>${escapeHtml(item.subtype || "")}</p>
      ${item.hours ? `<p>營業時間：${escapeHtml(item.hours)}</p>` : ""}
      ${item.address ? `<p>地址：${escapeHtml(item.address)}</p>` : ""}
    </article>
  `).join("");

  const budgetHtml = budget.map(item => `
    <article class="guest-share-row">
      <div>
        <strong>${escapeHtml(item.name || "未命名支出")}</strong>
        <p class="guest-share-muted">${escapeHtml(item.day || "")} ${escapeHtml(item.category || "")}</p>
      </div>
      <span>NT$ ${Number(item.cost || 0).toLocaleString("zh-TW")}</span>
    </article>
  `).join("");

  const ledgerHtml = ledgerEntries.map(entry => {
    const participant = entry.kind === "borrowing"
      ? `${entry.borrower || ""} 向 ${entry.lender || ""} 借款`
      : entry.kind === "repayment"
        ? `${entry.payer || ""} 還款給 ${entry.receiver || ""}`
        : `${entry.payer || ""} 付款`;
    return `
      <article class="guest-share-row">
        <div>
          <strong>${escapeHtml(entry.title || participant || "帳本紀錄")}</strong>
          <p class="guest-share-muted">${escapeHtml(participant)}</p>
        </div>
        <span>${escapeHtml(formatMinorUnits(Number(entry.amount_minor), entry.currency))}</span>
      </article>
    `;
  }).join("");

  const settlementHtml = settlements.map(item => `
    <article class="guest-share-row">
      <strong>${escapeHtml(item.payer)} → ${escapeHtml(item.receiver)}</strong>
      <span>${escapeHtml(formatMinorUnits(Number(item.amount_minor), item.currency))}</span>
    </article>
  `).join("");

  const voucherHtml = vouchers.map(item => `
    <article class="guest-share-alt">
      <h4>${escapeHtml(item.title || "未命名票券")}</h4>
      <p>${escapeHtml(item.category || "")}</p>
      ${item.date ? `<p class="guest-share-muted">${escapeHtml(item.date)}</p>` : ""}
      <p class="guest-share-muted">為保護隱私，檔案、QR Code、連結及備註不公開。</p>
    </article>
  `).join("");

  const root = document.getElementById("guest-readonly-root");
  root.innerHTML = `
    <main class="guest-share-page">
      <header class="guest-share-hero">
        <div class="guest-share-hero-toolbar">
          <span class="guest-share-badge">訪客唯讀模式</span>
          <div class="guest-share-refresh">
            <button type="button" class="btn btn-secondary guest-share-refresh-button">重新整理最新行程</button>
            <span class="guest-share-refresh-status" role="status">${escapeHtml(refreshStatus)}</span>
          </div>
        </div>
        <h1>${escapeHtml(trip.title || "旅程")}</h1>
        <p>${escapeHtml(trip.location || "")}</p>
        <p>${escapeHtml(trip.dateRange || trip.date || "")}</p>
        ${trip.companion ? `<p>旅伴：${escapeHtml(trip.companion)}</p>` : ""}
      </header>
      ${dayHtml || '<section class="guest-share-day"><p>目前尚未安排行程。</p></section>'}
      ${result.include_alternatives && alternativeHtml ? `
        <section class="guest-share-day">
          <h2>備案庫</h2>
          <div class="guest-share-alt-grid">${alternativeHtml}</div>
        </section>
      ` : ""}
      ${result.include_checklists ? `
        <section class="guest-share-day">
          <h2>行李與待辦</h2>
          <div class="guest-share-columns">
            <div><h3>行李清單</h3>${renderSimpleList(checklists.packingList, "尚無行李項目")}</div>
            <div><h3>待辦事項</h3>${renderSimpleList(checklists.todoList, "尚無待辦事項")}</div>
            <div><h3>購物願望</h3>${renderSimpleList(checklists.wishlist, "尚無購物願望")}</div>
          </div>
        </section>
      ` : ""}
      ${result.include_budget ? `
        <section class="guest-share-day">
          <h2>旅行預算摘要</h2>
          ${budgetHtml || '<p class="guest-share-muted">尚無預算資料。</p>'}
        </section>
      ` : ""}
      ${result.include_ledger ? `
        <section class="guest-share-day">
          <h2>小二帳本</h2>
          <h3>帳本紀錄</h3>
          ${ledgerHtml || '<p class="guest-share-muted">尚無帳本紀錄。</p>'}
          <h3>目前結算</h3>
          ${settlementHtml || '<p class="guest-share-muted">目前已結清，沒有待還款項。</p>'}
        </section>
      ` : ""}
      ${result.include_vouchers ? `
        <section class="guest-share-day">
          <h2>票券與憑證摘要</h2>
          <div class="guest-share-alt-grid">${voucherHtml || '<p class="guest-share-muted">尚無票券摘要。</p>'}</div>
        </section>
      ` : ""}
      <footer>此頁僅供閱讀，無法新增、修改或刪除旅程。</footer>
    </main>
  `;
  root.hidden = false;
  document.body.classList.add("guest-readonly-active");
}

function showInvalidShare(text = INVALID_SHARE_MESSAGE) {
  const overlay = document.getElementById("guest-invalid-overlay");
  const message = document.getElementById("guest-invalid-msg");
  if (message) message.textContent = text;
  if (overlay) overlay.style.display = "flex";
}

function hideInvalidShare() {
  const overlay = document.getElementById("guest-invalid-overlay");
  if (overlay) overlay.style.display = "none";
}

function selectShareLinkForManualCopy(input) {
  input.focus();
  input.select();
  input.setSelectionRange?.(0, input.value.length);
}

async function copyShareLink(input) {
  const value = input?.value || "";
  if (!value) return false;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard_unavailable");
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    selectShareLinkForManualCopy(input);
    return false;
  }
}

async function initGuestReader(manager, token) {
  document.body.classList.add("guest-readonly-loading");
  let currentSignature = null;
  let lastCheckedAt = 0;
  let refreshing = false;
  let shareAvailable = true;

  const updateStatus = (text) => {
    const status = document.querySelector(".guest-share-refresh-status");
    if (status) status.textContent = text;
  };

  const setRefreshDisabled = (disabled) => {
    const button = document.querySelector(".guest-share-refresh-button");
    if (button) button.disabled = disabled;
  };

  const attachRefreshButton = () => {
    document.querySelector(".guest-share-refresh-button")
      ?.addEventListener("click", () => refresh(true));
  };

  const refresh = async (announceUnchanged = false) => {
    if (refreshing || !shareAvailable) return;
    refreshing = true;
    setRefreshDisabled(true);
    updateStatus("更新中…");
    try {
      const result = await manager.read(token);
      lastCheckedAt = Date.now();
      if (!result?.ok || !result.trip) {
        if (result?.retryable) {
          if (currentSignature === null) showInvalidShare(TEMPORARY_SHARE_MESSAGE);
          else updateStatus("暫時無法更新，將保留目前內容。");
          return;
        }
        shareAvailable = false;
        showInvalidShare();
        return;
      }

      hideInvalidShare();
      const nextSignature = getGuestTripSignature(result);
      const changed = currentSignature === null || nextSignature !== currentSignature;
      const checkedAt = formatRefreshTime();
      const statusText = changed && currentSignature !== null
        ? `已取得最新內容・${checkedAt}`
        : announceUnchanged
          ? `目前已是最新・${checkedAt}`
          : `更新於 ${checkedAt}`;

      if (changed) {
        renderGuestTrip(result, statusText);
        currentSignature = nextSignature;
        attachRefreshButton();
      } else {
        updateStatus(statusText);
      }
    } finally {
      refreshing = false;
      setRefreshDisabled(false);
      document.body.classList.remove("guest-readonly-loading");
    }
  };

  await refresh(false);
  if (!shareAvailable) return;

  window.setInterval(() => {
    if (document.visibilityState === "visible" && navigator.onLine !== false) {
      refresh(false);
    }
  }, 60_000);

  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "visible"
      && Date.now() - lastCheckedAt >= 30_000
    ) {
      refresh(false);
    }
  });

  window.addEventListener("online", () => {
    refresh(false);
  });
}

function initOwnerShare(manager) {
  const modal = document.getElementById("guest-share-modal");
  const shareButton = document.getElementById("ws-share-trip-btn");
  const generateButton = document.getElementById("share-generate-btn");
  const revokeButton = document.getElementById("share-revoke-btn");
  const linkBox = document.getElementById("share-link-result-box");
  const linkInput = document.getElementById("share-link-input");
  const alternativesInput = document.getElementById("share-scope-alternatives");
  const checklistsInput = document.getElementById("share-scope-checklists");
  const budgetInput = document.getElementById("share-scope-budget");
  const ledgerInput = document.getElementById("share-scope-ledger");
  const vouchersInput = document.getElementById("share-scope-tickets");
  const expiryInput = document.getElementById("share-expires-days");

  const getTripId = () => window.getActiveCloudTripId?.() || null;
  const close = () => modal?.classList.remove("active");

  document.getElementById("guest-share-modal-close")?.addEventListener("click", close);
  document.getElementById("guest-share-modal-cancel")?.addEventListener("click", close);

  shareButton?.addEventListener("click", async () => {
    const tripId = getTripId();
    if (!tripId) {
      window.showToast?.("請先將這趟旅程儲存到雲端，再建立分享連結。", "error");
      return;
    }
    modal?.classList.add("active");
    linkBox.style.display = "none";
    try {
      const status = await manager.status(tripId);
      revokeButton.style.display = status?.is_active ? "inline-block" : "none";
      alternativesInput.checked = status?.has_share
        ? Boolean(status.include_alternatives)
        : true;
      checklistsInput.checked = Boolean(status?.has_share && status.include_checklists);
      budgetInput.checked = Boolean(status?.has_share && status.include_budget);
      ledgerInput.checked = Boolean(status?.has_share && status.include_ledger);
      vouchersInput.checked = Boolean(status?.has_share && status.include_vouchers);
    } catch {
      close();
      window.showToast?.("目前無法讀取分享設定，請稍後再試。", "error");
    }
  });

  generateButton?.addEventListener("click", async () => {
    const tripId = getTripId();
    if (!tripId) return;
    generateButton.disabled = true;
    try {
      const result = await manager.create(tripId, {
        expiresAt: parseExpiry(expiryInput.value),
        includeAlternatives: alternativesInput.checked,
        includeChecklists: checklistsInput.checked,
        includeBudget: budgetInput.checked,
        includeLedger: ledgerInput.checked,
        includeVouchers: vouchersInput.checked
      });
      linkInput.value = `${window.location.origin}${window.location.pathname}?share=${result.token}`;
      linkBox.style.display = "block";
      revokeButton.style.display = "inline-block";
      window.showToast?.("唯讀分享連結已建立。舊連結已立即失效。", "success");
    } catch {
      window.showToast?.("建立分享連結失敗，請確認你是旅程擁有者。", "error");
    } finally {
      generateButton.disabled = false;
    }
  });

  document.getElementById("share-copy-btn")?.addEventListener("click", async () => {
    if (!linkInput.value) return;
    const copied = await copyShareLink(linkInput);
    window.showToast?.(
      copied
        ? "已複製分享連結。"
        : "瀏覽器未允許自動複製，網址已選取；請長按複製或按 Ctrl+C。",
      copied ? "success" : "info"
    );
  });

  revokeButton?.addEventListener("click", async () => {
    const tripId = getTripId();
    if (!tripId || !window.confirm("確定要停用這個分享連結嗎？")) return;
    try {
      await manager.revoke(tripId);
      linkInput.value = "";
      linkBox.style.display = "none";
      revokeButton.style.display = "none";
      window.showToast?.("分享連結已停用。", "success");
    } catch {
      window.showToast?.("停用失敗，請稍後再試。", "error");
    }
  });
}

function start() {
  const client = createClient();
  const token = new URLSearchParams(window.location.search).get("share");
  if (!client) {
    if (token) showInvalidShare();
    return;
  }
  const manager = createGuestShareManager(client);
  if (token) {
    initGuestReader(manager, token);
  } else {
    initOwnerShare(manager);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", start);
}
