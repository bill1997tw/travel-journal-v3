import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const lifecycleSource = fs.readFileSync(
  new URL("../account-lifecycle.js", import.meta.url),
  "utf8"
);

function loadLifecycle() {
  const sandbox = {
    window: {},
    URL,
    Object,
    Error,
    TypeError,
    Number,
    Array,
    JSON
  };
  vm.runInNewContext(lifecycleSource, sandbox);
  return sandbox.window.VoyageAccountLifecycle;
}

function validStatus() {
  return {
    account_retired: false,
    can_retire_safely: true,
    permanent_deletion_ready: false,
    requires_owner_transfer: false,
    requires_line_rebind: false,
    requires_guest_share_reissue: false,
    owned_trips: [],
    counts: {
      owned_trips: 0,
      other_trip_memberships: 1,
      active_line_bindings: 0,
      open_line_claims: 0,
      guest_shares: 2,
      active_guest_shares: 1,
      profile_references: 3,
      direct_auth_references: 0
    }
  };
}

function createClient(rpcImpl, accessToken = "user-access-token") {
  return {
    rpc: rpcImpl,
    auth: {
      async getSession() {
        return {
          data: {
            session: accessToken ? { access_token: accessToken } : null
          },
          error: null
        };
      }
    }
  };
}

test("browser lifecycle exposes the exact database confirmation phrases", () => {
  const lifecycle = loadLifecycle();
  assert.equal(lifecycle.RETIREMENT_CONFIRMATION, "停用我的帳號");
  assert.equal(
    lifecycle.PERMANENT_DELETION_CONFIRMATION,
    "永久刪除我的帳號"
  );
});

test("browser lifecycle validates and normalizes retirement status", async () => {
  const lifecycle = loadLifecycle();
  const client = createClient(async (name) => {
    assert.equal(name, "get_account_retirement_status_v3");
    return { data: validStatus(), error: null };
  });

  const result = await lifecycle.create(client, {
    fetchImpl: async () => {
      throw new Error("fetch should not run");
    }
  }).getStatus();

  assert.equal(result.canRetireSafely, true);
  assert.equal(result.counts.otherTripMemberships, 1);
  assert.equal(result.counts.activeGuestShares, 1);
});

test("browser lifecycle keeps retirement and deletion requests on guarded RPCs", async () => {
  const lifecycle = loadLifecycle();
  const calls = [];
  const client = createClient(async (name, payload) => {
    calls.push([name, payload]);
    if (name === "retire_my_account") {
      return {
        data: {
          retired: true,
          retirement_id: "retirement-1",
          suspended_memberships: 2
        },
        error: null
      };
    }
    if (name === "request_permanent_account_deletion") {
      return {
        data: {
          requested: true,
          retirement_id: "retirement-1",
          requested_at: "2026-07-31T00:00:00Z"
        },
        error: null
      };
    }
    return {
      data: {
        cancelled: true,
        retirement_id: "retirement-1"
      },
      error: null
    };
  });
  const service = lifecycle.create(client, {
    fetchImpl: async () => {
      throw new Error("fetch should not run");
    }
  });

  await service.retire(lifecycle.RETIREMENT_CONFIRMATION);
  await service.requestPermanentDeletion(
    lifecycle.PERMANENT_DELETION_CONFIRMATION
  );
  await service.cancelPermanentDeletion();

  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    [
      "retire_my_account",
      { confirmation_text: "停用我的帳號" }
    ],
    [
      "request_permanent_account_deletion",
      { confirmation_text: "永久刪除我的帳號" }
    ],
    ["cancel_permanent_account_deletion", null]
  ]);
});

test("completion sends only the current access token and retirement ID", async () => {
  const lifecycle = loadLifecycle();
  let captured;
  const service = lifecycle.create(
    createClient(async () => ({ data: null, error: null })),
    {
      async fetchImpl(url, options) {
        captured = { url, options };
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              deleted: true,
              retirementId: "retirement-1",
              completedAt: "2026-07-31T12:00:00Z"
            };
          }
        };
      }
    }
  );

  const result = await service.completePermanentDeletion("retirement-1");

  assert.equal(result.deleted, true);
  assert.equal(captured.url, "/api/account-permanent-deletion");
  assert.equal(captured.options.credentials, "same-origin");
  assert.equal(
    captured.options.headers.Authorization,
    "Bearer user-access-token"
  );
  assert.deepEqual(JSON.parse(captured.options.body), {
    retirementId: "retirement-1"
  });
  assert.doesNotMatch(JSON.stringify(captured), /service.role/i);
});

test("completion exposes cancellation timing without hiding the server error", async () => {
  const lifecycle = loadLifecycle();
  const service = lifecycle.create(
    createClient(async () => ({ data: null, error: null })),
    {
      async fetchImpl() {
        return {
          ok: false,
          status: 409,
          async json() {
            return {
              error: "account_deletion_cancellation_window_active",
              retryAfterSeconds: 3600
            };
          }
        };
      }
    }
  );

  await assert.rejects(
    service.completePermanentDeletion("retirement-1"),
    (error) => {
      assert.equal(
        error.code,
        "account_deletion_cancellation_window_active"
      );
      assert.equal(error.status, 409);
      assert.equal(error.retryAfterSeconds, 3600);
      return true;
    }
  );
});

test("accepted recovery state is distinct from a completed deletion", async () => {
  const lifecycle = loadLifecycle();
  const service = lifecycle.create(
    createClient(async () => ({ data: null, error: null })),
    {
      async fetchImpl() {
        return {
          ok: true,
          status: 202,
          async json() {
            return {
              accepted: true,
              pendingRecovery: true,
              retirementId: "retirement-1"
            };
          }
        };
      }
    }
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(
      await service.completePermanentDeletion("retirement-1")
    )),
    {
      deleted: false,
      pendingRecovery: true,
      retirementId: "retirement-1",
      completedAt: null
    }
  );
});
