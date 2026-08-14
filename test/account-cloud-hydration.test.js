const test = require("node:test");
const assert = require("node:assert/strict");
const {
  fingerprintTrip,
  hydrateCloudCandidates,
  prepareLocalTripPromotion
} = require("../account-cloud-import.js");

function createStorage(initialTrips = []) {
  const values = new Map([["voyage_trips", JSON.stringify(initialTrips)]]);
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] || null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function remoteCandidate(revision = 1, title = "宜蘭兩天一夜") {
  const trip = {
    id: "cloud-cloud-x",
    clientTripUuid: "client-trip-x",
    title,
    itinerary: { days: [] },
    ledger: [],
    _cloud: {
      tripId: "cloud-x",
      revision,
      schemaVersion: 1
    }
  };
  trip._cloud.savedFingerprint = fingerprintTrip(trip);
  return trip;
}

function localCandidate(revision = 1, title = "宜蘭兩天一夜") {
  const trip = remoteCandidate(revision, title);
  trip.id = "stable-local-id";
  trip._cloud.savedFingerprint = fingerprintTrip(trip);
  return trip;
}

test("empty local storage hydrates the existing cloud trip without creating cloud identity", () => {
  const storage = createStorage();
  const result = hydrateCloudCandidates(storage, [remoteCandidate()]);
  const saved = JSON.parse(storage.getItem("voyage_trips"));

  assert.equal(result.changed, true);
  assert.deepEqual(result.results, [{ cloudTripId: "cloud-x", action: "hydrated" }]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0]._cloud.tripId, "cloud-x");
  assert.equal(saved[0].clientTripUuid, "client-trip-x");
});

test("matching local revision and fingerprint reuse the existing cache", () => {
  const local = localCandidate();
  const storage = createStorage([local]);
  const result = hydrateCloudCandidates(storage, [remoteCandidate()]);

  assert.equal(result.changed, false);
  assert.equal(result.results[0].action, "reused");
  assert.deepEqual(JSON.parse(storage.getItem("voyage_trips")), [local]);
});

test("repeated login hydration reuses one local cache instead of duplicating it", () => {
  const storage = createStorage();
  hydrateCloudCandidates(storage, [remoteCandidate()]);
  const second = hydrateCloudCandidates(storage, [remoteCandidate()]);
  const saved = JSON.parse(storage.getItem("voyage_trips"));

  assert.equal(second.changed, false);
  assert.equal(second.results[0].action, "reused");
  assert.equal(saved.length, 1);
  assert.equal(saved[0]._cloud.tripId, "cloud-x");
});

test("separate device vaults hydrate the same cloud identity independently", () => {
  const desktopStorage = createStorage();
  const mobileStorage = createStorage();
  hydrateCloudCandidates(desktopStorage, [remoteCandidate()]);
  hydrateCloudCandidates(mobileStorage, [remoteCandidate()]);

  const desktop = JSON.parse(desktopStorage.getItem("voyage_trips"))[0];
  const mobile = JSON.parse(mobileStorage.getItem("voyage_trips"))[0];
  assert.equal(desktop._cloud.tripId, "cloud-x");
  assert.equal(mobile._cloud.tripId, "cloud-x");
  assert.equal(desktop.clientTripUuid, mobile.clientTripUuid);
});

test("adding durable identity metadata does not manufacture unsaved trip content", () => {
  const before = localCandidate();
  delete before.clientTripUuid;
  before._cloud.savedFingerprint = fingerprintTrip(before);
  const after = structuredClone(before);
  after.clientTripUuid = "client-trip-x";

  assert.equal(fingerprintTrip(after), before._cloud.savedFingerprint);
});

test("newer cloud revision refreshes a clean cache while preserving local UI ID", () => {
  const storage = createStorage([localCandidate(1)]);
  const result = hydrateCloudCandidates(storage, [remoteCandidate(2, "雲端新名稱")]);
  const saved = JSON.parse(storage.getItem("voyage_trips"));

  assert.equal(result.results[0].action, "refreshed");
  assert.equal(saved[0].id, "stable-local-id");
  assert.equal(saved[0].title, "雲端新名稱");
  assert.equal(saved[0]._cloud.revision, 2);
  assert.ok(result.receipt?.backupKey);
});

test("queued offline draft blocks cloud hydration overwrite", () => {
  const local = localCandidate(1);
  local.title = "手機離線草稿";
  const storage = createStorage([local]);
  const result = hydrateCloudCandidates(
    storage,
    [remoteCandidate(2, "桌機新版")],
    [{ tripId: "cloud-x", status: "pending" }]
  );

  assert.equal(result.changed, false);
  assert.equal(result.results[0].action, "draft_blocked");
  assert.equal(JSON.parse(storage.getItem("voyage_trips"))[0].title, "手機離線草稿");
});

test("stale differing local content enters conflict instead of overwrite", () => {
  const local = localCandidate(1);
  local.title = "未同步本機內容";
  const storage = createStorage([local]);
  const result = hydrateCloudCandidates(storage, [remoteCandidate(2, "雲端內容")]);

  assert.equal(result.changed, false);
  assert.equal(result.results[0].action, "conflict");
  assert.equal(JSON.parse(storage.getItem("voyage_trips"))[0].title, "未同步本機內容");
});

test("duplicate local cloud identities are diagnosed without deletion or merge", () => {
  const first = localCandidate(1);
  const second = structuredClone(first);
  second.id = "second-local-id";
  const storage = createStorage([first, second]);
  const result = hydrateCloudCandidates(storage, [remoteCandidate(2)]);

  assert.equal(result.changed, false);
  assert.equal(result.results[0].action, "duplicate_conflict");
  assert.equal(result.diagnostics.length, 1);
  assert.equal(JSON.parse(storage.getItem("voyage_trips")).length, 2);
});

test("promotion persists one durable client identity and reuses its source key", () => {
  const storage = createStorage([{
    id: "legacy-local",
    clientTripUuid: "client-promotion-x",
    title: "本機新旅程",
    ledger: []
  }]);
  const first = prepareLocalTripPromotion(storage, "legacy-local");
  const second = prepareLocalTripPromotion(storage, "legacy-local");

  assert.equal(first.sourceKey, "voyage-client:client-promotion-x");
  assert.equal(second.sourceKey, first.sourceKey);
  assert.equal(first.state.trip.clientTripUuid, "client-promotion-x");
});
