const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeCandidate,
  importCandidate,
  restoreImport,
  getLatestBackupReceipt
} = require("../account-cloud-import.js");

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

test("normalizes a complete legacy travel journal document", () => {
  const result = normalizeCandidate(
    { id: "trip-cloud-1", title: "大阪", destination: "日本，大阪" },
    {
      revision: 4,
      schema_version: 1,
      state: {
        trip: {
          id: "old-local-id",
          title: "大阪完整旅程",
          location: "日本，大阪",
          itinerary: { days: [{ dayNum: 1 }] },
          ledger: [{ id: "expense-1", name: "章魚燒", cost: 600 }]
        }
      }
    }
  );

  assert.equal(result.candidate.id, "cloud-trip-cloud-1");
  assert.equal(result.candidate._cloud.tripId, "trip-cloud-1");
  assert.equal(result.summary.itineraryDays, 1);
  assert.equal(result.summary.expenses, 1);
  assert.deepEqual(result.warnings, []);
});

test("basic cloud documents become a warned, minimal local trip", () => {
  const result = normalizeCandidate(
    { id: "trip-cloud-2", title: "共享旅程", destination: "日本，大阪" },
    {
      revision: 1,
      schema_version: 1,
      state: {
        expenses: [{ item: "章魚燒", amount: 600, currency: "JPY" }]
      }
    }
  );

  assert.equal(result.summary.sourceFormat, "cloud-basic-v1");
  assert.equal(result.candidate.ledger[0].cost, 600);
  assert.equal(result.candidate.ledger[0].currency, "JPY");
  assert.equal(result.warnings.length, 1);
});

test("import creates a backup, blocks duplicates, and can be restored", () => {
  const previousTrips = [{ id: "local-1", title: "原本旅程" }];
  const storage = createStorage({
    voyage_trips: JSON.stringify(previousTrips)
  });
  const candidate = {
    id: "cloud-trip-cloud-1",
    title: "大阪",
    _cloud: { tripId: "trip-cloud-1" }
  };

  const receipt = importCandidate(
    storage,
    candidate,
    new Date("2026-07-23T12:34:56.000Z")
  );
  const imported = JSON.parse(storage.getItem("voyage_trips"));

  assert.equal(imported.length, 2);
  assert.equal(imported[0].title, "大阪");
  assert.equal(
    storage.getItem(receipt.backupKey),
    JSON.stringify(previousTrips)
  );
  assert.deepEqual(getLatestBackupReceipt(storage), {
    backupKey: receipt.backupKey
  });
  assert.throws(
    () => importCandidate(storage, candidate),
    { name: "DuplicateCloudTripError" }
  );

  restoreImport(storage, receipt);
  assert.deepEqual(JSON.parse(storage.getItem("voyage_trips")), previousTrips);
  assert.equal(getLatestBackupReceipt(storage), null);
});
