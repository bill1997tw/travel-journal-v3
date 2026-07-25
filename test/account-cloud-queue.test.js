const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeQueueRecord,
  classifySaveError,
  isOfflineMode,
  resolveQueuedBaseRevision,
  shouldAutoConfirmDiscard,
  isRealtimeTestMode
} = require("../account-cloud-queue.js");

test("normalizes one durable draft per trip with stable creation time", () => {
  const first = normalizeQueueRecord({
    tripId: "trip-1",
    title: "大阪",
    baseRevision: 4,
    schemaVersion: 1,
    state: { trip: { title: "大阪" } }
  }, null, new Date("2026-07-25T10:00:00.000Z"));
  const coalesced = normalizeQueueRecord({
    tripId: "trip-1",
    title: "大阪更新",
    baseRevision: 4,
    schemaVersion: 1,
    state: { trip: { title: "大阪更新" } }
  }, first, new Date("2026-07-25T10:05:00.000Z"));

  assert.equal(coalesced.tripId, "trip-1");
  assert.equal(coalesced.createdAt, "2026-07-25T10:00:00.000Z");
  assert.equal(coalesced.updatedAt, "2026-07-25T10:05:00.000Z");
  assert.equal(coalesced.state.trip.title, "大阪更新");
  assert.equal(coalesced.status, "pending");
});

test("classifies conflict and authorization errors as non-transient", () => {
  assert.equal(
    classifySaveError({ message: "trip_revision_conflict" }),
    "conflict"
  );
  assert.equal(
    classifySaveError({ code: "42501", message: "trip_edit_forbidden" }),
    "failed"
  );
  assert.equal(
    classifySaveError({ message: "Failed to fetch" }),
    "transient"
  );
});

test("allows offline simulation only on localhost", () => {
  assert.equal(isOfflineMode({
    online: true,
    hostname: "127.0.0.1",
    search: "?cloudTestOffline=1"
  }), true);
  assert.equal(isOfflineMode({
    online: true,
    hostname: "localhost",
    search: "?cloudTestOffline=1"
  }), true);
  assert.equal(isOfflineMode({
    online: true,
    hostname: "voyage.example.com",
    search: "?cloudTestOffline=1"
  }), false);
  assert.equal(isOfflineMode({
    online: false,
    hostname: "voyage.example.com",
    search: ""
  }), true);
});

test("allows stale-revision conflict simulation only on localhost", () => {
  assert.equal(resolveQueuedBaseRevision(4, {
    hostname: "127.0.0.1",
    search: "?cloudTestStaleRevision=1"
  }), 3);
  assert.equal(resolveQueuedBaseRevision(4, {
    hostname: "voyage.example.com",
    search: "?cloudTestStaleRevision=1"
  }), 4);
  assert.equal(resolveQueuedBaseRevision(0, {
    hostname: "localhost",
    search: "?cloudTestStaleRevision=1"
  }), 0);
});

test("allows discard auto-confirm only on localhost", () => {
  assert.equal(shouldAutoConfirmDiscard({
    hostname: "localhost",
    search: "?cloudTestAutoConfirmDiscard=1"
  }), true);
  assert.equal(shouldAutoConfirmDiscard({
    hostname: "voyage.example.com",
    search: "?cloudTestAutoConfirmDiscard=1"
  }), false);
});

test("allows realtime test updates only on localhost", () => {
  assert.equal(isRealtimeTestMode({
    hostname: "127.0.0.1",
    search: "?cloudTestRealtime=1"
  }), true);
  assert.equal(isRealtimeTestMode({
    hostname: "voyage.example.com",
    search: "?cloudTestRealtime=1"
  }), false);
});
