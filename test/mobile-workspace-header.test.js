const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "index.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");

test("mobile workspace keeps infrequent actions in a compact management menu", () => {
  assert.match(html, /id="mobile-workspace-more"/);
  assert.match(html, /data-mobile-workspace-action="share"/);
  assert.match(html, /data-mobile-workspace-action="edit"/);
  assert.match(html, /data-mobile-workspace-action="delete"/);
  assert.match(html, /class="mobile-workspace-more-menu"[\s\S]*data-ws-tab="guides"[\s\S]*data-ws-tab="diary"/);
});

test("mobile workspace hides the duplicate top navigation and keeps content compact", () => {
  assert.match(css, /body\.mobile-workspace-mode \.workspace-sidebar\s*\{\s*display:\s*none !important;/);
  assert.match(css, /body\.mobile-workspace-mode \.workspace-back-bar > \[data-ws-tab="diary"\]\s*\{\s*display:\s*none !important;/);
  assert.match(css, /body\.mobile-workspace-mode \.workspace-header-cover\s*\{[\s\S]*height:\s*84px;[\s\S]*min-height:\s*84px;/);
  assert.match(css, /body\.mobile-workspace-mode \.ws-header-left p,[\s\S]*body\.mobile-workspace-mode \.ws-header-right\s*\{[\s\S]*display:\s*none;/);
  assert.match(css, /body\.mobile-workspace-mode \.mobile-workspace-more\s*\{[\s\S]*display:\s*block;/);
});

test("mobile management actions reuse existing desktop behavior and owner permissions", () => {
  assert.match(app, /data-mobile-workspace-action/);
  assert.match(app, /getElementById\("ws-edit-trip-btn"\)\?\.click\(\)/);
  assert.match(app, /getElementById\("ws-share-trip-btn"\)\?\.click\(\)/);
  assert.match(app, /getElementById\("ws-delete-current-trip-btn"\)\?\.click\(\)/);
  assert.match(app, /\[shareButton, mobileShareButton\]\.forEach/);
});

test("mobile shell cache versions are bumped for the compact workspace UI", () => {
  assert.match(html, /index\.css\?v=v51/);
  assert.match(html, /app\.js\?v=v49/);
  assert.match(worker, /voyage-book-shell-v88/);
  assert.match(worker, /index\.css\?v=v51/);
  assert.match(worker, /app\.js\?v=v49/);
});
