import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const cloudSource = fs.readFileSync(
  new URL("../account-cloud.js", import.meta.url),
  "utf8"
);
const shareSource = fs.readFileSync(
  new URL("../account-cloud-share.js", import.meta.url),
  "utf8"
);

test("workspace cloud actions follow the signed-in trip role", () => {
  assert.match(appSource, /function\(\) \{\s*const trip = trips\.find\(item => item\.id === activeTripId\)/);
  assert.match(appSource, /window\.voyageAccountCloud\?\.getRoleForTrip\?\.\(cloudTripId\)/);
  assert.match(appSource, /shareButton\.hidden = role !== "owner"/);
  assert.match(appSource, /document\.body\.dataset\.activeCloudRole = role \|\| "local"/);
  assert.match(cloudSource, /window\.refreshWorkspaceCloudPermissions\?\.\(\)/);
});

test("owner-only share creation is rejected before any share RPC", () => {
  const guardIndex = shareSource.indexOf(
    'window.voyageAccountCloud?.getRoleForTrip?.(tripId) !== "owner"'
  );
  const statusCallIndex = shareSource.indexOf("await manager.status(tripId)");

  assert.ok(guardIndex >= 0);
  assert.ok(statusCallIndex > guardIndex);
  assert.match(shareSource, /只有這趟旅程的 Owner 可以建立免登入分享連結/);
});

test("owner editor viewer permissions remain separated", () => {
  assert.match(cloudSource, /const canSave = Boolean\(importedTrip && \(role === "owner" \|\| role === "editor"\)\)/);
  assert.match(cloudSource, /role === "owner"[\s\S]*account-cloud-collaboration-open/);
  assert.match(cloudSource, /role === "owner"[\s\S]*account-cloud-archive/);
  assert.match(cloudSource, /state\.previewRole !== "owner" && state\.previewRole !== "editor"/);
  assert.match(cloudSource, /getRoleForTrip: \(tripId\)/);
});
