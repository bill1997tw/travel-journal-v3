(function () {
  "use strict";

  const GUEST_SESSION_KEY = "voyage_guest_session";
  const MIN_SPLASH_MS = 650;
  const startedAt = Date.now();
  const root = document.getElementById("app-entry");
  const appContainer = document.getElementById("main-app-container");
  const loading = document.getElementById("app-entry-loading");
  const authPanel = document.getElementById("app-entry-auth");
  const entryTitle = document.getElementById("app-entry-title");
  const tabList = document.querySelector(".app-entry-tabs");
  const loginForm = document.getElementById("app-entry-login-form");
  const registerForm = document.getElementById("app-entry-register-form");
  const forgotForm = document.getElementById("app-entry-forgot-form");
  const resetForm = document.getElementById("app-entry-reset-form");
  const message = document.getElementById("app-entry-message");
  const forgotButton = document.getElementById("app-entry-forgot-btn");
  const forgotBackButton = document.getElementById("app-entry-forgot-back");
  const guestButton = document.getElementById("app-entry-guest-btn");
  const guestOptions = document.getElementById("app-entry-guest-options");
  const tabButtons = [...document.querySelectorAll("[data-entry-tab]")];
  let client = null;
  let busy = false;

  function hasGuestShareToken() {
    return Boolean(new URLSearchParams(window.location.search).get("share"));
  }

  function hasPasswordRecoveryRequest() {
    return new URLSearchParams(window.location.search).get("reset") === "1";
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
    entryTitle.textContent = isLogin ? "登入您的旅遊小本本" : "建立您的旅遊小本本帳號";
    tabList.hidden = false;
    guestOptions.hidden = false;
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;
    forgotForm.hidden = true;
    resetForm.hidden = true;
    setMessage("");
    for (const button of tabButtons) {
      const selected = button.dataset.entryTab === tabName;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    }
    const targetForm = isLogin ? loginForm : registerForm;
    targetForm.elements[0]?.focus();
  }

  function selectStandaloneForm(formName) {
    entryTitle.textContent = formName === "reset" ? "設定新密碼" : "找回您的帳號";
    tabList.hidden = true;
    guestOptions.hidden = true;
    loginForm.hidden = true;
    registerForm.hidden = true;
    forgotForm.hidden = formName !== "forgot";
    resetForm.hidden = formName !== "reset";
    setMessage("");
    const targetForm = formName === "reset" ? resetForm : forgotForm;
    targetForm.elements[0]?.focus();
  }

  function buildPasswordRecoveryUrl() {
    const recoveryUrl = new URL(window.location.pathname || "/", window.location.origin);
    recoveryUrl.searchParams.set("reset", "1");
    return recoveryUrl.toString();
  }

  function clearPasswordRecoveryUrl() {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("reset");
    cleanUrl.hash = "";
    window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}`);
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

  async function handleForgotPassword(event) {
    event.preventDefault();
    if (!client || busy) return;
    const email = forgotForm.elements.email.value.trim();
    setBusy(true);
    setMessage("");
    try {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: buildPasswordRecoveryUrl()
      });
      if (error) throw error;
      setMessage("如果此 Email 已註冊，密碼重設信會在幾分鐘內寄達。請也檢查垃圾郵件。");
    } catch (error) {
      setMessage(friendlyAuthError(error), true);
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordReset(event) {
    event.preventDefault();
    if (!client || busy) return;
    const password = resetForm.elements.password.value;
    const passwordConfirm = resetForm.elements.passwordConfirm.value;
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
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      await client.auth.signOut();
      clearPasswordRecoveryUrl();
      selectTab("login");
      setMessage("密碼已更新，請使用新密碼登入。");
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
    forgotForm.addEventListener("submit", handleForgotPassword);
    resetForm.addEventListener("submit", handlePasswordReset);
    forgotButton.addEventListener("click", () => selectStandaloneForm("forgot"));
    forgotBackButton.addEventListener("click", () => selectTab("login"));
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

    client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        showAuth().then(() => selectStandaloneForm("reset"));
      }
    });

    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (hasPasswordRecoveryRequest()) {
        await showAuth();
        if (data.session) {
          selectStandaloneForm("reset");
        } else {
          selectTab("login");
          setMessage("這個密碼重設連結已失效，請重新申請。", true);
        }
        return;
      }
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
