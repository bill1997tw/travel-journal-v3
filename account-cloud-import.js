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

  function stableSerialize(value) {
    if (Array.isArray(value)) {
      return `[${value.map(stableSerialize).join(",")}]`;
    }
    if (isObject(value)) {
      return `{${Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function fingerprintTrip(trip) {
    if (!isObject(trip)) throw new TypeError("trip_fingerprint_object_required");
    const snapshot = clone(trip);
    delete snapshot._cloud;
    const serialized = stableSerialize(snapshot);
    let hash = 2166136261;
    for (let index = 0; index < serialized.length; index += 1) {
      hash ^= serialized.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function getCloudTripState(localTrip, queuedDraft = null) {
    if (!isObject(localTrip)) return "cloud_only";
    if (!localTrip._cloud?.tripId) return "local_only";
    if (queuedDraft) {
      if (queuedDraft.status === "conflict") return "conflict";
      if (queuedDraft.status === "failed") return "failed";
      return "queued";
    }
    const savedFingerprint = localTrip._cloud.savedFingerprint;
    if (!savedFingerprint) return "unsaved";
    return fingerprintTrip(localTrip) === savedFingerprint ? "current" : "unsaved";
  }

  function classifyRemoteUpdate(localTrip, queuedDraft, remoteRevision) {
    if (!isObject(localTrip) || !localTrip._cloud?.tripId) return "ignore";
    const nextRevision = Number(remoteRevision);
    const localRevision = Number(localTrip._cloud.revision);
    if (!Number.isSafeInteger(nextRevision) || nextRevision <= localRevision) return "ignore";
    return getCloudTripState(localTrip, queuedDraft) === "current"
      ? "refresh_available"
      : "compare_required";
  }

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function asArray(value) {
    return Array.isArray(value) ? clone(value) : [];
  }

  function stableSerialize(value) {
    if (Array.isArray(value)) {
      return `[${value.map(stableSerialize).join(",")}]`;
    }
    if (isObject(value)) {
      return `{${Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
        .join(",")}}`;
    }
    if (value === undefined) return "null";
    return JSON.stringify(value);
  }

  function sectionChanged(localValue, remoteValue) {
    return stableSerialize(localValue) !== stableSerialize(remoteValue);
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
    candidate._cloud.savedFingerprint = fingerprintTrip(candidate);

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
    const importedCandidate = clone(candidate);
    importedCandidate._cloud.savedFingerprint = fingerprintTrip(importedCandidate);
    try {
      storage.setItem("voyage_trips", JSON.stringify([importedCandidate, ...trips]));
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
      if (
        receipt.previousLatestBackupKey
        && typeof storage.getItem(receipt.previousLatestBackupKey) === "string"
      ) {
        storage.setItem(LATEST_BACKUP_KEY, receipt.previousLatestBackupKey);
      } else {
        storage.removeItem(LATEST_BACKUP_KEY);
      }
    }
    return true;
  }

  function replaceImportedCandidate(storage, candidate, now = new Date()) {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
      throw new TypeError("storage_required");
    }
    if (!isObject(candidate) || !candidate?._cloud?.tripId) {
      throw new TypeError("import_candidate_invalid");
    }

    const previousRaw = storage.getItem("voyage_trips") || "[]";
    const trips = parseLocalTrips(previousRaw);
    const index = trips.findIndex((trip) => trip?._cloud?.tripId === candidate._cloud.tripId);
    if (index < 0) throw new TypeError("imported_cloud_trip_not_found");

    const backupKey = makeBackupKey(now);
    const previousLatestBackupKey = storage.getItem(LATEST_BACKUP_KEY);
    const replacement = clone(candidate);
    replacement._cloud.savedFingerprint = fingerprintTrip(replacement);
    trips[index] = replacement;

    storage.setItem(backupKey, previousRaw);
    storage.setItem(LATEST_BACKUP_KEY, backupKey);
    try {
      storage.setItem("voyage_trips", JSON.stringify(trips));
    } catch (error) {
      storage.removeItem(backupKey);
      if (previousLatestBackupKey) {
        storage.setItem(LATEST_BACKUP_KEY, previousLatestBackupKey);
      } else {
        storage.removeItem(LATEST_BACKUP_KEY);
      }
      throw error;
    }

    return {
      backupKey,
      previousLatestBackupKey,
      previousRaw,
      importedTripId: replacement.id,
      cloudTripId: replacement._cloud.tripId
    };
  }

  function getLatestBackupReceipt(storage) {
    if (!storage || typeof storage.getItem !== "function") return null;
    const backupKey = storage.getItem(LATEST_BACKUP_KEY);
    if (!backupKey || typeof storage.getItem(backupKey) !== "string") return null;
    return { backupKey };
  }

  function getRecoverableImportBackupReceipt(storage) {
    if (
      !storage
      || typeof storage.getItem !== "function"
      || typeof storage.key !== "function"
      || !Number.isSafeInteger(Number(storage.length))
    ) {
      return null;
    }
    let currentTrips;
    try {
      currentTrips = parseLocalTrips(storage.getItem("voyage_trips") || "[]");
    } catch (error) {
      return null;
    }
    const currentCloudIds = new Set(
      currentTrips.map((trip) => trip?._cloud?.tripId).filter(Boolean)
    );
    if (currentCloudIds.size === 0) return null;

    const candidates = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith("voyage_cloud_backup_")) continue;
      try {
        const backupTrips = parseLocalTrips(storage.getItem(key));
        const backupCloudIds = new Set(
          backupTrips.map((trip) => trip?._cloud?.tripId).filter(Boolean)
        );
        const isStrictSubset = backupCloudIds.size < currentCloudIds.size
          && [...backupCloudIds].every((id) => currentCloudIds.has(id));
        if (isStrictSubset) candidates.push(key);
      } catch (error) {
        // Ignore malformed or unrelated backup records.
      }
    }
    candidates.sort().reverse();
    return candidates[0] ? { backupKey: candidates[0] } : null;
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

  function prepareLocalTripPromotion(storage, localTripId) {
    if (!storage || typeof storage.getItem !== "function") {
      throw new TypeError("storage_required");
    }
    if (!localTripId) {
      throw new TypeError("local_trip_id_required");
    }
    const trips = parseLocalTrips(storage.getItem("voyage_trips") || "[]");
    const localTrip = trips.find((trip) => trip?.id === localTripId);
    if (!localTrip) {
      throw new TypeError("local_trip_not_found");
    }
    if (localTrip._cloud?.tripId) {
      throw new TypeError("local_trip_already_promoted");
    }
    if (!String(localTrip.title || "").trim()) {
      throw new TypeError("local_trip_title_required");
    }
    const cloudTrip = clone(localTrip);
    delete cloudTrip._cloud;
    const isoDate = (value) =>
      typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value.trim())
        ? value.trim()
        : null;
    return {
      sourceKey: `voyage-local:${localTripId}`,
      title: String(localTrip.title).trim(),
      destination: String(localTrip.location || "").trim() || null,
      startDate: isoDate(localTrip.date),
      endDate: isoDate(localTrip.endDate),
      baseCurrency: "TWD",
      schemaVersion: 1,
      state: {
        source: "voyage-local-storage-v1",
        promotedAt: new Date().toISOString(),
        trip: cloudTrip
      }
    };
  }

  function commitLocalTripPromotion(
    storage,
    localTripId,
    cloudTripId,
    revision,
    schemaVersion = 1,
    now = new Date()
  ) {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
      throw new TypeError("storage_required");
    }
    if (!localTripId || !cloudTripId) {
      throw new TypeError("promotion_ids_required");
    }
    if (!Number.isSafeInteger(Number(revision)) || Number(revision) < 0) {
      throw new TypeError("promotion_revision_invalid");
    }
    const previousRaw = storage.getItem("voyage_trips") || "[]";
    const trips = parseLocalTrips(previousRaw);
    const index = trips.findIndex((trip) => trip?.id === localTripId);
    if (index < 0) {
      throw new TypeError("local_trip_not_found");
    }
    if (trips[index]._cloud?.tripId && trips[index]._cloud.tripId !== cloudTripId) {
      throw new TypeError("local_trip_cloud_conflict");
    }

    const backupKey = makeBackupKey(now);
    const previousLatestBackupKey = storage.getItem(LATEST_BACKUP_KEY);
    const promotedTrip = clone(trips[index]);
    promotedTrip._cloud = {
      tripId: cloudTripId,
      revision: Number(revision),
      schemaVersion: Number(schemaVersion) || 1,
      importedAt: now.toISOString(),
      lastSavedAt: now.toISOString(),
      sourceFormat: "voyage-local-storage-v1"
    };
    promotedTrip._cloud.savedFingerprint = fingerprintTrip(promotedTrip);
    trips[index] = promotedTrip;

    storage.setItem(backupKey, previousRaw);
    try {
      storage.setItem(LATEST_BACKUP_KEY, backupKey);
      storage.setItem("voyage_trips", JSON.stringify(trips));
    } catch (error) {
      storage.removeItem(backupKey);
      if (previousLatestBackupKey) {
        storage.setItem(LATEST_BACKUP_KEY, previousLatestBackupKey);
      } else {
        storage.removeItem(LATEST_BACKUP_KEY);
      }
      throw error;
    }
    return {
      backupKey,
      localTripId,
      cloudTripId,
      promotedTrip: clone(promotedTrip)
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
    trips[index]._cloud.savedFingerprint = fingerprintTrip(trips[index]);
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

    const localLedger = asArray(localTrip.ledger);
    const remoteLedger = asArray(remoteCandidate.ledger);
    const localLedgerCount = localLedger.length;
    const remoteLedgerCount = remoteLedger.length;

    const localLedgerTotal = localLedger.reduce((sum, i) => sum + (Number(i.cost) || 0), 0);
    const remoteLedgerTotal = remoteLedger.reduce((sum, i) => sum + (Number(i.cost) || 0), 0);

    const localAdvances = asArray(localTrip.advances);
    const remoteAdvances = asArray(remoteCandidate.advances);
    const localAdvancesCount = localAdvances.length;
    const remoteAdvancesCount = remoteAdvances.length;

    const localRepayments = asArray(localTrip.repayInfo);
    const remoteRepayments = asArray(remoteCandidate.repayInfo);
    const localRepaymentsCount = localRepayments.length;
    const remoteRepaymentsCount = remoteRepayments.length;

    const localPacking = {
      packingList: asArray(localTrip.packingList),
      todoList: asArray(localTrip.todoList)
    };
    const remotePacking = {
      packingList: asArray(remoteCandidate.packingList),
      todoList: asArray(remoteCandidate.todoList)
    };
    const localPackingCount = localPacking.packingList.length + localPacking.todoList.length;
    const remotePackingCount = remotePacking.packingList.length + remotePacking.todoList.length;

    const localHasDiary = Boolean(localTrip.diary?.content || localTrip.diary?.cost);
    const remoteHasDiary = Boolean(remoteCandidate.diary?.content || remoteCandidate.diary?.cost);
    const localBasicInfo = {
      title: localTrip.title,
      location: localTrip.location,
      date: localTrip.date,
      dateRange: localTrip.dateRange,
      duration: localTrip.duration,
      companion: localTrip.companion,
      travelers: localTrip.travelers,
      luggage: localTrip.luggage,
      rental: localTrip.rental,
      hotel: localTrip.hotel,
      continent: localTrip.continent
    };
    const remoteBasicInfo = {
      title: remoteCandidate.title,
      location: remoteCandidate.location,
      date: remoteCandidate.date,
      dateRange: remoteCandidate.dateRange,
      duration: remoteCandidate.duration,
      companion: remoteCandidate.companion,
      travelers: remoteCandidate.travelers,
      luggage: remoteCandidate.luggage,
      rental: remoteCandidate.rental,
      hotel: remoteCandidate.hotel,
      continent: remoteCandidate.continent
    };
    const localNotes = {
      notes: localTrip.notes,
      quickNotes: localTrip.quickNotes,
      wishlist: asArray(localTrip.wishlist),
      alternativeSpots: localTrip.alternativeSpots || {}
    };
    const remoteNotes = {
      notes: remoteCandidate.notes,
      quickNotes: remoteCandidate.quickNotes,
      wishlist: asArray(remoteCandidate.wishlist),
      alternativeSpots: remoteCandidate.alternativeSpots || {}
    };

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
          hasDiff: sectionChanged(localBasicInfo, remoteBasicInfo)
        },
        {
          key: "itinerary",
          label: "詳細行程",
          local: `${localTrip.itinerary?.days?.length || 0} 天 (${localItineraryCount} 個項目)`,
          remote: `${remoteCandidate.itinerary?.days?.length || 0} 天 (${remoteItineraryCount} 個項目)`,
          hasDiff: sectionChanged(localTrip.itinerary || {}, remoteCandidate.itinerary || {})
        },
        {
          key: "ledger",
          label: "帳單費用",
          local: `${localLedgerCount} 筆 (總額 NT$ ${localLedgerTotal.toLocaleString()})`,
          remote: `${remoteLedgerCount} 筆 (總額 NT$ ${remoteLedgerTotal.toLocaleString()})`,
          hasDiff: sectionChanged(localLedger, remoteLedger)
        },
        {
          key: "advances",
          label: "代墊款項",
          local: `${localAdvancesCount} 筆代墊`,
          remote: `${remoteAdvancesCount} 筆代墊`,
          hasDiff: sectionChanged(localAdvances, remoteAdvances)
        },
        {
          key: "repayments",
          label: "還款資訊",
          local: `${localRepaymentsCount} 筆還款`,
          remote: `${remoteRepaymentsCount} 筆還款`,
          hasDiff: sectionChanged(localRepayments, remoteRepayments)
        },
        {
          key: "packing",
          label: "打包與待辦",
          local: `${localPackingCount} 個項目`,
          remote: `${remotePackingCount} 個項目`,
          hasDiff: sectionChanged(localPacking, remotePacking)
        },
        {
          key: "notes",
          label: "備註與收藏",
          local: `${localNotes.wishlist.length} 個願望項目`,
          remote: `${remoteNotes.wishlist.length} 個願望項目`,
          hasDiff: sectionChanged(localNotes, remoteNotes)
        },
        {
          key: "diary",
          label: "筆記與日記",
          local: localHasDiary ? "已撰寫內容" : "無內容",
          remote: remoteHasDiary ? "已撰寫內容" : "無內容",
          hasDiff: sectionChanged(localTrip.diary || {}, remoteCandidate.diary || {})
        }
      ]
    };
  }

  function importRemoteAsCopy(storage, remoteCandidate, now = new Date()) {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
      throw new TypeError("storage_required");
    }
    if (!isObject(remoteCandidate) || !remoteCandidate._cloud?.tripId) {
      throw new TypeError("import_candidate_invalid");
    }
    const copyCandidate = clone(remoteCandidate);
    copyCandidate.id = `local-copy-${now.getTime()}`;
    copyCandidate.title = `${copyCandidate.title} (雲端 rev ${copyCandidate._cloud.revision} 副本)`;
    delete copyCandidate._cloud;

    const previousRaw = storage.getItem("voyage_trips") || "[]";
    const trips = parseLocalTrips(previousRaw);

    const backupKey = makeBackupKey(now);
    const previousLatestBackupKey = storage.getItem(LATEST_BACKUP_KEY);
    storage.setItem(backupKey, previousRaw);
    try {
      storage.setItem(LATEST_BACKUP_KEY, backupKey);
      storage.setItem("voyage_trips", JSON.stringify([copyCandidate, ...trips]));
    } catch (error) {
      storage.removeItem(backupKey);
      if (previousLatestBackupKey) {
        storage.setItem(LATEST_BACKUP_KEY, previousLatestBackupKey);
      } else {
        storage.removeItem(LATEST_BACKUP_KEY);
      }
      throw error;
    }

    return {
      backupKey,
      copyTripId: copyCandidate.id,
      copyTitle: copyCandidate.title
    };
  }

  return {
    normalizeCandidate,
    parseLocalTrips,
    fingerprintTrip,
    getCloudTripState,
    classifyRemoteUpdate,
    hasImportedTrip,
    makeBackupKey,
    importCandidate,
    restoreImport,
    replaceImportedCandidate,
    getLatestBackupReceipt,
    getRecoverableImportBackupReceipt,
    prepareCloudSave,
    prepareLocalTripPromotion,
    commitLocalTripPromotion,
    commitSavedRevision,
    assertStorageWritable,
    compareTripStates,
    importRemoteAsCopy
  };
});
