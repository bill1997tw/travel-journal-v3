(function () {
  "use strict";

  const RETIREMENT_CONFIRMATION = "停用我的帳號";
  const PERMANENT_DELETION_CONFIRMATION = "永久刪除我的帳號";
  const DEFAULT_COMPLETION_ENDPOINT = "/api/account-permanent-deletion";

  class AccountLifecycleError extends Error {
    constructor(code, options = {}) {
      super(code);
      this.name = "AccountLifecycleError";
      this.code = code;
      this.status = options.status ?? null;
      this.retryAfterSeconds = options.retryAfterSeconds ?? null;
      if (options.cause) this.cause = options.cause;
    }
  }

  function assertClient(client) {
    if (
      !client ||
      typeof client.rpc !== "function" ||
      typeof client.auth?.getSession !== "function"
    ) {
      throw new TypeError("supabase_client_required");
    }
  }

  function assertNonEmpty(value, field) {
    if (typeof value !== "string" || !value.trim()) {
      throw new TypeError(`${field}_invalid`);
    }
    return value.trim();
  }

  function assertBoolean(value, field) {
    if (typeof value !== "boolean") {
      throw new TypeError(`${field}_invalid`);
    }
    return value;
  }

  function assertCount(value, field) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError(`${field}_invalid`);
    }
    return value;
  }

  function assertActionResult(data, action) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new TypeError(`account_${action}_result_invalid`);
    }
    return data;
  }

  function normalizeStatus(data) {
    const result = assertActionResult(data, "retirement_status");
    const counts = assertActionResult(result.counts, "retirement_counts");
    if (!Array.isArray(result.owned_trips)) {
      throw new TypeError("owned_trips_invalid");
    }

    return {
      accountRetired: assertBoolean(result.account_retired, "account_retired"),
      canRetireSafely: assertBoolean(
        result.can_retire_safely,
        "can_retire_safely"
      ),
      permanentDeletionReady: assertBoolean(
        result.permanent_deletion_ready,
        "permanent_deletion_ready"
      ),
      requiresOwnerTransfer: assertBoolean(
        result.requires_owner_transfer,
        "requires_owner_transfer"
      ),
      requiresLineRebind: assertBoolean(
        result.requires_line_rebind,
        "requires_line_rebind"
      ),
      requiresGuestShareReissue: assertBoolean(
        result.requires_guest_share_reissue,
        "requires_guest_share_reissue"
      ),
      ownedTrips: result.owned_trips.map((trip) => {
        const ownedTrip = assertActionResult(trip, "owned_trip");
        return {
          tripId: assertNonEmpty(ownedTrip.trip_id, "owned_trip_id"),
          title: assertNonEmpty(ownedTrip.title, "owned_trip_title"),
          archived: assertBoolean(
            ownedTrip.archived,
            "owned_trip_archived"
          )
        };
      }),
      counts: {
        ownedTrips: assertCount(counts.owned_trips, "owned_trips"),
        otherTripMemberships: assertCount(
          counts.other_trip_memberships,
          "other_trip_memberships"
        ),
        activeLineBindings: assertCount(
          counts.active_line_bindings,
          "active_line_bindings"
        ),
        openLineClaims: assertCount(
          counts.open_line_claims,
          "open_line_claims"
        ),
        guestShares: assertCount(counts.guest_shares, "guest_shares"),
        activeGuestShares: assertCount(
          counts.active_guest_shares,
          "active_guest_shares"
        ),
        profileReferences: assertCount(
          counts.profile_references,
          "profile_references"
        ),
        directAuthReferences: assertCount(
          counts.direct_auth_references,
          "direct_auth_references"
        )
      }
    };
  }

  async function callRpc(client, name, payload) {
    const result = await client.rpc(name, payload);
    if (result?.error) throw result.error;
    return result?.data;
  }

  async function readJsonResponse(response) {
    try {
      const payload = await response.json();
      return payload && typeof payload === "object" && !Array.isArray(payload)
        ? payload
        : {};
    } catch {
      return {};
    }
  }

  function createAccountLifecycle(client, options = {}) {
    assertClient(client);
    const fetchImpl = options.fetchImpl || window.fetch?.bind(window);
    const completionEndpoint =
      options.completionEndpoint || DEFAULT_COMPLETION_ENDPOINT;
    if (typeof fetchImpl !== "function") {
      throw new TypeError("fetch_implementation_required");
    }

    return Object.freeze({
      async getStatus() {
        const data = await callRpc(
          client,
          "get_account_retirement_status_v3"
        );
        return normalizeStatus(data);
      },

      async retire(confirmationText) {
        const confirmation = assertNonEmpty(
          confirmationText,
          "account_retirement_confirmation"
        );
        const data = assertActionResult(
          await callRpc(client, "retire_my_account", {
            confirmation_text: confirmation
          }),
          "retirement"
        );
        return {
          retired: assertBoolean(data.retired, "retired"),
          alreadyRetired: data.already_retired === true,
          retirementId: data.retirement_id ?? null,
          retiredAt: data.retired_at ?? null,
          suspendedMemberships: assertCount(
            data.suspended_memberships ?? 0,
            "suspended_memberships"
          )
        };
      },

      async restore() {
        const data = assertActionResult(
          await callRpc(client, "restore_my_account"),
          "restoration"
        );
        return {
          restored: assertBoolean(data.restored, "restored"),
          alreadyActive: data.already_active === true,
          restoredAt: data.restored_at ?? null,
          restoredMemberships: assertCount(
            data.restored_memberships ?? 0,
            "restored_memberships"
          )
        };
      },

      async requestPermanentDeletion(confirmationText) {
        const confirmation = assertNonEmpty(
          confirmationText,
          "permanent_deletion_confirmation"
        );
        const data = assertActionResult(
          await callRpc(client, "request_permanent_account_deletion", {
            confirmation_text: confirmation
          }),
          "deletion_request"
        );
        return {
          requested: assertBoolean(data.requested, "requested"),
          alreadyRequested: data.already_requested === true,
          processing: data.processing === true,
          retirementId: data.retirement_id ?? null,
          requestedAt: data.requested_at ?? null
        };
      },

      async cancelPermanentDeletion() {
        const data = assertActionResult(
          await callRpc(client, "cancel_permanent_account_deletion"),
          "deletion_cancellation"
        );
        return {
          cancelled: assertBoolean(data.cancelled, "cancelled"),
          alreadyCancelled: data.already_cancelled === true,
          retirementId: data.retirement_id ?? null
        };
      },

      async completePermanentDeletion(retirementId) {
        const normalizedRetirementId = assertNonEmpty(
          retirementId,
          "retirement_id"
        );
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        const accessToken = data?.session?.access_token;
        if (!accessToken) {
          throw new AccountLifecycleError("authentication_required", {
            status: 401
          });
        }

        let response;
        try {
          response = await fetchImpl(completionEndpoint, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ retirementId: normalizedRetirementId })
          });
        } catch (cause) {
          throw new AccountLifecycleError(
            "account_deletion_service_unavailable",
            { cause }
          );
        }

        const payload = await readJsonResponse(response);
        if (!response.ok) {
          throw new AccountLifecycleError(
            typeof payload.error === "string"
              ? payload.error
              : "account_deletion_failed",
            {
              status: response.status,
              retryAfterSeconds: Number.isSafeInteger(
                payload.retryAfterSeconds
              )
                ? payload.retryAfterSeconds
                : null
            }
          );
        }

        if (response.status === 202 && payload.pendingRecovery === true) {
          return {
            deleted: false,
            pendingRecovery: true,
            retirementId: payload.retirementId || normalizedRetirementId,
            completedAt: null
          };
        }
        if (payload.deleted !== true) {
          throw new AccountLifecycleError(
            "account_deletion_response_invalid",
            { status: response.status }
          );
        }
        return {
          deleted: true,
          pendingRecovery: false,
          retirementId: payload.retirementId || normalizedRetirementId,
          completedAt: payload.completedAt || null
        };
      }
    });
  }

  window.VoyageAccountLifecycle = Object.freeze({
    AccountLifecycleError,
    RETIREMENT_CONFIRMATION,
    PERMANENT_DELETION_CONFIRMATION,
    create: createAccountLifecycle
  });
})();
