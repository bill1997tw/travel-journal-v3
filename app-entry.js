(function () {
  "use strict";

  const GUEST_SESSION_KEY = "voyage_guest_session";
  const MIN_SPLASH_MS = 650;
  const startedAt = Date.now();
  const root = document.getElementById("app-entry");
  const appContainer = document.getElementById("main-app-container");
  const loading = document.getElementById("app-entry-loading");
  const authPanel = document.getElementById("app-entry-auth");
  const loginForm = document.getElementById("app-entry-login-form");
  const registerForm = document.getElementById("app-entry-register-form");
  const message = document.getElementById("app-entry-message");
  const guestButton = document.getElementById("app-entry-guest-btn");
  const tabButtons = [...document.querySelectorAll("[data-entry-tab]")];
  let client = null;
  let busy = false;

  function hasGuestShareToken() {
    return Boolean(new URLSearchParams(window.location.search).get("share"));
  }

  function setMessage(text, isError = false) {
    message.textContent = text || "";
    message.dataset.error = isError ? "true" : "false";
  }

  function setBusy(nextBusy) {
    busy = Boolean(nextBusy);
    for (const control of root.querySelectorAll("button, input")) {
      control.disabled = busy;
    }
  }

  function friendlyAuthError(error) {
    const text = String(error?.message || "").toLowerCase();
    if (text.includes("invalid login credentials")) return "Email 或密碼不正確，請重新確認。";
    if (text.includes("email not confirmed")) return "請先到信箱完成驗證，再回來登入。";
    if (text.includes("already registered") || text.includes("already been registered")) {
      return "這個 Email 已經申請過帳號，請直接登入。";
    }
    if (text.includes("password")) return "密碼至少需要 8 個字元。";
    return error?.message || "目前無法連線帳號服務，您仍可先使用訪客模式。";
  }

  async function waitForSplash() {
    const remaining = MIN_SPLASH_MS - (Date.now() - startedAt);
    if (remaining > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, remaining));
    }
  }

  async function dismissEntry() {
    await waitForSplash();
    root.hidden = true;
    appContainer?.removeAttribute("inert");
    document.dispatchEvent(new CustomEvent("voyage:entry-ready"));
  }

  async function showAuth() {
    await waitForSplash();
    loading.hidden = true;
    authPanel.hidden = false;
    loginForm.elements.email.focus();
  }

  function selectTab(tabName) {
    const isLogin = tabName === "login";
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;
    setMessage("");
    for (const button of tabButtons) {
      const selected = button.dataset.entryTab === tabName;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    }
    const targetForm = isLogin ? loginForm : registerForm;
    targetForm.elements[0]?.focus();
  }

  function createClient() {
    const config = window.VOYAGE_SUPABASE_CONFIG || {};
    const key = config.publishableKey || config.anonKey;
    if (!window.supabase?.createClient || !config.url || !key) return null;
    return window.supabase.createClient(config.url, key);
  }

  function syncDisplayNameFromSession(session) {
    const displayName = String(session?.user?.user_metadata?.display_name || "").trim();
    const currentName = localStorage.getItem("voyage_user_name");
    if (displayName && (!currentName || currentName === "旅人")) {
      localStorage.setItem("voyage_user_name", displayName);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: loginForm.elements.email.value.trim(),
        password: loginForm.elements.password.value
      });
      if (error) throw error;
      if (!data.session) throw new Error("login_session_missing");
      syncDisplayNameFromSession(data.session);
      sessionStorage.removeItem(GUEST_SESSION_KEY);
      window.location.reload();
    } catch (error) {
      setMessage(friendlyAuthError(error), true);
      setBusy(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    if (!client || busy) return;
    const displayName = registerForm.elements.displayName.value.trim();
    const email = registerForm.elements.email.value.trim();
    const password = registerForm.elements.password.value;
    const passwordConfirm = registerForm.elements.passwordConfirm.value;

    if (!displayName) {
      setMessage("請輸入要顯示給旅伴看的名稱。", true);
      return;
    }
    if (password.length < 8) {
      setMessage("密碼至少需要 8 個字元。", true);
      return;
    }
    if (password !== passwordConfirm) {
      setMessage("兩次輸入的密碼不一致。", true);
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName }
        }
      });
      if (error) throw error;
      if (data.session) {
        syncDisplayNameFromSession(data.session);
        sessionStorage.removeItem(GUEST_SESSION_KEY);
        window.location.reload();
        return;
      }
      selectTab("login");
      loginForm.elements.email.value = email;
      setMessage("帳號已建立。請到信箱完成驗證後，再回來登入。");
    } catch (error) {
      setMessage(friendlyAuthError(error), true);
    } finally {
      setBusy(false);
    }
  }

  async function initialize() {
    if (!root) return;
    if (hasGuestShareToken()) {
      root.hidden = true;
      appContainer?.removeAttribute("inert");
      return;
    }

    for (const button of tabButtons) {
      button.addEventListener("click", () => selectTab(button.dataset.entryTab));
    }
    loginForm.addEventListener("submit", handleLogin);
    registerForm.addEventListener("submit", handleRegister);
    guestButton.addEventListener("click", () => {
      sessionStorage.setItem(GUEST_SESSION_KEY, "true");
      dismissEntry();
    });

    if (sessionStorage.getItem(GUEST_SESSION_KEY) === "true") {
      await dismissEntry();
      return;
    }

    client = createClient();
    if (!client) {
      await showAuth();
      setMessage("雲端帳號服務尚未完成設定，您可以先使用訪客模式。", true);
      return;
    }

    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (data.session) {
        syncDisplayNameFromSession(data.session);
        await dismissEntry();
        return;
      }
    } catch (error) {
      await showAuth();
      setMessage(friendlyAuthError(error), true);
      return;
    }

    await showAuth();
  }

  initialize();
})();
