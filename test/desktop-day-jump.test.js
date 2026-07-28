const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "index.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("itinerary includes an accessible desktop quick navigation rail", () => {
  assert.match(html, /id="ws-desktop-day-jump"/);
  assert.match(html, /aria-label="每日行程快速跳轉"/);
  assert.match(html, /id="ws-day-jump-top"/);
  assert.match(html, /id="ws-day-jump-list"/);
});

test("desktop navigation creates one button for every trip day", () => {
  assert.match(app, /function renderDesktopItineraryJump\(daysCount\)/);
  assert.match(app, /dayNum <= daysCount/);
  assert.match(app, /selectWorkspaceItineraryDay\(dayNum, \{ scrollToDetail: true \}\)/);
  assert.match(app, /renderDesktopItineraryJump\(daysCount\)/);
});

test("day selection stays in range and updates both navigation controls", () => {
  assert.match(app, /Math\.min\(Math\.max\(Number\(dayNum\) \|\| 1, 1\), daysCount\)/);
  assert.match(app, /\.day-selector-btn\[data-day-num\]/);
  assert.match(app, /\.desktop-day-jump-btn\[data-day-num\]/);
  assert.match(app, /aria-current/);
});

test("quick navigation scrolls to day details and back to the workspace top", () => {
  assert.match(app, /function scrollWorkspaceToTop\(\)/);
  assert.match(app, /#view-workspace \.workspace-back-bar/);
  assert.match(app, /window\.scrollTo\(\{ top: Math\.max\(0, targetTop\), behavior: "smooth" \}\)/);
  assert.match(app, /getElementById\("ws-day-info-card"\)/);
  assert.match(app, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
});

test("quick navigation is desktop-only and supports long trips", () => {
  assert.match(css, /\.desktop-day-jump\s*\{\s*display: none;/);
  assert.match(css, /@media \(min-width: 1100px\)/);
  assert.match(css, /max-height: min\(72vh, 38rem\)/);
  assert.match(css, /overflow-y: auto/);
});
