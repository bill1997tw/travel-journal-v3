import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cloudSource = fs.readFileSync(new URL("../account-cloud.js", import.meta.url), "utf8");
const configSource = fs.readFileSync(new URL("../supabase-config.js", import.meta.url), "utf8");
const serviceWorkerSource = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");

test("owner and editor receive the clone action while viewers do not", () => {
  assert.match(cloudSource, /role === "owner" \|\| role === "editor" \? `[\s\S]*account-cloud-clone/);
  assert.match(cloudSource, /canEdit \? `[\s\S]*dashboard-cloud-trip-clone/);
  assert.match(cloudSource, /複製成我的旅程/);
});

test("clone confirmation explains the new ownership and isolation boundary", () => {
  assert.match(cloudSource, /新副本會由目前帳號擁有/);
  assert.match(cloudSource, /LINE 帳本交易、LINE 綁定、分享連結、旅伴權限與修改歷史不會複製/);
  assert.match(cloudSource, /兩份旅程之後不會同步/);
});

test("clone uses the guarded RPC and imports only the returned new trip", () => {
  assert.match(cloudSource, /\.rpc\("clone_trip_as_owner"/);
  assert.match(cloudSource, /source_trip_id: sourceTripId/);
  assert.match(cloudSource, /await loadTrips\(\)/);
  assert.match(cloudSource, /fetchRemoteCandidate\(data\.trip_id\)/);
  assert.match(cloudSource, /importApi\.importCandidate/);
});

test("clone retries reuse an existing owner copy instead of duplicating it", () => {
  assert.match(cloudSource, /const existingLocalTrip = findImportedTrip\(data\.trip_id\)/);
  assert.match(cloudSource, /這趟旅程先前已複製完成/);
});

test("clone release uses fresh script and offline cache versions", () => {
  assert.match(configSource, /account-cloud\.js\?v=account_cloud_v28/);
  assert.match(serviceWorkerSource, /voyage-book-shell-v55/);
});
