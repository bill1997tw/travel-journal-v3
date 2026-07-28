import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const htmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const cloudSource = fs.readFileSync(new URL("../account-cloud.js", import.meta.url), "utf8");
const cloudStyles = fs.readFileSync(new URL("../cloud-sync.css", import.meta.url), "utf8");

test("dashboard has one account-scoped cloud trip section", () => {
  assert.match(htmlSource, /id="dashboard-cloud-trips"/);
  assert.match(htmlSource, /id="dashboard-cloud-trips-list"/);
  assert.match(htmlSource, /包含自己建立，以及其他 Owner 邀請您參加的旅程/);
});

test("cloud home cards distinguish roles and local import state", () => {
  assert.match(cloudSource, /function renderCloudHomeTrips\(\)/);
  assert.match(cloudSource, /const role = getRole\(trip\)/);
  assert.match(cloudSource, /const importedTrip = findImportedTrip\(trip\.id\)/);
  assert.match(cloudSource, /已載入此裝置/);
  assert.match(cloudSource, /雲端旅程/);
});

test("owner and editor can load while viewer receives readonly preview", () => {
  assert.match(cloudSource, /const canEdit = role === "owner" \|\| role === "editor"/);
  assert.match(cloudSource, /canEdit \? "安全載入" : "查看摘要"/);
  assert.match(cloudSource, /state\.previewRole !== "owner" && state\.previewRole !== "editor"/);
  assert.match(cloudSource, /權限是僅查看，因此不會把內容匯入可編輯的本機工作區/);
});

test("cloud membership suppresses the first-trip empty state without faking local statistics", () => {
  assert.match(appSource, /let accessibleCloudTripCount = 0/);
  assert.match(appSource, /const isEmpty = !hasLocalTrips && accessibleCloudTripCount === 0/);
  assert.match(appSource, /statsBar\.hidden = !hasLocalTrips/);
  assert.match(appSource, /setAccessibleCloudTripCount\(count\)/);
});

test("cloud home cards collapse into full-width mobile actions", () => {
  assert.match(cloudStyles, /\.dashboard-cloud-trip-main > strong/);
  assert.match(cloudStyles, /@media \(max-width: 640px\)[\s\S]*\.dashboard-cloud-trip-actions \.btn/);
});
