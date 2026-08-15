import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shareSource = fs.readFileSync(new URL("../account-cloud-share.js", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../index.css", import.meta.url), "utf8");
const favorites = fs.readFileSync(new URL("../account-favorites.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("anonymous itinerary cards provide copy, navigation, and compact external links", () => {
  assert.match(shareSource, /data-copy-address=/);
  assert.match(shareSource, /已複製地址/);
  assert.match(shareSource, /google\.com\/maps\/search/);
  assert.match(shareSource, /target="_blank" rel="noopener noreferrer">導航/);
  assert.match(shareSource, /getCompactExternalLinks/);
  assert.match(shareSource, /🔗 開啟連結/);
  assert.doesNotMatch(shareSource, /content\.links\.join/);
});

test("anonymous cards remain read-only and contain no mutation controls", () => {
  const renderStart = shareSource.indexOf("function renderGuestTrip");
  const renderEnd = shareSource.indexOf("function showInvalidShare", renderStart);
  const renderer = shareSource.slice(renderStart, renderEnd);
  assert.doesNotMatch(renderer, />編輯</);
  assert.doesNotMatch(renderer, />刪除</);
  assert.doesNotMatch(renderer, />儲存</);
  assert.match(renderer, /此頁僅供閱讀，無法新增、修改或刪除旅程/);
});

test("strategy and favorites share the colorful tag renderer", () => {
  assert.match(html, /tag-chips\.js\?v=v1/);
  assert.match(favorites, /VoyageTagChips\?\.render/);
  assert.match(app, /VoyageTagChips\?\.render/);
  assert.match(shareSource, /VoyageTagChips\?\.render/);
  for (let index = 0; index < 6; index += 1) {
    assert.match(styles, new RegExp(`favorite-tag-color-${index}`));
  }
});

test("shared tickets render intentionally shared notes, links, images, PDFs and QR content", () => {
  assert.match(html, /票券、憑證、備註與附件/);
  assert.match(shareSource, /guest-share-ticket-notes/);
  assert.match(shareSource, /guest-share-ticket-image/);
  assert.match(shareSource, /開啟票券連結/);
  assert.match(shareSource, /guest-share-ticket-qr/);
  assert.match(shareSource, /開啟 .*PDF 憑證/);
  assert.doesNotMatch(shareSource, /檔案、QR Code、連結及備註不公開/);
});

test("390px itinerary, action, tag and ticket layouts are contained", () => {
  assert.match(styles, /body\.guest-readonly-active header\.guest-share-hero\s*\{[\s\S]*display: block/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*\.guest-share-item[\s\S]*display: block/);
  assert.match(styles, /\.guest-share-item-description,[\s\S]*overflow-wrap: anywhere/);
  assert.match(styles, /\.guest-share-address-actions,[\s\S]*flex-wrap: wrap/);
  assert.match(styles, /\.guest-share-ticket-image,[\s\S]*width: 100%/);
  assert.match(styles, /\.guest-share-guide-tags[\s\S]*flex-wrap: wrap/);
});

test("mobile form controls avoid iOS focus zoom without disabling page zoom", () => {
  assert.match(html, /width=device-width, initial-scale=1\.0/);
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
  assert.match(styles, /@media \(max-width: 768px\)[\s\S]*input:not\(\[type="checkbox"\]\)[\s\S]*textarea,[\s\S]*select[\s\S]*font-size: 16px !important/);
});
