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

  function prepareCloudSave(storage, cloudTripId) {
    if (!storage || typeof storage.getItem !== "function") {
      throw new TypeError("storage_required");
    }
    if (!cloudTripId) {
      throw new TypeError("cloud_trip_id_required");
    }
    const trips = parseLocalTrips(storage.getItem("voyage_trips") || "[]");
    const localTrip = trips.find((trip) => trip?._cloud?.tripId === cloudTripId);
    if (!localTrip) {
      throw new TypeError("imported_cloud_trip_not_found");
    }
    const expectedRevision = Number(localTrip._cloud.revision);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new TypeError("cloud_revision_invalid");
    }

    const cloudTrip = clone(localTrip);
    delete cloudTrip._cloud;
    return {
      tripId: cloudTripId,
      expectedRevision,
      schemaVersion: Number(localTrip._cloud.schemaVersion) || 1,
      state: {
        source: "voyage-local-storage-v1",
        savedAt: new Date().toISOString(),
        trip: cloudTrip
      }
    };
  }

  function commitSavedRevision(storage, cloudTripId, revision, savedAt = new Date()) {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
      throw new TypeError("storage_required");
    }
    if (!Number.isSafeInteger(Number(revision)) || Number(revision) < 0) {
      throw new TypeError("saved_revision_invalid");
    }

    const trips = parseLocalTrips(storage.getItem("voyage_trips") || "[]");
    const index = trips.findIndex((trip) => trip?._cloud?.tripId === cloudTripId);
    if (index < 0) {
      throw new TypeError("imported_cloud_trip_not_found");
    }
    trips[index] = clone(trips[index]);
    trips[index]._cloud.revision = Number(revision);
    trips[index]._cloud.lastSavedAt = savedAt.toISOString();
    storage.setItem("voyage_trips", JSON.stringify(trips));
    return clone(trips[index]);
  }

  function assertStorageWritable(storage) {
    const key = "voyage_cloud_write_probe";
    storage.setItem(key, "1");
    storage.removeItem(key);
    return true;
  }

  function compareTripStates(localTrip, remoteCandidate) {
    if (!isObject(localTrip) || !isObject(remoteCandidate)) {
      throw new TypeError("trip_objects_required_for_comparison");
    }

    const localRev = Number(localTrip._cloud?.revision) || 0;
    const remoteRev = Number(remoteCandidate._cloud?.revision) || 0;

    const localItineraryCount = Array.isArray(localTrip.itinerary?.days)
      ? localTrip.itinerary.days.reduce((acc, d) => acc + (d.items?.length || 0), 0)
      : 0;
    const remoteItineraryCount = Array.isArray(remoteCandidate.itinerary?.days)
      ? remoteCandidate.itinerary.days.reduce((acc, d) => acc + (d.items?.length || 0), 0)
      : 0;

    const localLedgerCount = asArray(localTrip.ledger).length;
    const remoteLedgerCount = asArray(remoteCandidate.ledger).length;

    const localLedgerTotal = asArray(localTrip.ledger).reduce((sum, i) => sum + (Number(i.cost) || 0), 0);
    const remoteLedgerTotal = asArray(remoteCandidate.ledger).reduce((sum, i) => sum + (Number(i.cost) || 0), 0);

    const localAdvancesCount = asArray(localTrip.advances).length;
    const remoteAdvancesCount = asArray(remoteCandidate.advances).length;

    const localRepaymentsCount = asArray(localTrip.repayInfo).length;
    const remoteRepaymentsCount = asArray(remoteCandidate.repayInfo).length;

    const localPackingCount = asArray(localTrip.packingList).length + asArray(localTrip.todoList).length;
    const remotePackingCount = asArray(remoteCandidate.packingList).length + asArray(remoteCandidate.todoList).length;

    const localHasDiary = Boolean(localTrip.diary?.content || localTrip.diary?.cost);
    const remoteHasDiary = Boolean(remoteCandidate.diary?.content || remoteCandidate.diary?.cost);

    return {
      revisions: {
        local: localRev,
        remote: remoteRev
      },
      sections: [
        {
          key: "basicInfo",
          label: "基本資料",
          local: `${localTrip.title || "未命名"} (${localTrip.location || "未設定地點"})`,
          remote: `${remoteCandidate.title || "未命名"} (${remoteCandidate.location || "未設定地點"})`,
          hasDiff: localTrip.title !== remoteCandidate.title || localTrip.location !== remoteCandidate.location
        },
        {
          key: "itinerary",
          label: "詳細行程",
          local: `${localTrip.itinerary?.days?.length || 0} 天 (${localItineraryCount} 個項目)`,
          remote: `${remoteCandidate.itinerary?.days?.length || 0} 天 (${remoteItineraryCount} 個項目)`,
          hasDiff: localItineraryCount !== remoteItineraryCount || (localTrip.itinerary?.days?.length || 0) !== (remoteCandidate.itinerary?.days?.length || 0)
        },
        {
          key: "ledger",
          label: "帳單費用",
          local: `${localLedgerCount} 筆 (總額 NT$ ${localLedgerTotal.toLocaleString()})`,
          remote: `${remoteLedgerCount} 筆 (總額 NT$ ${remoteLedgerTotal.toLocaleString()})`,
          hasDiff: localLedgerCount !== remoteLedgerCount || localLedgerTotal !== remoteLedgerTotal
        },
        {
          key: "advances",
          label: "代墊款項",
          local: `${localAdvancesCount} 筆代墊`,
          remote: `${remoteAdvancesCount} 筆代墊`,
          hasDiff: localAdvancesCount !== remoteAdvancesCount
        },
        {
          key: "repayments",
          label: "還款資訊",
          local: `${localRepaymentsCount} 筆還款`,
          remote: `${remoteRepaymentsCount} 筆還款`,
          hasDiff: localRepaymentsCount !== remoteRepaymentsCount
        },
        {
          key: "packing",
          label: "打包與待辦",
          local: `${localPackingCount} 個項目`,
          remote: `${remotePackingCount} 個項目`,
          hasDiff: localPackingCount !== remotePackingCount
        },
        {
          key: "diary",
          label: "筆記與日記",
          local: localHasDiary ? "已撰寫內容" : "無內容",
          remote: remoteHasDiary ? "已撰寫內容" : "無內容",
          hasDiff: localHasDiary !== remoteHasDiary || (localTrip.diary?.content !== remoteCandidate.diary?.content)
        }
      ]
    };
  }

  function importRemoteAsCopy(storage, remoteCandidate, now = new Date()) {
    if (!isObject(remoteCandidate) || !remoteCandidate._cloud?.tripId) {
      throw new TypeError("import_candidate_invalid");
    }
    const copyCandidate = clone(remoteCandidate);
    copyCandidate.id = `local-copy-${Date.now()}`;
    copyCandidate.title = `${copyCandidate.title} (雲端 rev ${copyCandidate._cloud.revision} 副本)`;
    delete copyCandidate._cloud;

    const previousRaw = storage.getItem("voyage_trips") || "[]";
    const trips = parseLocalTrips(previousRaw);

    const backupKey = makeBackupKey(now);
    storage.setItem(backupKey, previousRaw);
    storage.setItem(LATEST_BACKUP_KEY, backupKey);
    storage.setItem("voyage_trips", JSON.stringify([copyCandidate, ...trips]));

    return {
      backupKey,
      copyTripId: copyCandidate.id,
      copyTitle: copyCandidate.title
    };
  }

  return {
    normalizeCandidate,
    parseLocalTrips,
    hasImportedTrip,
    makeBackupKey,
    importCandidate,
    restoreImport,
    getLatestBackupReceipt,
    prepareCloudSave,
    commitSavedRevision,
    assertStorageWritable,
    compareTripStates,
    importRemoteAsCopy
  };
});
