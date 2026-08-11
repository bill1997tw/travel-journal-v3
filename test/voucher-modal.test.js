import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const htmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const stylesSource = fs.readFileSync(new URL("../index.css", import.meta.url), "utf8");

test("voucher modal starts without flight details until the flight category is selected", () => {
  assert.match(htmlSource, /id="v-category"[\s\S]*?<option value="" selected disabled>請選擇憑證類別<\/option>/);
  assert.match(htmlSource, /id="v-flight-details-container" hidden/);
  assert.match(appSource, /flightSection\.hidden = category\.value !== "機票"/);
  assert.match(appSource, /getElementById\("v-category"\)\.addEventListener\("change", syncVoucherFlightSectionVisibility\)/);
  assert.match(appSource, /syncVoucherFlightSectionVisibility\(\);[\s\S]*modal\.classList\.add\("active"\)/);
});

test("voucher modal expands on desktop and keeps a single-column mobile layout", () => {
  assert.match(htmlSource, /class="modal-content glass voucher-modal-content"/);
  assert.match(stylesSource, /#voucher-modal \.voucher-modal-content\s*\{[\s\S]*max-width: 960px/);
  assert.match(stylesSource, /@media \(min-width: 769px\)[\s\S]*\.voucher-flight-section \.form-grid/);
  assert.match(stylesSource, /@media \(max-width: 768px\)[\s\S]*#voucher-modal \.form-grid[\s\S]*grid-template-columns: 1fr !important/);
});
