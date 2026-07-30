import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const handler = require("../api/account-permanent-deletion.js");
const {
  CANCELLATION_WINDOW_MS,
  getBearerToken,
  getCancellationWindow,
  getServerConfig,
  isSameOriginRequest
} = handler._test;

const USER_ID = "10000000-0000-4000-8000-000000000001";
const RETIREMENT_ID = "20000000-0000-4000-8000-000000000002";

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return payload == null ? "" : JSON.stringify(payload);
    }
  };
}

function createResponse() {
  return {
    headers: {},
    statusCode: null,
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

function createRequest(overrides = {}) {
  return {
    method: "POST",
    headers: {
      host: "travel.example.com",
      origin: "https://travel.example.com",
      authorization: "Bearer user-access-token"
    },
    body: { retirementId: RETIREMENT_ID },
    ...overrides
  };
}

async function withServerEnvironment(fetchImpl, callback) {
  const previousFetch = global.fetch;
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  global.fetch = fetchImpl;
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";
  try {
    await callback();
  } finally {
    global.fetch = previousFetch;
    if (previousUrl == null) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
}

test("permanent deletion helpers reject cross-origin and malformed auth", () => {
  assert.equal(
    isSameOriginRequest({
      headers: {
        host: "travel.example.com",
        origin: "https://evil.example.com"
      }
    }),
    false
  );
  assert.equal(
    isSameOriginRequest({
      headers: {
        host: "travel.example.com",
        origin: "https://travel.example.com"
      }
    }),
    true
  );
  assert.equal(
    getBearerToken({ headers: { authorization: "Bearer valid-token" } }),
    "valid-token"
  );
  assert.equal(getBearerToken({ headers: { authorization: "Basic nope" } }), "");
});

test("server configuration requires both Supabase secrets", () => {
  assert.equal(getServerConfig({ SUPABASE_URL: "https://project.supabase.co" }), null);
  assert.deepEqual(
    getServerConfig({
      SUPABASE_URL: "https://project.supabase.co/",
      SUPABASE_SERVICE_ROLE_KEY: "secret"
    }),
    {
      supabaseUrl: "https://project.supabase.co",
      serviceRoleKey: "secret"
    }
  );
});

test("cancellation window lasts 24 hours but processing requests can resume", () => {
  const now = Date.parse("2026-07-30T12:00:00Z");
  const active = getCancellationWindow(
    {
      status: "deletion_pending",
      deletion_requested_at: new Date(now - CANCELLATION_WINDOW_MS + 60_000).toISOString()
    },
    now
  );
  assert.equal(active.active, true);
  assert.equal(active.retryAfterSeconds, 60);

  assert.deepEqual(
    getCancellationWindow({ status: "deletion_processing" }, now),
    { active: false, retryAfterSeconds: 0 }
  );
});

test("endpoint refuses completion during the cancellation window", async () => {
  const calls = [];
  await withServerEnvironment(async (url) => {
    calls.push(url);
    if (url.endsWith("/auth/v1/user")) {
      return jsonResponse(200, { id: USER_ID });
    }
    return jsonResponse(200, [
      {
        id: RETIREMENT_ID,
        status: "deletion_pending",
        deletion_requested_at: new Date(Date.now() - 60_000).toISOString()
      }
    ]);
  }, async () => {
    const res = createResponse();
    await handler(createRequest(), res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.payload.error, "account_deletion_cancellation_window_active");
    assert.ok(Number(res.headers["Retry-After"]) > 0);
    assert.equal(calls.length, 2);
  });
});

test("endpoint verifies ownership and completes deletion in service order", async () => {
  const calls = [];
  await withServerEnvironment(async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/v1/user")) {
      return jsonResponse(200, { id: USER_ID });
    }
    if (url.includes("/rest/v1/account_retirements?")) {
      return jsonResponse(200, [
        {
          id: RETIREMENT_ID,
          status: "deletion_pending",
          deletion_requested_at: "2026-07-28T00:00:00Z"
        }
      ]);
    }
    if (url.endsWith("/rpc/prepare_permanent_account_deletion")) {
      return jsonResponse(200, { prepared: true });
    }
    if (url.includes("/auth/v1/admin/users/")) {
      return jsonResponse(200, {});
    }
    if (url.endsWith("/rpc/finalize_permanent_account_deletion")) {
      return jsonResponse(200, {
        deleted: true,
        completed_at: "2026-07-30T12:00:00Z"
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }, async () => {
    const res = createResponse();
    await handler(createRequest(), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, {
      deleted: true,
      retirementId: RETIREMENT_ID,
      completedAt: "2026-07-30T12:00:00Z"
    });
    assert.deepEqual(
      calls.map(call => {
        if (call.url.endsWith("/auth/v1/user")) return "verify";
        if (call.url.includes("/account_retirements?")) return "lookup";
        if (call.url.includes("/prepare_")) return "prepare";
        if (call.url.includes("/admin/users/")) return "delete-auth";
        if (call.url.includes("/finalize_")) return "finalize";
        return "unknown";
      }),
      ["verify", "lookup", "prepare", "delete-auth", "finalize"]
    );
    assert.equal(
      calls.some(call =>
        String(call.options.headers?.Authorization || "").includes(
          "user-access-token"
        ) && !call.url.endsWith("/auth/v1/user")
      ),
      false
    );
  });
});

test("endpoint releases processing state when Auth deletion safely fails", async () => {
  const calls = [];
  await withServerEnvironment(async (url) => {
    calls.push(url);
    if (url.endsWith("/auth/v1/user")) {
      return jsonResponse(200, { id: USER_ID });
    }
    if (url.includes("/rest/v1/account_retirements?")) {
      return jsonResponse(200, [
        {
          id: RETIREMENT_ID,
          status: "deletion_pending",
          deletion_requested_at: "2026-07-28T00:00:00Z"
        }
      ]);
    }
    if (url.endsWith("/rpc/prepare_permanent_account_deletion")) {
      return jsonResponse(200, { prepared: true });
    }
    if (url.includes("/auth/v1/admin/users/")) {
      return jsonResponse(503, { error: "temporary" });
    }
    if (url.endsWith("/rpc/finalize_permanent_account_deletion")) {
      return jsonResponse(409, { message: "auth_user_deletion_not_completed" });
    }
    if (url.endsWith("/rpc/release_permanent_account_deletion")) {
      return jsonResponse(200, { released: true });
    }
    throw new Error(`Unexpected request: ${url}`);
  }, async () => {
    const res = createResponse();
    await handler(createRequest(), res);
    assert.equal(res.statusCode, 502);
    assert.deepEqual(res.payload, {
      error: "auth_user_deletion_failed",
      retryable: true
    });
    assert.equal(calls.at(-1).endsWith("/rpc/release_permanent_account_deletion"), true);
  });
});
