import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cloudSource = fs.readFileSync(new URL("../account-cloud.js", import.meta.url), "utf8");
const htmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("account cloud switches protected local scopes on startup, sign-in and sign-out", () => {
  assert.match(htmlSource, /local-account-vault\.js\?v=v1/);
  assert.match(cloudSource, /function switchLocalAccountScope\(session\)/);
  assert.match(cloudSource, /vaultApi\.accountScope\(session\.user\.id\)/);
  assert.match(cloudSource, /vaultApi\.GUEST_SCOPE/);
  assert.ok(
    (cloudSource.match(/switchLocalAccountScope\(data\.session\)/g) || []).length >= 2
  );
  assert.ok(
    (cloudSource.match(/switchLocalAccountScope\(null\)/g) || []).length >= 2
  );
  assert.match(cloudSource, /window\.voyageApp\?\.rehydrateAndRender\?\.\(\)/);
  assert.match(cloudSource, /function startLocalScopeUpdates\(\)/);
  assert.match(cloudSource, /event\.key !== vaultApi\.ACTIVE_SCOPE_KEY/);
  assert.match(cloudSource, /autoSaveMutedUntil = Date\.now\(\) \+ 3000/);
});
