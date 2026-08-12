(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.VoyageTripIdentity = Object.freeze(api);
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function normalizeId(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getCloudTripId(trip) {
    return normalizeId(trip?._cloud?.tripId) || null;
  }

  function getClientTripUuid(trip) {
    return normalizeId(trip?.clientTripUuid) || null;
  }

  function isCloudBackedTrip(trip) {
    return Boolean(getCloudTripId(trip));
  }

  function createClientTripUuid(randomUuid) {
    const generator = randomUuid
      || globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
    const generated = normalizeId(generator?.());
    if (!generated) {
      throw new Error("client_trip_uuid_generator_unavailable");
    }
    return generated;
  }

  function ensureClientTripUuid(trip, options = {}) {
    if (!trip || typeof trip !== "object" || Array.isArray(trip)) {
      throw new TypeError("trip_identity_object_required");
    }
    const existing = getClientTripUuid(trip);
    if (existing) return existing;
    const cloudTripId = getCloudTripId(trip);
    const generated = cloudTripId || createClientTripUuid(options.randomUuid);
    trip.clientTripUuid = generated;
    return generated;
  }

  function findLocalTripsByCloudId(trips, cloudTripId) {
    const target = normalizeId(cloudTripId);
    if (!target || !Array.isArray(trips)) return [];
    return trips.filter((trip) => getCloudTripId(trip) === target);
  }

  function findLocalTripByCloudId(trips, cloudTripId) {
    return findLocalTripsByCloudId(trips, cloudTripId)[0] || null;
  }

  function ensureSingleLocalWorkingCopy(trips, cloudTripId) {
    const copies = findLocalTripsByCloudId(trips, cloudTripId);
    return {
      cloudTripId: normalizeId(cloudTripId) || null,
      trip: copies.length === 1 ? copies[0] : null,
      copies,
      status: copies.length === 0
        ? "missing"
        : copies.length === 1
          ? "single"
          : "duplicate"
    };
  }

  function diagnoseDuplicateCloudTrips(trips, options = {}) {
    const groups = new Map();
    for (const trip of Array.isArray(trips) ? trips : []) {
      const cloudTripId = getCloudTripId(trip);
      if (!cloudTripId) continue;
      const group = groups.get(cloudTripId) || [];
      group.push(trip);
      groups.set(cloudTripId, group);
    }

    const queuedByTripId = new Map(
      (Array.isArray(options.queuedDrafts) ? options.queuedDrafts : [])
        .map((draft) => [normalizeId(draft?.tripId), draft])
        .filter(([tripId]) => tripId)
    );
    const cloudRevisions = options.cloudRevisions || {};
    const fingerprint = typeof options.fingerprint === "function"
      ? options.fingerprint
      : null;

    return [...groups.entries()]
      .filter(([, copies]) => copies.length > 1)
      .map(([cloudTripId, copies]) => ({
        cloudTripId,
        cloudRevision: Number(cloudRevisions[cloudTripId]) || null,
        hasQueuedDraft: queuedByTripId.has(cloudTripId),
        copies: copies.map((trip) => {
          let currentFingerprint = null;
          if (fingerprint) {
            try {
              currentFingerprint = fingerprint(trip);
            } catch (error) {
              currentFingerprint = null;
            }
          }
          const savedFingerprint = normalizeId(trip?._cloud?.savedFingerprint) || null;
          return {
            localId: normalizeId(trip?.id) || null,
            title: normalizeId(trip?.title) || null,
            localRevision: Number(trip?._cloud?.revision) || 0,
            fingerprint: currentFingerprint,
            savedFingerprint,
            updatedAt: normalizeId(
              trip?._cloud?.lastSavedAt
              || trip?.updatedAt
              || trip?._cloud?.importedAt
            ) || null,
            hasUnsyncedChanges: Boolean(
              queuedByTripId.has(cloudTripId)
              || !savedFingerprint
              || (currentFingerprint && currentFingerprint !== savedFingerprint)
            )
          };
        })
      }));
  }

  function promotionSourceKey(trip, options = {}) {
    const clientTripUuid = ensureClientTripUuid(trip, options);
    return `voyage-client:${clientTripUuid}`;
  }

  return {
    getCloudTripId,
    getClientTripUuid,
    isCloudBackedTrip,
    createClientTripUuid,
    ensureClientTripUuid,
    findLocalTripsByCloudId,
    findLocalTripByCloudId,
    ensureSingleLocalWorkingCopy,
    diagnoseDuplicateCloudTrips,
    promotionSourceKey
  };
});
