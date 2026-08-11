const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "index.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("workspace exposes one clear trip memory destination", () => {
  assert.match(html, /data-ws-tab="diary"[^>]*>[\s\S]*?旅程回憶/);
  assert.match(html, /id="ws-panel-diary"/);
  assert.doesNotMatch(html, /記憶書籤/);
});

test("trip memory editor restores the agreed first-stage fields", () => {
  [
    "ws-diary-story-title",
    "ws-diary-location",
    "ws-diary-text",
    "ws-diary-weather",
    "ws-diary-companion",
    "ws-diary-cost",
    "ws-diary-rating-stars",
    "ws-diary-hashtags"
  ].forEach(id => assert.match(html, new RegExp(`id="${id}"`)));
});

test("trip memory supports cover upload, live formats and draft persistence", () => {
  assert.match(html, /id="ws-diary-upload-stage"/);
  assert.match(html, /data-diary-mode="post"/);
  assert.match(html, /data-diary-mode="story"/);
  assert.match(app, /function handleDiaryImageFile\(file\)/);
  assert.match(app, /status: "draft"/);
  assert.match(app, /updatedAt: new Date\(\)\.toISOString\(\)/);
  assert.match(css, /\.diary-upload-stage\.is-dragging/);
});

test("trip memory upload rejects non-images and oversized covers", () => {
  assert.match(app, /file\?\.type\?\.startsWith\("image\/"\)/);
  assert.match(app, /file\.size > 5 \* 1024 \* 1024/);
});

test("memory moments support multiple chronological entries linked to trip days", () => {
  assert.match(html, /data-diary-view="moments"/);
  assert.match(html, /id="ws-memory-timeline"/);
  assert.match(html, /id="memory-moment-day"/);
  assert.match(html, /id="memory-moment-schedule"/);
  assert.match(app, /memories: normalizedMemories/);
  assert.match(app, /function getSortedMemoryMoments\(diary\)/);
  assert.match(app, /function populateMemoryScheduleOptions\(trip, dayNumber/);
});

test("memory moments can be selected and assembled without AI rewriting", () => {
  assert.match(html, /id="memory-moment-included"/);
  assert.match(html, /id="ws-memory-compose-btn"/);
  assert.match(app, /includedInStory: moment\.includedInStory !== false/);
  assert.match(app, /function composeDiaryFromSelectedMemories\(\)/);
  assert.match(app, /selected\.map\(memory =>/);
});

test("memory moment photos are validated and compressed before persistence", () => {
  assert.match(app, /file\.size > 12 \* 1024 \* 1024/);
  assert.match(app, /function compressMemoryMomentImage\(file\)/);
  assert.match(app, /maxDimension = 1280/);
  assert.match(app, /canvas\.toDataURL\("image\/jpeg", 0\.78\)/);
});

test("memory moment UI has desktop timeline and mobile card fallbacks", () => {
  assert.match(css, /\.memory-timeline::before/);
  assert.match(css, /\.memory-moment-card/);
  assert.match(css, /\.memory-moment-form-grid/);
  assert.match(css, /\.memory-timeline::before,\s*\n\s*\.memory-timeline-marker/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test("trip memory separates draft, private and published states", () => {
  assert.match(html, /id="ws-diary-status"/);
  assert.match(html, /value="draft"/);
  assert.match(html, /value="private"/);
  assert.match(html, /value="published"/);
  assert.match(app, /\["draft", "private", "published"\]\.includes/);
  assert.match(app, /publishedAt: status === "published"/);
  assert.match(app, /function canEditActiveTrip\(\)/);
  assert.match(app, /role === "owner" \|\| role === "editor"/);
  assert.match(app, /if \(!canEditActiveTrip\(\)\) \{[\s\S]*?無法儲存回憶/);
});

test("guest diary sharing is an explicit owner-controlled option", () => {
  const share = fs.readFileSync(path.join(root, "account-cloud-share.js"), "utf8");
  assert.match(html, /id="share-scope-diary"/);
  assert.match(share, /share_diary: includeDiary/);
  assert.match(share, /status\.include_diary/);
  assert.match(share, /result\.include_diary \? diaryHtml/);
  assert.match(css, /\.guest-share-diary/);
  assert.match(css, /\.guest-share-memory-list/);
});

test("trip memory changes remain inside revision conflict protection", () => {
  const cloud = fs.readFileSync(path.join(root, "account-cloud.js"), "utf8");
  const cloudImport = fs.readFileSync(path.join(root, "account-cloud-import.js"), "utf8");
  assert.match(cloudImport, /key: "diary"/);
  assert.match(cloudImport, /sectionChanged\(localTrip\.diary \|\| \{\}, remoteCandidate\.diary \|\| \{\}\)/);
  assert.match(cloud, /expected_revision: payload\.expectedRevision/);
  assert.match(cloud, /trip_revision_conflict/);
  assert.match(cloud, /role !== "owner" && role !== "editor"/);
});

test("trip memory exports real 4:5 and 9:16 PNG images without a DOM screenshot dependency", () => {
  assert.match(html, /id="ws-diary-download-btn"/);
  assert.match(html, /id="ws-diary-share-image-btn"/);
  assert.match(app, /canvas\.width = 1080/);
  assert.match(app, /canvas\.height = isStory \? 1920 : 1350/);
  assert.match(app, /canvas\.toBlob\(/);
  assert.match(app, /navigator\.canShare\(\{ files: \[file\] \}\)/);
  assert.match(app, /此裝置不支援直接分享，已改為下載 PNG/);
  assert.doesNotMatch(app, /html2canvas/);
  assert.match(css, /\.diary-preview-actions/);
});
