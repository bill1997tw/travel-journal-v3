const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const cloudSource = fs.readFileSync(path.join(root, "account-cloud.js"), "utf8");
const cloudStyles = fs.readFileSync(path.join(root, "cloud-sync.css"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(root, "cloud-sync.js"), "utf8");

test("cloud manager loads active and archived trips separately", () => {
  assert.match(cloudSource, /archivedTrips: \[\]/);
  assert.match(cloudSource, /\.is\("archived_at", null\)/);
  assert.match(cloudSource, /\.not\("archived_at", "is", null\)/);
  assert.match(cloudSource, /\.filter\(\(trip\) => getRole\(trip\) === "owner"\)/);
});

test("only owner trip cards expose reversible cloud archival", () => {
  assert.match(cloudSource, /role === "owner" \? `[\s\S]*account-cloud-archive/);
  assert.match(cloudSource, /account-cloud-restore/);
  assert.match(cloudSource, /setCloudTripArchived\(button\.dataset\.tripId, true\)/);
  assert.match(cloudSource, /setCloudTripArchived\(button\.dataset\.tripId, false\)/);
});

test("archive confirmation explains sharing, LINE, and local copy behavior", () => {
  assert.match(cloudSource, /撤銷免登入分享與 LINE 群組連動/);
  assert.match(cloudSource, /本機副本會保留/);
  assert.match(cloudSource, /分享連結與 LINE 綁定不會自動恢復/);
  assert.match(cloudSource, /state\.client\.rpc\("set_trip_archived"/);
  assert.doesNotMatch(cloudSource, /\.from\("trips"\)[\s\S]{0,160}\.delete\(\)/);
});

test("archived trips stop queued sync and remain recoverable", () => {
  assert.match(cloudSource, /delete state\.remoteUpdates\[tripId\]/);
  assert.match(cloudSource, /deleteDraft\(tripId\)/);
  assert.match(cloudSource, /雲端旅程已封存；本機副本仍保留/);
  assert.match(cloudStyles, /\.account-cloud-trip-archived/);
  assert.match(cloudStyles, /\.account-cloud-archived-heading/);
});

test("archive release assets use a fresh cache version", () => {
  assert.match(bootstrapSource, /account-cloud\.js\?v=v37/);
});
