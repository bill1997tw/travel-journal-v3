(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.VoyageExchangeRates = Object.freeze(api);
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const CACHE_KEY = "voyage_exchange_rate_snapshot_v1";
  const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  const SUPPORTED_CURRENCIES = Object.freeze([
    "TWD", "JPY", "USD", "EUR", "KRW", "THB", "NZD", "HKD", "GBP"
  ]);
  const FALLBACK_RATES = Object.freeze({
    TWD: 1,
    JPY: 4.65,
    USD: 0.031,
    EUR: 0.0285,
    KRW: 42.5,
    THB: 1.12,
    NZD: 0.052,
    HKD: 0.242,
    GBP: 0.0245
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeRates(rates) {
    if (!rates || typeof rates !== "object" || Array.isArray(rates)) {
      throw new TypeError("exchange_rates_invalid");
    }
    const normalized = {};
    for (const currency of SUPPORTED_CURRENCIES) {
      const rate = Number(rates[currency]);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new TypeError(`exchange_rate_invalid:${currency}`);
      }
      normalized[currency] = rate;
    }
    if (normalized.TWD !== 1) {
      throw new TypeError("exchange_rate_base_invalid");
    }
    return normalized;
  }

  function normalizeTimestamp(value, fallback) {
    const timestamp = new Date(value || fallback);
    if (Number.isNaN(timestamp.getTime())) {
      throw new TypeError("exchange_rate_timestamp_invalid");
    }
    return timestamp.toISOString();
  }

  function normalizeApiResponse(payload, now = new Date()) {
    if (
      !payload
      || payload.result !== "success"
      || String(payload.base_code || "").toUpperCase() !== "TWD"
    ) {
      throw new TypeError("exchange_rate_response_invalid");
    }
    const observedAt = payload.time_last_update_unix
      ? new Date(Number(payload.time_last_update_unix) * 1000)
      : payload.time_last_update_utc;
    return Object.freeze({
      baseCurrency: "TWD",
      rates: Object.freeze(normalizeRates(payload.rates)),
      observedAt: normalizeTimestamp(observedAt, now),
      fetchedAt: normalizeTimestamp(now, now),
      provider: "open.er-api.com",
      status: "live"
    });
  }

  function fallbackSnapshot() {
    return Object.freeze({
      baseCurrency: "TWD",
      rates: FALLBACK_RATES,
      observedAt: null,
      fetchedAt: null,
      provider: "built-in-estimate",
      status: "estimate"
    });
  }

  function saveSnapshot(storage, snapshot) {
    if (!storage || typeof storage.setItem !== "function") return false;
    try {
      storage.setItem(CACHE_KEY, JSON.stringify(snapshot));
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadSnapshot(storage, now = new Date()) {
    if (!storage || typeof storage.getItem !== "function") return fallbackSnapshot();
    try {
      const parsed = JSON.parse(storage.getItem(CACHE_KEY) || "null");
      if (!parsed || parsed.baseCurrency !== "TWD") return fallbackSnapshot();
      const fetchedAt = normalizeTimestamp(parsed.fetchedAt, now);
      const age = now.getTime() - new Date(fetchedAt).getTime();
      if (age < 0 || age > MAX_CACHE_AGE_MS) return fallbackSnapshot();
      return Object.freeze({
        baseCurrency: "TWD",
        rates: Object.freeze(normalizeRates(parsed.rates)),
        observedAt: normalizeTimestamp(parsed.observedAt, fetchedAt),
        fetchedAt,
        provider: String(parsed.provider || "cached"),
        status: "cached"
      });
    } catch (error) {
      return fallbackSnapshot();
    }
  }

  function convertReference(amount, fromCurrency, toCurrency, snapshot) {
    const numericAmount = Number(amount);
    const from = String(fromCurrency || "").toUpperCase();
    const to = String(toCurrency || "").toUpperCase();
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      throw new TypeError("exchange_amount_invalid");
    }
    const rates = normalizeRates(snapshot?.rates);
    if (!SUPPORTED_CURRENCIES.includes(from) || !SUPPORTED_CURRENCIES.includes(to)) {
      throw new TypeError("exchange_currency_unsupported");
    }
    return (numericAmount / rates[from]) * rates[to];
  }

  function createRateAudit(snapshot, quoteCurrency) {
    const currency = String(quoteCurrency || "").toUpperCase();
    const rates = normalizeRates(snapshot?.rates);
    if (currency === "TWD" || !SUPPORTED_CURRENCIES.includes(currency)) {
      throw new TypeError("exchange_quote_currency_invalid");
    }
    return Object.freeze({
      baseCurrency: "TWD",
      quoteCurrency: currency,
      quotePerBase: rates[currency],
      observedAt: snapshot.observedAt || null,
      fetchedAt: snapshot.fetchedAt || null,
      provider: String(snapshot.provider || "unknown"),
      status: String(snapshot.status || "unknown")
    });
  }

  return {
    CACHE_KEY,
    SUPPORTED_CURRENCIES,
    normalizeApiResponse,
    fallbackSnapshot,
    saveSnapshot,
    loadSnapshot,
    convertReference,
    createRateAudit,
    clone
  };
});
