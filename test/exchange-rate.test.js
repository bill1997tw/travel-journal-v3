const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CACHE_KEY,
  normalizeApiResponse,
  fallbackSnapshot,
  saveSnapshot,
  loadSnapshot,
  convertReference,
  createRateAudit
} = require("../exchange-rate.js");

function storageFixture() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

function apiPayload(overrides = {}) {
  return {
    result: "success",
    base_code: "TWD",
    time_last_update_unix: 1785373200,
    rates: {
      TWD: 1,
      JPY: 5.0307,
      USD: 0.031,
      EUR: 0.027,
      KRW: 43,
      THB: 1.05,
      NZD: 0.052,
      HKD: 0.24,
      GBP: 0.023
    },
    ...overrides
  };
}

test("normalizes and audits a validated TWD exchange-rate response", () => {
  const snapshot = normalizeApiResponse(
    apiPayload(),
    new Date("2026-07-30T10:00:00.000Z")
  );
  assert.equal(snapshot.status, "live");
  assert.ok(
    Math.abs(convertReference(10000, "TWD", "JPY", snapshot) - 50307) < 1e-9
  );
  assert.deepEqual(createRateAudit(snapshot, "JPY"), {
    baseCurrency: "TWD",
    quoteCurrency: "JPY",
    quotePerBase: 5.0307,
    observedAt: new Date(1785373200 * 1000).toISOString(),
    fetchedAt: "2026-07-30T10:00:00.000Z",
    provider: "open.er-api.com",
    status: "live"
  });
});

test("rejects incomplete responses instead of silently using a one-to-one rate", () => {
  const payload = apiPayload();
  delete payload.rates.JPY;
  assert.throws(() => normalizeApiResponse(payload), /exchange_rate_invalid:JPY/);
  assert.throws(
    () => normalizeApiResponse(apiPayload({ base_code: "USD" })),
    /exchange_rate_response_invalid/
  );
});

test("uses a recent validated cache and expires old or malformed cache data", () => {
  const storage = storageFixture();
  const snapshot = normalizeApiResponse(
    apiPayload(),
    new Date("2026-07-30T10:00:00.000Z")
  );
  assert.equal(saveSnapshot(storage, snapshot), true);
  assert.ok(storage.getItem(CACHE_KEY));
  assert.equal(
    loadSnapshot(storage, new Date("2026-08-02T10:00:00.000Z")).status,
    "cached"
  );
  assert.equal(
    loadSnapshot(storage, new Date("2026-08-08T10:00:00.001Z")).status,
    "estimate"
  );
  storage.setItem(CACHE_KEY, "{broken");
  assert.deepEqual(loadSnapshot(storage).rates, fallbackSnapshot().rates);
});
