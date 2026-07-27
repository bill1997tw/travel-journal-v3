/**
 * 免登入唯讀分享 (Guest Read-Only Share) 前端控制模組
 */

// 產生 256-bit (32 bytes) 高強度不可預測隨機 token
export function generateRandomShareToken() {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

// 建立 Guest Share 狀態與 DOM 邏輯
export function createGuestShareManager({ supabaseClient, onTripLoaded, showToast }) {
  let currentRawToken = null;

  return {
    async loadShareStatus(tripId) {
      if (!supabaseClient || !tripId) return null;
      try {
        const { data, error } = await supabaseClient.rpc("get_guest_share_status", {
          p_trip_id: tripId
        });
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn("[GuestShare] Load status failed:", err.message);
        return null;
      }
    },

    async createOrRegenerateShare(tripId, scopes, expiresDays = null) {
      if (!supabaseClient || !tripId) throw new Error("Missing client or tripId");
      
      const rawToken = generateRandomShareToken();
      let expiresAt = null;
      if (expiresDays && Number(expiresDays) > 0) {
        const d = new Date();
        d.setDate(d.getDate() + Number(expiresDays));
        expiresAt = d.toISOString();
      }

      const { data, error } = await supabaseClient.rpc("create_guest_share", {
        p_trip_id: tripId,
        p_scopes: scopes || { itinerary: true, alternatives: true, budget: false, ledger: false, tickets: false },
        p_expires_at: expiresAt,
        p_raw_token: rawToken
      });

      if (error) throw error;
      currentRawToken = rawToken;

      const baseUrl = typeof window !== "undefined" && window.location
        ? window.location.origin + window.location.pathname
        : "https://localhost/";
      const shareUrl = `${baseUrl}?share=${rawToken}`;

      return {
        ...data,
        rawToken,
        shareUrl
      };
    },

    async revokeShare(tripId) {
      if (!supabaseClient || !tripId) throw new Error("Missing client or tripId");

      const { data, error } = await supabaseClient.rpc("revoke_guest_share", {
        p_trip_id: tripId
      });

      if (error) throw error;
      currentRawToken = null;
      return data;
    },

    async fetchTripByToken(rawToken) {
      if (!supabaseClient || !rawToken) {
        return { success: false, error: "invalid_or_expired", message: "這份旅程邀請已失效，請向旅程建立者索取新連結。" };
      }

      try {
        const { data, error } = await supabaseClient.rpc("get_trip_by_guest_token", {
          p_raw_token: rawToken
        });
        if (error) throw error;
        return data;
      } catch (err) {
        return { success: false, error: "invalid_or_expired", message: "這份旅程邀請已失效，請向旅程建立者索取新連結。" };
      }
    },

    async fetchLedgerByToken(rawToken) {
      if (!supabaseClient || !rawToken) {
        return { success: false, error: "invalid_or_expired", message: "這份旅程邀請已失效，請向旅程建立者索取新連結。" };
      }

      try {
        const { data, error } = await supabaseClient.rpc("get_ledger_snapshot_by_guest_token", {
          p_raw_token: rawToken
        });
        if (error) throw error;
        return data;
      } catch (err) {
        return { success: false, error: "not_authorized", message: "此分享未公開小二帳本內容。" };
      }
    }
  };
}

// 瀏覽器 UI 與 DOM 自動初始化綁定
export function initGuestShareUI() {
  if (typeof window === "undefined" || !document) return;

  const getClient = () => window.supabaseClient || (window.supabase && window.supabaseConfig ? window.supabase.createClient(window.supabaseConfig.url, window.supabaseConfig.anonKey) : null);
  const getActiveTripId = () => window.activeTripId || null;

  const showToast = (msg, type = "info") => {
    if (typeof window.showToast === "function") window.showToast(msg, type);
    else alert(msg);
  };

  const shareBtn = document.getElementById("ws-share-trip-btn");
  const modal = document.getElementById("guest-share-modal");
  const closeBtn = document.getElementById("guest-share-modal-close");
  const cancelBtn = document.getElementById("guest-share-modal-cancel");
  const generateBtn = document.getElementById("share-generate-btn");
  const copyBtn = document.getElementById("share-copy-btn");
  const revokeBtn = document.getElementById("share-revoke-btn");

  const resultBox = document.getElementById("share-link-result-box");
  const linkInput = document.getElementById("share-link-input");

  if (!modal) return;

  const manager = createGuestShareManager({ supabaseClient: getClient(), showToast });

  const closeModal = () => modal.classList.remove("active");

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const tripId = getActiveTripId();
      if (!tripId) {
        showToast("請先打開一趟旅程進行設定", "error");
        return;
      }

      modal.classList.add("active");
      
      const client = getClient();
      if (!client) {
        showToast("雲端服務尚未連線", "error");
        return;
      }

      const mgr = createGuestShareManager({ supabaseClient: client, showToast });
      const status = await mgr.loadShareStatus(tripId);

      if (status && status.has_share && status.is_active) {
        if (generateBtn) generateBtn.innerText = "🔄 重新產生連結";
        if (revokeBtn) revokeBtn.style.display = "inline-block";
        if (status.scopes) {
          const s = status.scopes;
          document.getElementById("share-scope-itinerary").checked = !!s.itinerary;
          document.getElementById("share-scope-alternatives").checked = !!s.alternatives;
          document.getElementById("share-scope-budget").checked = !!s.budget;
          document.getElementById("share-scope-ledger").checked = !!s.ledger;
          document.getElementById("share-scope-tickets").checked = !!s.tickets;
        }
      } else {
        if (generateBtn) generateBtn.innerText = "✨ 產生分享連結";
        if (revokeBtn) revokeBtn.style.display = "none";
        if (resultBox) resultBox.style.display = "none";
      }
    });
  }

  if (generateBtn) {
    generateBtn.addEventListener("click", async () => {
      const tripId = getActiveTripId();
      const client = getClient();
      if (!tripId || !client) return;

      const scopes = {
        itinerary: document.getElementById("share-scope-itinerary").checked,
        alternatives: document.getElementById("share-scope-alternatives").checked,
        budget: document.getElementById("share-scope-budget").checked,
        ledger: document.getElementById("share-scope-ledger").checked,
        tickets: document.getElementById("share-scope-tickets").checked
      };

      const expiresDays = document.getElementById("share-expires-days").value;

      try {
        generateBtn.disabled = true;
        generateBtn.innerText = "產生中...";
        const mgr = createGuestShareManager({ supabaseClient: client, showToast });
        const res = await mgr.createOrRegenerateShare(tripId, scopes, expiresDays);

        if (linkInput) linkInput.value = res.shareUrl;
        if (resultBox) resultBox.style.display = "block";
        if (revokeBtn) revokeBtn.style.display = "inline-block";
        generateBtn.innerText = "🔄 重新產生連結";

        showToast("已成功產生唯讀分享連結！", "success");
      } catch (err) {
        showToast("產生分享連結失敗：" + err.message, "error");
      } finally {
        generateBtn.disabled = false;
      }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      if (!linkInput || !linkInput.value) return;
      navigator.clipboard.writeText(linkInput.value).then(() => {
        showToast("已複製唯讀分享連結至剪貼簿！", "success");
      }).catch(() => {
        linkInput.select();
        document.execCommand("copy");
        showToast("已複製唯讀分享連結！", "success");
      });
    });
  }

  if (revokeBtn) {
    revokeBtn.addEventListener("click", async () => {
      const tripId = getActiveTripId();
      const client = getClient();
      if (!tripId || !client) return;

      if (!confirm("確定要停用目前的唯讀分享連結嗎？停用後舊連結將立即失效。")) return;

      try {
        const mgr = createGuestShareManager({ supabaseClient: client, showToast });
        await mgr.revokeShare(tripId);

        if (resultBox) resultBox.style.display = "none";
        if (linkInput) linkInput.value = "";
        revokeBtn.style.display = "none";
        if (generateBtn) generateBtn.innerText = "✨ 產生分享連結";

        showToast("已停用唯讀分享連結", "info");
      } catch (err) {
        showToast("停用失敗：" + err.message, "error");
      }
    });
  }
}

