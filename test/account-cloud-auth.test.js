import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cloudSource = fs.readFileSync(new URL("../account-cloud.js", import.meta.url), "utf8");
const cloudStyles = fs.readFileSync(new URL("../cloud-sync.css", import.meta.url), "utf8");

test("secondary cloud login uses the same remember-me preference", () => {
  assert.match(cloudSource, /const REMEMBER_ME_KEY = "voyage_auth_remember_me"/);
  assert.match(cloudSource, /const REMEMBERED_EMAIL_KEY = "voyage_auth_remembered_email"/);
  assert.match(cloudSource, /class="account-cloud-remember"/);
  assert.match(cloudSource, /restoreAuthPreferences\(\)/);
  assert.match(cloudSource, /updateAuthPreferences\(email\)/);
  assert.match(cloudSource, /localStorage\.setItem\(REMEMBERED_EMAIL_KEY, email\)/);
  assert.doesNotMatch(
    cloudSource,
    /(?:localStorage|sessionStorage)\.setItem\([^,]+,\s*(?:ui\.)?password/
  );
});

test("account switching clears guest mode and returns sign-out to the entry screen", () => {
  assert.match(cloudSource, /const GUEST_SESSION_KEY = "voyage_guest_session"/);
  assert.match(cloudSource, /sessionStorage\.removeItem\(GUEST_SESSION_KEY\)/);
  assert.match(cloudSource, /const accountEmail = state\.session\?\.user\?\.email/);
  assert.match(cloudSource, /雲端旅程不會被刪除/);
  assert.match(cloudSource, /if \(!confirmed\) return/);
  assert.match(cloudSource, /await state\.client\.auth\.signOut\(\)/);
  assert.match(cloudSource, /window\.location\.reload\(\)/);
});

test("the header identifies the active account without exposing the full email", () => {
  assert.match(cloudSource, /function maskAccountEmail\(email\)/);
  assert.match(cloudSource, /return `\$\{localPart\.slice\(0, visibleLength\)\}\*\*\*@\$\{domain\}`/);
  assert.match(cloudSource, /const maskedEmail = maskAccountEmail\(state\.session\?\.user\?\.email\)/);
  assert.match(cloudSource, /ui\.authButton\.textContent = signedIn \? `雲端 · \$\{shortAccount\}`/);
  assert.match(cloudSource, /setStatus\(signedIn \? `\$\{maskedEmail\} 已連線`/);
  assert.doesNotMatch(cloudSource, /setStatus\(signedIn \? state\.session\?\.user\?\.email/);
});

test("secondary cloud login can reveal and hide the password accessibly", () => {
  assert.match(cloudSource, /class="account-cloud-password-toggle"/);
  assert.match(cloudSource, /function toggleCloudPasswordVisibility\(\)/);
  assert.match(cloudSource, /ui\.password\.type = shouldReveal \? "text" : "password"/);
  assert.match(cloudSource, /setAttribute\("aria-pressed", shouldReveal \? "true" : "false"\)/);
  assert.match(cloudStyles, /\.account-cloud-password-field/);
});

test("cloud account state follows sign-in and sign-out events across tabs", () => {
  assert.match(cloudSource, /authSubscription: null/);
  assert.match(cloudSource, /function startAuthUpdates\(\)/);
  assert.match(cloudSource, /auth\.onAuthStateChange\(\(event, session\) =>/);
  assert.match(cloudSource, /event === "SIGNED_OUT"/);
  assert.match(cloudSource, /clearSignedOutState\(\)/);
  assert.match(cloudSource, /event !== "SIGNED_IN"/);
  assert.match(cloudSource, /sessionStorage\.removeItem\(GUEST_SESSION_KEY\)/);
});

test("secondary remember-me control stays compact and accessible", () => {
  assert.match(cloudStyles, /\.account-cloud-login-options/);
  assert.match(cloudStyles, /\.account-cloud-auth \.account-cloud-remember/);
  assert.match(cloudStyles, /accent-color: var\(--accent-color\)/);
});
