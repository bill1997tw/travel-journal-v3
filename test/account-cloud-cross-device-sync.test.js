import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cloudSource = fs.readFileSync(new URL("../account-cloud.js", import.meta.url), "utf8");
const configSource = fs.readFileSync(new URL("../supabase-config.js", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("clean realtime updates are applied automatically across devices", () => {
  assert.match(cloudSource, /mode === "refresh_available"[\s\S]*scheduleAutomaticRemoteRefresh\(tripId\)/);
  assert.match(cloudSource, /handleRemoteUpdateAction\(tripId, \{ automatic: true \}\)/);
  assert.match(cloudSource, /replaceImportedCandidate\([\s\S]*localStorage,[\s\S]*remoteCandidate/);
  assert.match(cloudSource, /window\.voyageApp\?\.rehydrateAndRender\?\.\(\)/);
  assert.match(cloudSource, /已自動同步另一台裝置的更新/);
});

test("automatic synchronization never overwrites a conflicting local draft", () => {
  assert.match(cloudSource, /currentMode === "compare_required"/);
  assert.match(cloudSource, /if \(!options\.automatic\) await openConflictComparison/);
  assert.match(cloudSource, /latestMode === "compare_required" && !options\.automatic/);
  assert.match(cloudSource, /請先比較版本，不會自動覆蓋/);
});

test("foreground resume and polling recover missed mobile realtime events", () => {
  assert.match(cloudSource, /FOREGROUND_SYNC_INTERVAL_MS = 15000/);
  assert.match(cloudSource, /document\.addEventListener\("visibilitychange"/);
  assert.match(cloudSource, /window\.addEventListener\("focus"/);
  assert.match(cloudSource, /refreshCloudTripsInForeground\("interval"\)/);
  assert.match(cloudSource, /foregroundSyncPromise = loadTrips\(\)/);
  assert.match(cloudSource, /state\.busy[\s\S]*state\.savingTripIds\.size > 0/);
});

test("an applied cloud update redraws the open workspace without losing context", () => {
  assert.match(appSource, /const workspaceState = activeTripId \?/);
  assert.match(appSource, /baseEnterWorkspace\(workspaceState\.tripId\)/);
  assert.match(appSource, /switchWorkspaceTab\(workspaceState\.tab\)/);
  assert.match(appSource, /selectWorkspaceItineraryDay\(workspaceState\.day\)/);
  assert.match(appSource, /switchAltTab\(workspaceState\.alternativeTab\)/);
  assert.match(appSource, /window\.scrollTo\(\{ top: workspaceState\.scrollY, behavior: "auto" \}\)/);
});

test("cross-device release uses a fresh account cloud script URL", () => {
  assert.match(configSource, /account-cloud\.js\?v=account_cloud_v38/);
});
