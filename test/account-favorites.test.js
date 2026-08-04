import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../account-favorites.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const share = fs.readFileSync(new URL("../account-cloud-share.js", import.meta.url), "utf8");
const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../index.css", import.meta.url), "utf8");

test("favorite journal has an account-level navigation view and editor", () => {
  assert.match(html, /data-view="favorites"/u);
  assert.match(html, /id="view-favorites"/u);
  assert.match(html, /id="favorite-form"/u);
  assert.match(html, /id="favorite-collection-form"/u);
  assert.match(html, /account-favorites\.js\?v=v5/u);
});

test("favorites load and write only through private account tables", () => {
  assert.match(source, /from\("favorite_collections"\)/u);
  assert.match(source, /from\("favorite_items"\)/u);
  assert.match(source, /user_id: state\.user\.id/u);
  assert.match(source, /\.eq\("user_id", state\.user\.id\)/u);
  assert.doesNotMatch(share, /favorite_items/u);
  assert.doesNotMatch(share, /favorite_collections/u);
});

test("favorite sources and covers accept web URLs only", () => {
  assert.match(source, /url\.protocol === "http:" \|\| url\.protocol === "https:"/u);
  assert.match(source, /來源網址格式不正確/u);
  assert.match(source, /封面網址格式不正確/u);
  assert.doesNotMatch(source, /<iframe/u);
});

test("favorite tags are entered and removed as separate colored chips", () => {
  assert.match(html, /id="favorite-tag-input"/u);
  assert.match(html, /id="favorite-tag-add"/u);
  assert.match(source, /data-favorite-tag-remove/u);
  assert.match(source, /favorite-tag-color-/u);
  assert.match(source, /event\.key !== "Enter"/u);
});

test("favorite covers support private drag and drop uploads", () => {
  assert.match(html, /id="favorite-cover-upload"/u);
  assert.match(html, /accept="image\/jpeg,image\/png,image\/webp"/u);
  assert.match(source, /storage:\/\//u);
  assert.match(source, /\.storage\s*\.from\(STORAGE_BUCKET\)\s*\.upload/su);
  assert.match(source, /createSignedUrl\(path, 60 \* 60\)/u);
  assert.match(source, /favorite-cover-error/u);
});

test("favorite card actions keep one clear primary action and relaxed utility rows", () => {
  assert.match(source, /class="favorite-add-trip"/u);
  assert.match(source, /class="favorite-card-secondary-actions"/u);
  assert.match(source, /class="favorite-source-link"/u);
  assert.match(css, /\.favorite-card-actions\s*\{[\s\S]*display:\s*grid/u);
  assert.match(css, /\.favorite-card-actions::before\s*\{[\s\S]*background:\s*var\(--border-color\)/u);
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u);
  assert.match(css, /\.favorite-card-secondary-actions \.favorite-source-link\s*\{[\s\S]*grid-column:\s*1 \/ -1/u);
  assert.match(css, /\.favorite-card-actions \.favorite-add-trip\s*\{[\s\S]*min-height:\s*46px/u);
});

test("adding a favorite creates a trip snapshot instead of a live cloud link", () => {
  assert.match(app, /addFavoriteSnapshotToTrip\(tripId, dayNum, time, favorite\)/u);
  assert.match(app, /favoriteSnapshotId:/u);
  assert.match(app, /由私人收藏日記加入/u);
  assert.doesNotMatch(app, /from\("favorite_items"\)/u);
});

test("favorite release invalidates offline shell", () => {
  assert.match(sw, /voyage-book-shell-v72/u);
  assert.match(sw, /\.\/account-favorites\.js/u);
});
