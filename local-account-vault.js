(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.VoyageLocalAccountVault = Object.freeze(api);
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const ACTIVE_SCOPE_KEY = "voyage_local_active_scope_v1";
  const VAULT_PREFIX = "voyage_local_vault_v1:";
  const GUEST_SCOPE = "guest";
  const FIXED_KEYS = Object.freeze([
    "voyage_logo_text",
    "voyage_user_name",
    "voyage_trips",
    "voyage_quick_notes",
    "voyage_itinerary_history",
    "voyage_known_places",
    "voyage_last_mobile_trip_id",
    "voyage_last_local_edit_at",
    "voyage_cloud_latest_backup_key"
  ]);
  const MANAGED_PREFIXES = Object.freeze(["voyage_cloud_backup_"]);

  function requireStorage(storage) {
    if (
      !storage
      || typeof storage.getItem !== "function"
      || typeof storage.setItem !== "function"
      || typeof storage.removeItem !== "function"
      || typeof storage.key !== "function"
    ) {
      throw new TypeError("local_vault_storage_required");
    }
  }

  function accountScope(userId) {
    const normalized = String(userId || "").trim();
    if (!/^[0-9a-f-]{20,}$/iu.test(normalized)) {
      throw new TypeError("local_vault_user_id_invalid");
    }
    return `account:${normalized.toLowerCase()}`;
  }

  function normalizeScope(scope) {
    if (scope === GUEST_SCOPE) return GUEST_SCOPE;
    if (/^account:[0-9a-f-]{20,}$/iu.test(String(scope || ""))) {
      return String(scope).toLowerCase();
    }
    throw new TypeError("local_vault_scope_invalid");
  }

  function isManagedKey(key) {
    return FIXED_KEYS.includes(key)
      || MANAGED_PREFIXES.some((prefix) => key.startsWith(prefix));
  }

  function listManagedKeys(storage) {
    requireStorage(storage);
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && isManagedKey(key)) keys.push(key);
    }
    return keys.sort();
  }

  function capture(storage) {
    const snapshot = {};
    for (const key of listManagedKeys(storage)) {
      const value = storage.getItem(key);
      if (typeof value === "string") snapshot[key] = value;
    }
    return snapshot;
  }

  function validateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      throw new TypeError("local_vault_snapshot_invalid");
    }
    const normalized = {};
    for (const [key, value] of Object.entries(snapshot)) {
      if (!isManagedKey(key) || typeof value !== "string") {
        throw new TypeError("local_vault_snapshot_entry_invalid");
      }
      normalized[key] = value;
    }
    return normalized;
  }

  function clearManaged(storage) {
    for (const key of listManagedKeys(storage)) {
      storage.removeItem(key);
    }
  }

  function restore(storage, snapshot) {
    const normalized = validateSnapshot(snapshot);
    clearManaged(storage);
    for (const [key, value] of Object.entries(normalized)) {
      storage.setItem(key, value);
    }
  }

  function vaultKey(scope) {
    return `${VAULT_PREFIX}${encodeURIComponent(normalizeScope(scope))}`;
  }

  function readVault(storage, scope) {
    requireStorage(storage);
    const raw = storage.getItem(vaultKey(scope));
    if (!raw) return {};
    return validateSnapshot(JSON.parse(raw));
  }

  function writeVault(storage, scope, snapshot) {
    requireStorage(storage);
    const normalized = validateSnapshot(snapshot);
    storage.setItem(vaultKey(scope), JSON.stringify(normalized));
  }

  function switchScope(storage, requestedScope) {
    requireStorage(storage);
    const nextScope = normalizeScope(requestedScope);
    const currentScope = storage.getItem(ACTIVE_SCOPE_KEY);
    if (!currentScope) {
      const initialSnapshot = capture(storage);
      writeVault(storage, nextScope, initialSnapshot);
      storage.setItem(ACTIVE_SCOPE_KEY, nextScope);
      return Object.freeze({
        changed: false,
        migrated: true,
        previousScope: null,
        scope: nextScope
      });
    }

    const normalizedCurrentScope = normalizeScope(currentScope);
    if (normalizedCurrentScope === nextScope) {
      return Object.freeze({
        changed: false,
        migrated: false,
        previousScope: normalizedCurrentScope,
        scope: nextScope
      });
    }

    const currentSnapshot = capture(storage);
    const nextSnapshot = readVault(storage, nextScope);
    writeVault(storage, normalizedCurrentScope, currentSnapshot);
    try {
      restore(storage, nextSnapshot);
      storage.setItem(ACTIVE_SCOPE_KEY, nextScope);
    } catch (error) {
      restore(storage, currentSnapshot);
      storage.setItem(ACTIVE_SCOPE_KEY, normalizedCurrentScope);
      throw error;
    }

    return Object.freeze({
      changed: true,
      migrated: false,
      previousScope: normalizedCurrentScope,
      scope: nextScope
    });
  }

  return {
    ACTIVE_SCOPE_KEY,
    GUEST_SCOPE,
    accountScope,
    isManagedKey,
    capture,
    readVault,
    switchScope
  };
});
