import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("cloud-backed trip deletion is labelled as local cache removal", () => {
  assert.match(appSource, /VoyageTripIdentity\?\.isCloudBackedTrip/);
  assert.match(appSource, /確定移除此裝置上的旅程快取嗎/);
  assert.match(appSource, /雲端旅程不會被刪除/);
  assert.match(appSource, /請使用雲端旅程的封存功能/);
  assert.match(appSource, /已移除此裝置的旅程快取/);
});

test("local-only trip deletion keeps the existing permanent-delete warning", () => {
  assert.match(appSource, /刪除這個行程的全部資料嗎/);
  assert.match(appSource, /旅程已永久刪除/);
});
