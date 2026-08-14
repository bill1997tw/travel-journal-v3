const test = require("node:test");
const assert = require("node:assert/strict");
const identity = require("../trip-identity.js");
const cloudImport = require("../account-cloud-import.js");

function cloudTrip(localId, cloudId, title = "宜蘭兩天一夜") {
  const trip = {
    id: localId,
    clientTripUuid: cloudId,
    title,
    _cloud: { tripId: cloudId, revision: 3 }
  };
  trip._cloud.savedFingerprint = cloudImport.fingerprintTrip(trip);
  return trip;
}

test("different local IDs with the same cloud UUID remain one cloud identity", () => {
  const desktop = cloudTrip("desktop-local", "cloud-trip-x");
  const mobile = cloudTrip("mobile-local", "cloud-trip-x");

  assert.equal(identity.getCloudTripId(desktop), "cloud-trip-x");
  assert.equal(identity.getCloudTripId(mobile), "cloud-trip-x");
  assert.equal(
    identity.findLocalTripsByCloudId([desktop, mobile], "cloud-trip-x").length,
    2
  );
  assert.equal(
    identity.ensureSingleLocalWorkingCopy([desktop, mobile], "cloud-trip-x").status,
    "duplicate"
  );
});

test("duplicate diagnostics preserve every copy and report unsynced metadata", () => {
  const desktop = cloudTrip("desktop-local", "cloud-trip-x");
  const mobile = cloudTrip("mobile-local", "cloud-trip-x");
  mobile.title = "宜蘭更新草稿";
  const before = structuredClone([desktop, mobile]);

  const diagnostics = identity.diagnoseDuplicateCloudTrips(
    [desktop, mobile],
    {
      cloudRevisions: { "cloud-trip-x": 4 },
      queuedDrafts: [{ tripId: "cloud-trip-x", status: "pending" }],
      fingerprint: cloudImport.fingerprintTrip
    }
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].cloudTripId, "cloud-trip-x");
  assert.equal(diagnostics[0].copies.length, 2);
  assert.equal(diagnostics[0].hasQueuedDraft, true);
  assert.equal(diagnostics[0].copies[1].hasUnsyncedChanges, true);
  assert.deepEqual([desktop, mobile], before);
});

test("renaming a trip never changes cloud or durable client identity", () => {
  const trip = cloudTrip("local-a", "cloud-trip-x", "舊名稱");
  const before = {
    cloud: identity.getCloudTripId(trip),
    client: identity.getClientTripUuid(trip)
  };
  trip.title = "新名稱";
  assert.equal(identity.getCloudTripId(trip), before.cloud);
  assert.equal(identity.getClientTripUuid(trip), before.client);
});

test("new local trips receive one immutable promotion source identity", () => {
  const trip = { id: "legacy-local-id", title: "新旅程" };
  const generated = "11111111-2222-4333-8444-555555555555";
  const first = identity.promotionSourceKey(trip, { randomUuid: () => generated });
  const second = identity.promotionSourceKey(trip, { randomUuid: () => "must-not-run" });

  assert.equal(first, `voyage-client:${generated}`);
  assert.equal(second, first);
  assert.equal(trip.clientTripUuid, generated);
});
