const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeQueueRecord,
  classifySaveError
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
