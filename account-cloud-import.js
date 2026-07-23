(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.VoyageCloudImport = Object.freeze(api);
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const LATEST_BACKUP_KEY = "voyage_cloud_latest_backup_key";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function asArray(value) {
    return Array.isArray(value) ? clone(value) : [];
  }

  function mapSimpleExpenses(expenses) {
    if (!Array.isArray(expenses)) return [];
    return expenses.map((expense, index) => ({
      id: expense.id || `cloud-expense-${index + 1}`,
      name: expense.name || expense.item || "未命名支出",
      day: Number(expense.day) || 1,
      category: expense.category || "其他",
      cost: Number(expense.cost ?? expense.amount) || 0,
      currency: expense.currency || "TWD",
      splitCount: Number(expense.splitCount) || 1,
      notes: expense.notes || "",
      payer: expense.payer || ""
    }));
  }

  function normalizeCandidate(cloudTrip, documentRecord) {
    if (!isObject(cloudTrip) || !cloudTrip.id || !cloudTrip.title) {
      throw new TypeError("cloud_trip_metadata_invalid");
    }
    if (!isObject(documentRecord) || !isObject(documentRecord.state)) {
      throw new TypeError("cloud_trip_document_invalid");
    }

    const state = documentRecord.state;
    const completeTrip = isObject(state.trip) ? clone(state.trip) : null;
    const warnings = [];
    let candidate;
    let sourceFormat;

    if (completeTrip?.title) {
      candidate = completeTrip;
      sourceFormat = "voyage-local-storage-v1";
    } else {
      sourceFormat = "cloud-basic-v1";
      warnings.push("雲端文件不是完整旅遊小本本格式；只會建立基本旅程與可辨識的支出。");
      candidate = {
        title: cloudTrip.title,
        location: cloudTrip.destination || "",
        date: cloudTrip.start_date || "",
        dateRange: "",
        duration: 1,
        companion: "",
        travelers: "",
        luggage: "",
        rental: "",
        continent: "Asia",
        rating: 0,
        image: "",
        itinerary: isObject(state.itinerary) ? clone(state.itinerary) : { days: [] },
        alternativeSpots: isObject(state.alternativeSpots)
          ? clone(state.alternativeSpots)
          : { sights: [], restaurants: [] },
        packingList: asArray(state.packingList),
        todoList: asArray(state.todoList),
        wishlist: asArray(state.wishlist),
        ledger: asArray(state.ledger).length
          ? asArray(state.ledger)
          : mapSimpleExpenses(state.expenses),
        advances: asArray(state.advances),
        repayInfo: asArray(state.repayInfo),
        diary: isObject(state.diary) ? clone(state.diary) : {}
      };
    }

    candidate.id = `cloud-${cloudTrip.id}`;
    candidate.title = String(candidate.title || cloudTrip.title).trim();
    candidate.location = String(candidate.location || cloudTrip.destination || "").trim();
    candidate.ledger = asArray(candidate.ledger);
    candidate.advances = asArray(candidate.advances);
    candidate.repayInfo = asArray(candidate.repayInfo);
    candidate.packingList = asArray(candidate.packingList);
    candidate.todoList = asArray(candidate.todoList);
    candidate.wishlist = asArray(candidate.wishlist);
    candidate._cloud = {
      tripId: cloudTrip.id,
      revision: Number(documentRecord.revision) || 0,
      schemaVersion: Number(documentRecord.schema_version) || 1,
      importedAt: new Date().toISOString(),
      sourceFormat
    };

    if (!candidate.title) {
      throw new TypeError("cloud_trip_title_required");
    }

    const itineraryDays = Array.isArray(candidate.itinerary?.days)
      ? candidate.itinerary.days.length
      : 0;

    return {
      candidate,
      warnings,
      summary: {
        title: candidate.title,
        location: candidate.location,
        itineraryDays,
        expenses: candidate.ledger.length,
        advances: candidate.advances.length,
        revision: candidate._cloud.revision,
        sourceFormat
      }
    };
  }

  function parseLocalTrips(rawValue) {
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      throw new TypeError("local_trips_invalid");
    }
    return parsed;
  }

  function hasImportedTrip(trips, cloudTripId) {
    return trips.some((trip) => trip?._cloud?.tripId === cloudTripId);
  }

  function makeBackupKey(now = new Date()) {
    return `voyage_cloud_backup_${now.toISOString().replace(/[:.]/g, "-")}`;
  }

  function importCandidate(storage, candidate, now = new Date()) {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
      throw new TypeError("storage_required");
    }
    if (!isObject(candidate) || !candidate?._cloud?.tripId) {
      throw new TypeError("import_candidate_invalid");
    }

    const previousRaw = storage.getItem("voyage_trips") || "[]";
    const trips = parseLocalTrips(previousRaw);
    if (hasImportedTrip(trips, candidate._cloud.tripId)) {
      const error = new Error("cloud_trip_already_imported");
      error.name = "DuplicateCloudTripError";
      throw error;
    }

    const backupKey = makeBackupKey(now);
    storage.setItem(backupKey, previousRaw);
    storage.setItem(LATEST_BACKUP_KEY, backupKey);
    try {
      storage.setItem("voyage_trips", JSON.stringify([clone(candidate), ...trips]));
    } catch (error) {
      storage.removeItem(backupKey);
      storage.removeItem(LATEST_BACKUP_KEY);
      throw error;
    }

    return {
      backupKey,
      previousRaw,
      importedTripId: candidate.id,
      cloudTripId: candidate._cloud.tripId
    };
  }

  function restoreImport(storage, receipt) {
    if (!storage || !receipt?.backupKey) {
      throw new TypeError("restore_receipt_invalid");
    }
    const previousRaw = typeof receipt.previousRaw === "string"
      ? receipt.previousRaw
      : storage.getItem(receipt.backupKey);
    if (typeof previousRaw !== "string") {
      throw new TypeError("backup_not_found");
    }
    storage.setItem("voyage_trips", previousRaw);
    if (storage.getItem(LATEST_BACKUP_KEY) === receipt.backupKey) {
      storage.removeItem(LATEST_BACKUP_KEY);
    }
    return true;
  }

  function getLatestBackupReceipt(storage) {
    if (!storage || typeof storage.getItem !== "function") return null;
    const backupKey = storage.getItem(LATEST_BACKUP_KEY);
    if (!backupKey || typeof storage.getItem(backupKey) !== "string") return null;
    return { backupKey };
  }

  return {
    normalizeCandidate,
    parseLocalTrips,
    hasImportedTrip,
    makeBackupKey,
    importCandidate,
    restoreImport,
    getLatestBackupReceipt
  };
});
