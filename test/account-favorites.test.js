import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../account-favorites.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const share = fs.readFileSync(new URL("../account-cloud-share.js", import.meta.url), "utf8");
const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");

test("favorite journal has an account-level navigation view and editor", () => {
  assert.match(html, /data-view="favorites"/u);
  assert.match(html, /id="view-favorites"/u);
  assert.match(html, /id="favorite-form"/u);
  assert.match(html, /id="favorite-collection-form"/u);
  assert.match(html, /account-favorites\.js\?v=v2/u);
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

test("adding a favorite creates a trip snapshot instead of a live cloud link", () => {
  assert.match(app, /addFavoriteSnapshotToTrip\(tripId, dayNum, time, favorite\)/u);
  assert.match(app, /favoriteSnapshotId:/u);
  assert.match(app, /由私人收藏日記加入/u);
  assert.doesNotMatch(app, /from\("favorite_items"\)/u);
});

test("favorite release invalidates offline shell", () => {
  assert.match(sw, /voyage-book-shell-v69/u);
  assert.match(sw, /\.\/account-favorites\.js/u);
});
