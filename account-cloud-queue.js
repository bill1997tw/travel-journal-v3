(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.VoyageCloudQueue = Object.freeze(api);
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const DB_NAME = "voyage-account-cloud";
  const DB_VERSION = 1;
  const STORE_NAME = "drafts";
  const ALLOWED_STATUSES = new Set(["pending", "syncing", "conflict", "failed"]);

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeQueueRecord(input, existing = null, now = new Date()) {
    if (!isObject(input) || !input.tripId || !isObject(input.state)) {
      throw new TypeError("queue_record_invalid");
    }
    const baseRevision = Number(input.baseRevision);
    if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) {
      throw new TypeError("queue_revision_invalid");
    }
    const status = input.status || "pending";
    if (!ALLOWED_STATUSES.has(status)) {
      throw new TypeError("queue_status_invalid");
    }
    const timestamp = now.toISOString();
    return {
      tripId: String(input.tripId),
      title: String(input.title || existing?.title || "未命名旅程"),
      baseRevision,
      schemaVersion: Number(input.schemaVersion) || 1,
      state: clone(input.state),
      status,
      retryCount: Number.isSafeInteger(input.retryCount)
        ? input.retryCount
        : Number(existing?.retryCount) || 0,
      lastError: input.lastError || null,
      createdAt: existing?.createdAt || input.createdAt || timestamp,
      updatedAt: timestamp
    };
  }

  function classifySaveError(error) {
    const message = String(error?.message || "").toLowerCase();
    const code = String(error?.code || "");
    if (message.includes("trip_revision_conflict")) return "conflict";
    if (
      code === "42501"
      || message.includes("forbidden")
      || message.includes("permission")
      || message.includes("authentication")
      || message.includes("jwt")
    ) {
      return "failed";
    }
    return "transient";
  }

  function openDatabase(indexedDb = globalThis.indexedDB) {
    if (!indexedDb || typeof indexedDb.open !== "function") {
      return Promise.reject(new Error("indexeddb_unavailable"));
    }
    return new Promise((resolve, reject) => {
      const request = indexedDb.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: "tripId" });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("indexeddb_open_failed"));
      request.onblocked = () => reject(new Error("indexeddb_open_blocked"));
    });
  }

  function runRequest(mode, operation) {
    return openDatabase().then((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let request;
      try {
        request = operation(store);
      } catch (error) {
        database.close();
        reject(error);
        return;
      }
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("indexeddb_request_failed"));
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error("indexeddb_transaction_failed"));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error || new Error("indexeddb_transaction_aborted"));
      };
    }));
  }

  async function putDraft(input, now = new Date()) {
    const existing = await getDraft(input.tripId);
    const record = normalizeQueueRecord(input, existing, now);
    await runRequest("readwrite", (store) => store.put(record));
    return clone(record);
  }

  async function getDraft(tripId) {
    if (!tripId) throw new TypeError("queue_trip_id_required");
    const result = await runRequest("readonly", (store) => store.get(String(tripId)));
    return result ? clone(result) : null;
  }

  async function listDrafts() {
    const result = await runRequest("readonly", (store) => store.getAll());
    return (result || [])
      .map(clone)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async function updateDraftStatus(tripId, status, details = {}, now = new Date()) {
    if (!ALLOWED_STATUSES.has(status)) {
      throw new TypeError("queue_status_invalid");
    }
    const existing = await getDraft(tripId);
    if (!existing) throw new TypeError("queued_draft_not_found");
    return putDraft({
      ...existing,
      status,
      retryCount: details.retryCount ?? existing.retryCount,
      lastError: details.lastError ?? null
    }, now);
  }

  async function deleteDraft(tripId) {
    if (!tripId) throw new TypeError("queue_trip_id_required");
    await runRequest("readwrite", (store) => store.delete(String(tripId)));
    return true;
  }

  return {
    normalizeQueueRecord,
    classifySaveError,
    openDatabase,
    putDraft,
    getDraft,
    listDrafts,
    updateDraftStatus,
    deleteDraft
  };
});