// 偵測 URL ?share=token 訪客模式
export async function checkAndApplyGuestShareFromUrl() {
  if (typeof window === "undefined" || !window.location) return;

  const urlParams = new URLSearchParams(window.location.search);
  const shareToken = urlParams.get("share");

  if (!shareToken) return;

  window.isGuestReadonlyMode = true;

  const banner = document.getElementById("guest-readonly-banner");
  const invalidOverlay = document.getElementById("guest-invalid-overlay");
  const invalidMsg = document.getElementById("guest-invalid-msg");

  if (banner) banner.style.display = "flex";

  // 屏蔽寫入按鈕
  const writeSelectors = [
    "#ws-share-trip-btn",
    "#ws-edit-trip-btn",
    "#ws-add-schedule-btn",
    "#ws-add-alt-sight-btn",
    "#ws-add-alt-restaurant-btn",
    "#ws-add-expense-btn",
    "#ws-add-advance-btn",
    "#ws-add-repay-btn",
    "#ws-add-voucher-btn",
    "#ws-add-trip-btn",
    "#ws-import-cloud-btn",
    "#ws-export-btn",
    "#ws-bind-line-btn",
    ".ws-member-add-btn",
    ".ws-title-copy-btn"
  ];

  setTimeout(() => {
    writeSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => el.style.display = "none");
    });
  }, 100);

  const getClient = () => window.supabaseClient || (window.supabase && window.supabaseConfig ? window.supabase.createClient(window.supabaseConfig.url, window.supabaseConfig.anonKey) : null);
  const client = getClient();

  if (!client) {
    if (invalidOverlay) invalidOverlay.style.display = "flex";
    return;
  }

  const manager = createGuestShareManager({ supabaseClient: client });
  const result = await manager.fetchTripByToken(shareToken);

  if (!result || !result.success) {
    if (invalidOverlay) {
      if (invalidMsg && result?.message) invalidMsg.innerText = result.message;
      invalidOverlay.style.display = "flex";
    }
    return;
  }

  // 成功載入唯讀旅程資料，將資料注入畫面
  if (typeof window.applyGuestReadonlyTripData === "function") {
    window.applyGuestReadonlyTripData(result);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    initGuestShareUI();
    checkAndApplyGuestShareFromUrl();
  });
}
