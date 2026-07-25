const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeSnapshot,
  formatMoney,
  buildViewModel,
  createRepository,
  getLocalhostTestSnapshot
} = require("../account-cloud-ledger.js");

function rawSnapshot() {
  return {
    trip_id: "trip-1",
    ledger_revision: "7",
    members: [
      { member_id: "member-a", display_name: "小明", role: "owner" },
      { member_id: "member-b", display_name: "小華", role: "viewer" }
    ],
    entries: [
      {
        entry_id: "expense-1",
        kind: "expense",
        amount_minor: "1400000",
        currency: "TWD",
        occurred_at: "2026-07-26T10:00:00.000Z",
        payer_id: "member-b",
        title: "小八玩偶",
        shares: [
          { member_id: "member-a", amount_minor: "700000" },
          { member_id: "member-b", amount_minor: "700000" }
        ]
      },
      {
        entry_id: "borrowing-1",
        kind: "borrowing",
        amount_minor: "1400000",
        currency: "TWD",
        occurred_at: "2026-07-26T10:01:00.000Z",
        borrower_id: "member-a",
        lender_id: "member-b"
      },
      {
        entry_id: "repayment-1",
        kind: "repayment",
        amount_minor: "500000",
        currency: "TWD",
        occurred_at: "2026-07-26T10:02:00.000Z",
        payer_id: "member-a",
        receiver_id: "member-b"
      }
    ],
    settlements: [
      {
        payer_id: "member-a",
        receiver_id: "member-b",
        amount_minor: "900000",
        currency: "TWD"
      }
    ]
  };
}

test("normalizes bigint wire values without recalculating settlements", () => {
  const snapshot = normalizeSnapshot(rawSnapshot());
  assert.equal(snapshot.ledgerRevision, 7);
  assert.equal(snapshot.entries[0].amount.minorUnits, 1400000);
  assert.equal(snapshot.settlements[0].amount.minorUnits, 900000);
});

test("builds direct borrowing and repayment wording from member names", () => {
  const view = buildViewModel(normalizeSnapshot(rawSnapshot()));
  assert.equal(view.entries[1].summary, "小明 → 跟 小華 借 TWD 14,000.00");
  assert.equal(view.entries[2].summary, "小明 → 還款 TWD 5,000.00 給 小華");
  assert.equal(view.settlements[0].summary, "小明 → 小華");
  assert.equal(view.settlements[0].amountLabel, "TWD 9,000.00");
});

test("formats currencies according to their ISO decimal scale", () => {
  assert.equal(formatMoney({ minorUnits: 50307, currency: "JPY" }), "JPY 50,307");
  assert.equal(formatMoney({ minorUnits: 1000000, currency: "TWD" }), "TWD 10,000.00");
});

test("repository reads only through get_ledger_snapshot", async () => {
  const calls = [];
  const repository = createRepository({
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: rawSnapshot(), error: null };
    }
  });
  const snapshot = await repository.getSnapshot("trip-1");
  assert.deepEqual(calls, [{
    name: "get_ledger_snapshot",
    args: { target_trip_id: "trip-1" }
  }]);
  assert.equal(snapshot.entries.length, 3);
});

test("localhost fixture covers expense, borrowing, repayment, and settlement", () => {
  const snapshot = getLocalhostTestSnapshot({
    hostname: "127.0.0.1",
    search: "?cloudTestLedger=1"
  });
  const view = buildViewModel(snapshot);
  assert.equal(view.revision, 3);
  assert.deepEqual(view.entries.map((entry) => entry.kind), [
    "expense",
    "borrowing",
    "repayment"
  ]);
  assert.equal(view.entries[1].summary, "小明 → 跟 小華 借 TWD 4,000.00");
  assert.equal(view.entries[2].summary, "小明 → 還款 TWD 5,000.00 給 小華");
  assert.equal(view.settlements[0].summary, "小明 → 小華");
  assert.equal(view.settlements[0].amountLabel, "TWD 9,000.00");
});

test("ledger fixture switch is ignored outside localhost", () => {
  assert.equal(getLocalhostTestSnapshot({
    hostname: "travel.example.com",
    search: "?cloudTestLedger=1"
  }), null);
  assert.equal(getLocalhostTestSnapshot({
    hostname: "localhost",
    search: ""
  }), null);
});
