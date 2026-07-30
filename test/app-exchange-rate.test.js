import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const htmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("foreign expenses retain their original amount and audited rate snapshot", () => {
  assert.match(appSource, /originalCurrency: currency/);
  assert.match(appSource, /originalAmount: inputCost/);
  assert.match(appSource, /exchangeRateSnapshot/);
  assert.match(appSource, /createRateAudit\(/);
  assert.doesNotMatch(appSource, /LIVE_EXCHANGE_RATES\[currency\] \|\| 1/);
});

test("exchange rates use validation, timeout, cache and visible source status", () => {
  assert.match(htmlSource, /exchange-rate\.js\?v=v1/);
  assert.match(htmlSource, /app\.js\?v=v35/);
  assert.match(appSource, /loadSnapshot\(localStorage\)/);
  assert.match(appSource, /controller\.abort\(\), 8000/);
  assert.match(appSource, /cache: "no-store"/);
  assert.match(appSource, /離線估算（非即時）/);
  assert.match(appSource, /最近匯率/);
  assert.match(appSource, /離線估算匯率（非即時）/);
});
