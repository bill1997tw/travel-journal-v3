const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeCandidate,
  importCandidate,
  restoreImport,
  getLatestBackupReceipt,
  getRecoverableImportBackupReceipt,
  prepareCloudSave,
  commitSavedRevision,
  fingerprintTrip,
  getCloudTripState,
  classifyRemoteUpdate,
  replaceImportedCandidate,
  prepareLocalTripPromotion,
  commitLocalTripPromotion
} = require("../account-cloud-import.js");

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] || null;
    },
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

test("prepares a complete local trip for atomic cloud promotion", () => {
  const storage = createStorage({
    voyage_trips: JSON.stringify([{
      id: "alishan-local",
      title: "阿里山二天一夜",
      location: "台灣，嘉義",
      date: "10/26",
      ledger: [{ id: "expense-1", name: "午餐", cost: 500 }]
    }])
  });

  const payload = prepareLocalTripPromotion(storage, "alishan-local");

  assert.equal(payload.sourceKey, "voyage-local:alishan-local");
  assert.equal(payload.title, "阿里山二天一夜");
  assert.equal(payload.destination, "台灣，嘉義");
  assert.equal(payload.startDate, null);
  assert.equal(payload.state.trip.ledger[0].cost, 500);
});

test("commits cloud identity onto the original local trip with backup", () => {
  const original = [{
    id: "alishan-local",
    title: "阿里山二天一夜",
    ledger: []
  }];
  const storage = createStorage({ voyage_trips: JSON.stringify(original) });

  const receipt = commitLocalTripPromotion(
    storage,
    "alishan-local",
    "cloud-trip-1",
    1,
    1,
    new Date("2026-07-26T10:00:00.000Z")
  );
  const saved = JSON.parse(storage.getItem("voyage_trips"));

  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, "alishan-local");
  assert.equal(saved[0]._cloud.tripId, "cloud-trip-1");
  assert.equal(saved[0]._cloud.revision, 1);
  assert.equal(JSON.parse(storage.getItem(receipt.backupKey))[0]._cloud, undefined);
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

test("prepares a revision-guarded save and commits the returned revision", () => {
  const importedTrip = {
    id: "cloud-trip-cloud-1",
    title: "大阪本機修改",
    ledger: [{ id: "expense-1", name: "章魚燒", cost: 700 }],
    _cloud: {
      tripId: "trip-cloud-1",
      revision: 4,
      schemaVersion: 1
    }
  };
  const storage = createStorage({
    voyage_trips: JSON.stringify([importedTrip])
  });

  const payload = prepareCloudSave(storage, "trip-cloud-1");
  assert.equal(payload.expectedRevision, 4);
  assert.equal(payload.state.source, "voyage-local-storage-v1");
  assert.equal(payload.state.trip.title, "大阪本機修改");
  assert.equal(payload.state.trip._cloud, undefined);

  const updated = commitSavedRevision(
    storage,
    "trip-cloud-1",
    5,
    new Date("2026-07-23T13:00:00.000Z")
  );
  assert.equal(updated._cloud.revision, 5);
  assert.equal(updated._cloud.lastSavedAt, "2026-07-23T13:00:00.000Z");
  assert.equal(updated._cloud.savedFingerprint, fingerprintTrip(updated));
  assert.equal(getCloudTripState(updated), "current");
});

test("tracks current and unsaved state with a deterministic trip fingerprint", () => {
  const baseline = {
    id: "cloud-trip-cloud-1",
    title: "共享旅程",
    location: "日本，大阪",
    itinerary: { days: [{ items: [{ id: "item-1", title: "早餐" }] }] },
    ledger: [{ id: "expense-1", cost: 600 }],
    advances: [{ id: "advance-1", amount: 100 }],
    repayInfo: [{ id: "repay-1", amount: 50 }],
    packingList: [{ id: "packing-1", name: "護照" }],
    todoList: [{ id: "todo-1", name: "訂票" }],
    wishlist: [{ id: "wish-1", name: "大阪城" }],
    diary: { content: "第一天" },
    _cloud: { tripId: "trip-cloud-1", revision: 4 }
  };
  baseline._cloud.savedFingerprint = fingerprintTrip(baseline);

  assert.equal(getCloudTripState(baseline), "current");
  const mutations = [
    (trip) => { trip.title = "共享旅程更新"; },
    (trip) => { trip.itinerary.days[0].items[0].title = "午餐"; },
    (trip) => { trip.ledger[0].cost = 700; },
    (trip) => { trip.advances[0].amount = 200; },
    (trip) => { trip.repayInfo[0].amount = 60; },
    (trip) => { trip.packingList[0].name = "雨傘"; },
    (trip) => { trip.wishlist[0].name = "通天閣"; },
    (trip) => { trip.diary.content = "第二天"; }
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(baseline);
    mutate(changed);
    assert.equal(getCloudTripState(changed), "unsaved");
  }
});

test("queue status takes precedence and local-only trips remain distinct", () => {
  const cloudTrip = {
    id: "cloud-trip-cloud-1",
    title: "共享旅程",
    _cloud: {
      tripId: "trip-cloud-1",
      revision: 4,
      savedFingerprint: fingerprintTrip({ id: "cloud-trip-cloud-1", title: "共享旅程" })
    }
  };

  assert.equal(getCloudTripState({ id: "local-1", title: "本機旅程" }), "local_only");
  assert.equal(getCloudTripState(null), "cloud_only");
  assert.equal(getCloudTripState(cloudTrip, { status: "pending" }), "queued");
  assert.equal(getCloudTripState(cloudTrip, { status: "conflict" }), "conflict");
  assert.equal(getCloudTripState(cloudTrip, { status: "failed" }), "failed");
});

test("classifies newer remote revisions without overwriting local state", () => {
  const currentTrip = {
    id: "cloud-trip-cloud-1",
    title: "共享旅程",
    _cloud: { tripId: "trip-cloud-1", revision: 4 }
  };
  currentTrip._cloud.savedFingerprint = fingerprintTrip(currentTrip);

  assert.equal(classifyRemoteUpdate(currentTrip, null, 4), "ignore");
  assert.equal(classifyRemoteUpdate(currentTrip, null, 5), "refresh_available");

  const changedTrip = structuredClone(currentTrip);
  changedTrip.title = "本機草稿";
  assert.equal(classifyRemoteUpdate(changedTrip, null, 5), "compare_required");
  assert.equal(
    classifyRemoteUpdate(currentTrip, { status: "pending" }, 5),
    "compare_required"
  );
});

test("refreshing a current trip creates a restorable backup", () => {
  const localTrip = {
    id: "cloud-trip-cloud-1",
    title: "revision 4",
    _cloud: { tripId: "trip-cloud-1", revision: 4 }
  };
  localTrip._cloud.savedFingerprint = fingerprintTrip(localTrip);
  const storage = createStorage({
    voyage_trips: JSON.stringify([localTrip]),
    voyage_cloud_latest_backup_key: "voyage_cloud_backup_before_import",
    voyage_cloud_backup_before_import: JSON.stringify([{ id: "local-only" }])
  });
  const remoteTrip = {
    id: "cloud-trip-cloud-1",
    title: "revision 5",
    _cloud: { tripId: "trip-cloud-1", revision: 5 }
  };

  const receipt = replaceImportedCandidate(
    storage,
    remoteTrip,
    new Date("2026-07-25T15:00:00.000Z")
  );
  const refreshed = JSON.parse(storage.getItem("voyage_trips"))[0];
  assert.equal(refreshed.title, "revision 5");
  assert.equal(refreshed._cloud.revision, 5);
  assert.equal(getCloudTripState(refreshed), "current");

  restoreImport(storage, receipt);
  assert.deepEqual(JSON.parse(storage.getItem("voyage_trips")), [localTrip]);
  assert.deepEqual(getLatestBackupReceipt(storage), {
    backupKey: "voyage_cloud_backup_before_import"
  });
});

test("finds the latest backup that removes an imported cloud trip", () => {
  const imported = {
    id: "cloud-trip-cloud-1",
    title: "共享旅程",
    _cloud: { tripId: "trip-cloud-1", revision: 6 }
  };
  const storage = createStorage({
    voyage_trips: JSON.stringify([{ id: "local-1" }, imported]),
    "voyage_cloud_backup_2026-07-25T10-00-00-000Z": JSON.stringify([{ id: "local-1" }]),
    "voyage_cloud_backup_2026-07-25T11-00-00-000Z": JSON.stringify([
      { id: "local-1" },
      { ...imported, _cloud: { ...imported._cloud, revision: 5 } }
    ])
  });

  assert.deepEqual(getRecoverableImportBackupReceipt(storage), {
    backupKey: "voyage_cloud_backup_2026-07-25T10-00-00-000Z"
  });
});

test("compares local and remote trip states across 8 major sections", () => {
  const { compareTripStates } = require("../account-cloud-import.js");
  const localTrip = {
    title: "東京之旅 (本機)",
    location: "日本，東京",
    itinerary: { days: [{ items: [{ id: "item-1" }] }] },
    ledger: [{ cost: 1000 }],
    advances: [],
    repayInfo: [],
    packingList: ["相機"],
    todoList: [],
    diary: { content: "本機日記" },
    _cloud: { revision: 2 }
  };
  const remoteCandidate = {
    title: "東京之旅 (雲端)",
    location: "日本，東京",
    itinerary: { days: [{ items: [{ id: "item-1" }, { id: "item-2" }] }] },
    ledger: [{ cost: 1000 }, { cost: 500 }],
    advances: [{ id: "adv-1" }],
    repayInfo: [],
    packingList: ["相機", "護照"],
    todoList: [],
    diary: { content: "雲端最新日記" },
    _cloud: { revision: 3 }
  };

  const diff = compareTripStates(localTrip, remoteCandidate);
  assert.equal(diff.revisions.local, 2);
  assert.equal(diff.revisions.remote, 3);
  assert.equal(diff.sections.length, 8);
  assert.equal(diff.sections.find(s => s.key === "itinerary").hasDiff, true);
  assert.equal(diff.sections.find(s => s.key === "ledger").hasDiff, true);
});

test("detects content changes even when counts and money totals are unchanged", () => {
  const { compareTripStates } = require("../account-cloud-import.js");
  const localTrip = {
    title: "東京",
    itinerary: { days: [{ items: [{ id: "item-1", title: "淺草" }] }] },
    ledger: [{ id: "expense-1", name: "午餐", cost: 1000 }],
    advances: [{ id: "advance-1", payer: "小明", amount: 500 }],
    repayInfo: [],
    packingList: [{ id: "pack-1", name: "護照" }],
    todoList: [],
    wishlist: [],
    diary: {},
    _cloud: { revision: 2 }
  };
  const remoteTrip = {
    ...localTrip,
    itinerary: { days: [{ items: [{ id: "item-1", title: "晴空塔" }] }] },
    ledger: [{ id: "expense-1", name: "晚餐", cost: 1000 }],
    advances: [{ id: "advance-1", payer: "小華", amount: 500 }],
    packingList: [{ id: "pack-1", name: "雨傘" }],
    _cloud: { revision: 3 }
  };

  const sections = compareTripStates(localTrip, remoteTrip).sections;
  assert.equal(sections.find(s => s.key === "itinerary").hasDiff, true);
  assert.equal(sections.find(s => s.key === "ledger").hasDiff, true);
  assert.equal(sections.find(s => s.key === "advances").hasDiff, true);
  assert.equal(sections.find(s => s.key === "packing").hasDiff, true);
});

test("imports remote candidate as a separate local copy without overwriting local draft", () => {
  const { importRemoteAsCopy } = require("../account-cloud-import.js");
  const localDraft = {
    id: "cloud-trip-cloud-1",
    title: "本機編輯中的草稿",
    _cloud: { tripId: "trip-cloud-1", revision: 2 }
  };
  const storage = createStorage({
    voyage_trips: JSON.stringify([localDraft])
  });

  const remoteCandidate = {
    id: "cloud-trip-cloud-1",
    title: "雲端最新版",
    _cloud: { tripId: "trip-cloud-1", revision: 3 }
  };

  const receipt = importRemoteAsCopy(storage, remoteCandidate);
  const updatedTrips = JSON.parse(storage.getItem("voyage_trips"));

  assert.equal(updatedTrips.length, 2);
  assert.equal(updatedTrips[0].title, "雲端最新版 (雲端 rev 3 副本)");
  assert.equal(updatedTrips[0]._cloud, undefined); // Local standalone copy
  assert.equal(updatedTrips[1].title, "本機編輯中的草稿"); // Local draft byte-for-byte preserved
  assert.equal(updatedTrips[1]._cloud.revision, 2);
});

test("remote-copy import restores the previous backup marker when storage write fails", () => {
  const {
    importRemoteAsCopy,
    getLatestBackupReceipt
  } = require("../account-cloud-import.js");
  const storage = createStorage({
    voyage_trips: JSON.stringify([{ id: "local-trip", title: "本機旅程" }]),
    voyage_cloud_latest_backup_key: "older-backup",
    "older-backup": "[]"
  });
  const originalSetItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key === "voyage_trips") {
      const error = new Error("quota");
      error.name = "QuotaExceededError";
      throw error;
    }
    originalSetItem(key, value);
  };

  assert.throws(
    () => importRemoteAsCopy(storage, {
      id: "cloud-trip",
      title: "雲端旅程",
      _cloud: { tripId: "trip-cloud-1", revision: 3 }
    }, new Date("2026-07-25T10:00:00.000Z")),
    { name: "QuotaExceededError" }
  );
  assert.deepEqual(getLatestBackupReceipt(storage), {
    backupKey: "older-backup"
  });
});
