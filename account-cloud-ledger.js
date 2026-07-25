(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.VoyageCloudLedger = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const KINDS = new Set(["expense", "borrowing", "repayment"]);

  function requiredText(value, field) {
    if (typeof value !== "string" || !value.trim()) {
      throw new TypeError(`${field}_required`);
    }
    return value.trim();
  }

  function safeInteger(value, field, minimum = 0) {
    const number = typeof value === "string" && /^-?\d+$/.test(value)
      ? Number(value)
      : value;
    if (!Number.isSafeInteger(number) || number < minimum) {
      throw new RangeError(`${field}_must_be_safe_integer`);
    }
    return number;
  }

  function normalizeMoney(amountMinor, currency, minimum = 0) {
    const normalizedCurrency = requiredText(currency, "currency").toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      throw new TypeError("currency_invalid");
    }
    return Object.freeze({
      minorUnits: safeInteger(amountMinor, "amount_minor", minimum),
      currency: normalizedCurrency
    });
  }

  function normalizeSnapshot(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new TypeError("ledger_snapshot_must_be_object");
    }
    if (!Array.isArray(input.members) || !Array.isArray(input.entries) || !Array.isArray(input.settlements)) {
      throw new TypeError("ledger_snapshot_arrays_required");
    }

    const members = input.members.map((member) => Object.freeze({
      memberId: requiredText(member.member_id, "member_id"),
      displayName: requiredText(member.display_name, "display_name"),
      role: requiredText(member.role, "role")
    }));
    const entries = input.entries.map((entry) => {
      const kind = requiredText(entry.kind, "entry_kind");
      if (!KINDS.has(kind)) throw new TypeError("entry_kind_invalid");
      const normalized = {
        entryId: requiredText(entry.entry_id, "entry_id"),
        kind,
        amount: normalizeMoney(entry.amount_minor, entry.currency, 1),
        occurredAt: requiredText(entry.occurred_at, "occurred_at"),
        voidedAt: entry.voided_at || null
      };
      if (kind === "expense") {
        normalized.title = requiredText(entry.title, "expense_title");
        normalized.payerId = requiredText(entry.payer_id, "expense_payer_id");
        normalized.shares = (entry.shares || []).map((share) => Object.freeze({
          memberId: requiredText(share.member_id, "share_member_id"),
          amount: normalizeMoney(share.amount_minor, entry.currency)
        }));
      } else if (kind === "borrowing") {
        normalized.borrowerId = requiredText(entry.borrower_id, "borrower_id");
        normalized.lenderId = requiredText(entry.lender_id, "lender_id");
      } else {
        normalized.payerId = requiredText(entry.payer_id, "repayment_payer_id");
        normalized.receiverId = requiredText(entry.receiver_id, "repayment_receiver_id");
      }
      return Object.freeze(normalized);
    });
    const settlements = input.settlements.map((settlement) => Object.freeze({
      payerId: requiredText(settlement.payer_id, "settlement_payer_id"),
      receiverId: requiredText(settlement.receiver_id, "settlement_receiver_id"),
      amount: normalizeMoney(settlement.amount_minor, settlement.currency, 1)
    }));

    return Object.freeze({
      tripId: requiredText(input.trip_id, "trip_id"),
      ledgerRevision: safeInteger(input.ledger_revision, "ledger_revision"),
      members: Object.freeze(members),
      entries: Object.freeze(entries),
      settlements: Object.freeze(settlements)
    });
  }

  function formatMoney(money, locale = "zh-TW") {
    const currencyFormatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: money.currency
    });
    const fractionDigits = currencyFormatter.resolvedOptions().maximumFractionDigits;
    const numberFormatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    });
    return `${money.currency} ${numberFormatter.format(money.minorUnits / (10 ** fractionDigits))}`;
  }

  function buildViewModel(snapshot, locale = "zh-TW") {
    const memberNames = new Map(snapshot.members.map((member) => [member.memberId, member.displayName]));
    const nameOf = (memberId) => memberNames.get(memberId) || "未知成員";
    const entries = snapshot.entries.map((entry) => {
      let summary;
      if (entry.kind === "expense") {
        summary = `${entry.title}｜${nameOf(entry.payerId)} 付款`;
      } else if (entry.kind === "borrowing") {
        summary = `${nameOf(entry.borrowerId)} → 跟 ${nameOf(entry.lenderId)} 借 ${formatMoney(entry.amount, locale)}`;
      } else {
        summary = `${nameOf(entry.payerId)} → 還款 ${formatMoney(entry.amount, locale)} 給 ${nameOf(entry.receiverId)}`;
      }
      return Object.freeze({
        entryId: entry.entryId,
        kind: entry.kind,
        kindLabel: { expense: "支出", borrowing: "借款", repayment: "還款" }[entry.kind],
        summary,
        amountLabel: formatMoney(entry.amount, locale),
        occurredAt: entry.occurredAt,
        voided: Boolean(entry.voidedAt)
      });
    });
    const settlements = snapshot.settlements.map((settlement) => Object.freeze({
      summary: `${nameOf(settlement.payerId)} → ${nameOf(settlement.receiverId)}`,
      amountLabel: formatMoney(settlement.amount, locale)
    }));
    return Object.freeze({
      revision: snapshot.ledgerRevision,
      entries: Object.freeze(entries),
      settlements: Object.freeze(settlements)
    });
  }

  function createRepository(client) {
    if (!client || typeof client.rpc !== "function") {
      throw new TypeError("supabase_client_required");
    }
    return Object.freeze({
      async getSnapshot(tripId) {
        const { data, error } = await client.rpc("get_ledger_snapshot", {
          target_trip_id: requiredText(tripId, "trip_id")
        });
        if (error) throw error;
        return normalizeSnapshot(data);
      }
    });
  }

  return Object.freeze({
    normalizeSnapshot,
    formatMoney,
    buildViewModel,
    createRepository
  });
});
