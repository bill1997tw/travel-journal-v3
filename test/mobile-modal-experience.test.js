import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../mobile-viewport.css", import.meta.url), "utf8");
const viewport = fs.readFileSync(new URL("../mobile-viewport.js", import.meta.url), "utf8");
const cloud = fs.readFileSync(new URL("../account-cloud.js", import.meta.url), "utf8");

const modalIds = [
  "memory-moment-modal",
  "trip-editor-modal",
  "schedule-modal",
  "alternative-modal",
  "expense-modal",
  "advance-modal",
  "repay-modal",
  "itinerary-importer-modal",
  "route-import-modal",
  "add-to-schedule-modal",
  "day-summary-modal",
  "guide-modal",
  "favorite-modal",
  "favorite-collection-modal",
  "favorite-trip-modal",
  "voucher-modal",
  "exchange-rate-modal",
  "lightbox-modal",
  "guest-share-modal"
];

test("every static input and viewer dialog uses the shared modal overlay", () => {
  for (const id of modalIds) {
    assert.match(
      html,
      new RegExp(`class="modal-overlay[^"]*" id="${id}"`),
      `${id} must inherit the centered mobile dialog behavior`
    );
  }
  assert.match(cloud, /overlay\.className = "account-cloud-overlay"/);
});

test("mobile dialogs are centered inside the live visual viewport", () => {
  assert.match(styles, /\.modal-overlay\.active,[\s\S]*align-items: center !important/);
  assert.match(styles, /\.account-cloud-overlay\.is-open[\s\S]*justify-content: center !important/);
  assert.match(styles, /\.modal-overlay \.modal-content,[\s\S]*margin: auto !important/);
  assert.match(styles, /max-height:[\s\S]*--voyage-visual-viewport-height/);
});

test("open dialogs lock the page and hide overlapping mobile shortcuts", () => {
  assert.match(viewport, /function lockBackgroundScroll\(\)/);
  assert.match(viewport, /documentRef\.body\.style\.position = "fixed"/);
  assert.match(viewport, /MutationObserver\(syncOpenDialogExperience\)/);
  assert.match(styles, /body\.voyage-modal-scroll-locked :is\(\.mobile-floating-dock, \.mobile-back-to-top, #trips-add-btn\)/);
});

test("inline time editor receives the same centered and locked mobile treatment", () => {
  assert.match(viewport, /\.inline-time-editor:not\(\[hidden\]\)/);
  assert.match(styles, /body\.voyage-inline-editor-open::before/);
  assert.match(styles, /body\.voyage-inline-editor-open \.inline-time-editor:not\(\[hidden\]\)[\s\S]*translateY\(-50%\)/);
});
