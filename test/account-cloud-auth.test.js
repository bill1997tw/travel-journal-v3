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

test("secondary remember-me control stays compact and accessible", () => {
  assert.match(cloudStyles, /\.account-cloud-login-options/);
  assert.match(cloudStyles, /\.account-cloud-auth \.account-cloud-remember/);
  assert.match(cloudStyles, /accent-color: var\(--accent-color\)/);
});
