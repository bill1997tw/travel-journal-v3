const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ACTIVE_SCOPE_KEY,
  GUEST_SCOPE,
  accountScope,
  capture,
  readVault,
  switchScope
} = require("../local-account-vault.js");

function storageFixture(initial = {}, failKey = null) {
  const values = new Map(Object.entries(initial));
  let failurePending = Boolean(failKey);
  return {
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (key === failKey && failurePending) {
        failurePending = false;
        throw new Error("quota");
      }
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

test("first upgrade assigns existing local data to the current signed-in account", () => {
  const storage = storageFixture({
    voyage_trips: JSON.stringify([{ id: "yilan" }]),
    voyage_quick_notes: JSON.stringify(["車票"]),
    theme: "dark"
  });
  const scope = accountScope(USER_A);
  const result = switchScope(storage, scope);

  assert.equal(result.migrated, true);
  assert.equal(storage.getItem(ACTIVE_SCOPE_KEY), scope);
  assert.equal(JSON.parse(storage.getItem("voyage_trips"))[0].id, "yilan");
  assert.equal(JSON.parse(readVault(storage, scope).voyage_trips)[0].id, "yilan");
  assert.equal(storage.getItem("theme"), "dark");
});

test("account switching hides private local trips and restores them on return", () => {
  const storage = storageFixture({
    voyage_trips: JSON.stringify([{ id: "owner-a-trip" }]),
    voyage_cloud_backup_a: JSON.stringify([{ id: "backup-a" }])
  });
  const scopeA = accountScope(USER_A);
  const scopeB = accountScope(USER_B);
  switchScope(storage, scopeA);
  switchScope(storage, scopeB);

  assert.equal(storage.getItem("voyage_trips"), null);
  assert.equal(storage.getItem("voyage_cloud_backup_a"), null);
  storage.setItem("voyage_trips", JSON.stringify([{ id: "owner-b-trip" }]));

  switchScope(storage, scopeA);
  assert.equal(JSON.parse(storage.getItem("voyage_trips"))[0].id, "owner-a-trip");
  assert.equal(JSON.parse(storage.getItem("voyage_cloud_backup_a"))[0].id, "backup-a");

  switchScope(storage, scopeB);
  assert.equal(JSON.parse(storage.getItem("voyage_trips"))[0].id, "owner-b-trip");
});

test("sign-out keeps account data in its vault and exposes only guest data", () => {
  const scopeA = accountScope(USER_A);
  const storage = storageFixture({
    voyage_trips: JSON.stringify([{ id: "private-trip" }])
  });
  switchScope(storage, scopeA);
  switchScope(storage, GUEST_SCOPE);
  assert.equal(storage.getItem("voyage_trips"), null);
  assert.equal(JSON.parse(readVault(storage, scopeA).voyage_trips)[0].id, "private-trip");
});

test("a restore failure rolls back the previous account data and scope", () => {
  const scopeA = accountScope(USER_A);
  const scopeB = accountScope(USER_B);
  const healthy = storageFixture({ voyage_trips: JSON.stringify([{ id: "a" }]) });
  switchScope(healthy, scopeA);
  switchScope(healthy, scopeB);
  healthy.setItem("voyage_trips", JSON.stringify([{ id: "b" }]));
  switchScope(healthy, scopeA);

  const failing = storageFixture(
    Object.fromEntries(
      Array.from({ length: healthy.length }, (_, index) => {
        const key = healthy.key(index);
        return [key, healthy.getItem(key)];
      })
    ),
    "voyage_trips"
  );
  assert.throws(() => switchScope(failing, scopeB), /quota/);
  assert.equal(failing.getItem(ACTIVE_SCOPE_KEY), scopeA);
  assert.equal(JSON.parse(capture(failing).voyage_trips)[0].id, "a");
});
