import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const htmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const importSource = fs.readFileSync(new URL("../account-cloud-import.js", import.meta.url), "utf8");
const shareSource = fs.readFileSync(new URL("../account-cloud-share.js", import.meta.url), "utf8");

test("travel guides are editable per trip and persist through the existing cloud save path", () => {
  assert.match(htmlSource, /id="guide-form"/);
  assert.match(htmlSource, /id="guides-dynamic-root"/);
  assert.match(appSource, /function ensureGuideState\(trip\)/);
  assert.match(appSource, /function renderWorkspaceGuides\(\)/);
  assert.match(appSource, /function handleGuideSubmit\(event\)/);
  assert.match(appSource, /async function deleteGuide\(guideId\)/);
  assert.match(appSource, /persistTrips\(\);[\s\S]*renderWorkspaceGuides\(\)/);
  assert.equal((appSource.match(/guides-add-btn"\)\.addEventListener/g) || []).length, 1);
  assert.match(htmlSource, /id="guide-cover-url"/);
  assert.match(htmlSource, /id="guide-tags"/);
  assert.match(appSource, /coverUrl: normalizeExternalUrl/);
  assert.match(appSource, /guide-live-tags/);
});

test("guide links are restricted to web URLs and arbitrary embeds are not rendered", () => {
  assert.match(appSource, /normalizeExternalUrl\(rawUrl\)/);
  assert.match(appSource, /if \(rawUrl && !url\)/);
  assert.doesNotMatch(appSource, /kind !== "note" && !url/);
  assert.match(htmlSource, /相關連結（選填）/u);
  assert.match(htmlSource, /沒有網址也能儲存/u);
  assert.doesNotMatch(appSource, /<iframe[^>]*\$\{.*guide/);
  assert.match(shareSource, /normalizePublicUrl/);
  assert.match(shareSource, /rel="noopener noreferrer"/);
});

test("guides survive cloud import, conflict comparison, and guest rendering", () => {
  assert.match(importSource, /candidate\.guides = asArray\(candidate\.guides\)/);
  assert.match(importSource, /key: "guides"/);
  assert.match(shareSource, /const guides = Array\.isArray\(trip\.guides\)/);
  assert.match(shareSource, /<h2>旅行攻略庫<\/h2>/);
});

test("existing guide covers support typed replacement, removal and cancel-safe editing", () => {
  assert.match(appSource, /urlInput\.addEventListener\("input"/);
  assert.match(appSource, /urlInput\.dataset\.mediaReference = ""/);
  assert.match(appSource, /data-guide-cover-remove/);
  assert.match(appSource, /dataset\.originalMediaReference = guideCoverReference/);
  assert.match(appSource, /const rawCoverUrl = guideCoverInput\.dataset\.mediaReference \|\| guideCoverInput\.value\.trim\(\)/);
  assert.match(appSource, /if \(!result\) return/);
  assert.doesNotMatch(appSource, /storage\.from\([^)]*\)\.remove\(/);
});

test("guide saving waits for a pending mobile cover upload", () => {
  assert.match(htmlSource, /id="guide-submit-btn"/);
  assert.match(appSource, /let guideCoverUploadPromise = null/);
  assert.match(appSource, /submitButton\.disabled = true/);
  assert.match(appSource, /submitButton\.textContent = "上傳圖片中…"/u);
  assert.match(appSource, /async function handleGuideSubmit\(event\)/);
  assert.match(appSource, /const pendingCoverUpload = guideCoverUploadPromise/);
  assert.match(appSource, /await pendingCoverUpload/);
});

test("guide release invalidates browser and offline caches", () => {
  assert.match(htmlSource, /index\.css\?v=v50/);
  assert.match(htmlSource, /account-cloud-share\.js\?v=v16/);
  assert.match(htmlSource, /media-uploader\.js\?v=v3/);
  assert.match(htmlSource, /app\.js\?v=v48/);
});
