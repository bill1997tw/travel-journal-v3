import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const htmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const entrySource = fs.readFileSync(new URL("../app-entry.js", import.meta.url), "utf8");
const entryStyles = fs.readFileSync(new URL("../app-entry.css", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const workerSource = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");

test("app starts with login, registration, and explicit local guest choices", () => {
  assert.match(htmlSource, /id="main-app-container" inert/);
  assert.match(htmlSource, /id="app-entry-login-form"/);
  assert.match(htmlSource, /id="app-entry-register-form"/);
  assert.match(htmlSource, /id="app-entry-guest-btn"/);
  assert.match(htmlSource, /訪客資料只保存在這台裝置/);
  assert.match(entrySource, /appContainer\?\.removeAttribute\("inert"\)/);
});

test("registration stores only display name metadata and validates passwords", () => {
  assert.match(entrySource, /data: \{ display_name: displayName \}/);
  assert.match(entrySource, /password\.length < 8/);
  assert.match(entrySource, /password !== passwordConfirm/);
  assert.doesNotMatch(entrySource, /localStorage\.setItem\([^,]+,\s*password/);
});

test("remember me persists the session and email without storing the password", () => {
  assert.match(htmlSource, /type="checkbox" name="rememberMe" checked/);
  assert.match(htmlSource, /記住我/);
  assert.match(entrySource, /const REMEMBER_ME_KEY = "voyage_auth_remember_me"/);
  assert.match(entrySource, /const REMEMBERED_EMAIL_KEY = "voyage_auth_remembered_email"/);
  assert.match(entrySource, /persistSession: true/);
  assert.match(entrySource, /storage: authStorage/);
  assert.match(entrySource, /localStorage\.setItem\(REMEMBERED_EMAIL_KEY, email\)/);
  assert.doesNotMatch(entrySource, /(?:localStorage|sessionStorage)\.setItem\([^,]+,\s*(?:loginForm\.elements\.)?password/);
  assert.match(entryStyles, /\.app-entry-remember/);
});

test("login password visibility is explicit and accessible", () => {
  assert.match(htmlSource, /id="app-entry-password-toggle"/);
  assert.match(htmlSource, /aria-label="顯示密碼" aria-pressed="false"/);
  assert.match(entrySource, /function togglePasswordVisibility\(\)/);
  assert.match(entrySource, /passwordInput\.type = shouldReveal \? "text" : "password"/);
  assert.match(entrySource, /passwordToggle\.setAttribute\("aria-pressed", shouldReveal \? "true" : "false"\)/);
  assert.match(entryStyles, /\.app-entry-password-field/);
});

test("entry screen reacts to sign-in and sign-out changes from other tabs", () => {
  assert.match(entrySource, /event === "SIGNED_OUT" && root\.hidden/);
  assert.match(entrySource, /event === "SIGNED_IN" && !root\.hidden/);
  assert.match(entrySource, /window\.location\.reload\(\)/);
});

test("entry login explains offline authentication without blaming the password", () => {
  assert.match(entrySource, /!navigator\.onLine/);
  assert.match(entrySource, /text\.includes\("failed to fetch"\)/);
  assert.match(entrySource, /目前處於離線狀態，無法驗證新登入/);
  assert.match(entrySource, /已保存在本機的旅程仍可安全使用/);
});

test("password recovery is self-service and never stores the new password", () => {
  assert.match(htmlSource, /id="app-entry-forgot-btn"/);
  assert.match(htmlSource, /id="app-entry-forgot-form"/);
  assert.match(htmlSource, /id="app-entry-reset-form"/);
  assert.match(entrySource, /resetPasswordForEmail\(email,\s*\{\s*redirectTo: buildPasswordRecoveryUrl\(\)/);
  assert.match(entrySource, /event === "PASSWORD_RECOVERY"/);
  assert.match(entrySource, /client\.auth\.updateUser\(\{ password \}\)/);
  assert.match(entrySource, /await client\.auth\.signOut\(\)/);
  assert.match(entrySource, /history\.replaceState/);
  assert.doesNotMatch(entrySource, /(?:localStorage|sessionStorage)\.setItem\([^,]+,\s*password/);
});

test("guest share links bypass the account entry screen", () => {
  assert.match(entrySource, /new URLSearchParams\(window\.location\.search\)\.get\("share"\)/);
  assert.match(entrySource, /if \(hasGuestShareToken\(\)\)[\s\S]*root\.hidden = true/);
});

test("new devices start empty while existing voyage_trips remain untouched", () => {
  assert.match(appSource, /const localTrips = localStorage\.getItem\("voyage_trips"\)/);
  assert.match(appSource, /if \(localTrips\)[\s\S]*trips = JSON\.parse\(localTrips\)/);
  assert.match(appSource, /else \{\s*trips = \[\];\s*persistTrips\(\)/);
  assert.match(appSource, /else \{\s*quickNotes = \[\]/);
});

test("empty dashboard uses one prominent create-trip action", () => {
  assert.match(htmlSource, /id="dashboard-empty-welcome"/);
  assert.match(htmlSource, /id="dashboard-empty-add-trip"/);
  assert.match(appSource, /emptyWelcome\.hidden = !isEmpty/);
  assert.match(appSource, /dashboardGrid\.hidden = !hasLocalTrips/);
});

test("entry assets are responsive and included in the offline shell", () => {
  assert.match(entryStyles, /\.app-entry-loading\[hidden\]/);
  assert.match(entryStyles, /\.stats-bar\[hidden\]/);
  assert.match(entryStyles, /@media \(max-width: 480px\)/);
  assert.match(entryStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(workerSource, /voyage-book-shell-v51/);
  assert.match(workerSource, /"\.\/app-entry\.js"/);
  assert.match(workerSource, /"\.\/app-entry\.css"/);
});
