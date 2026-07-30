import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const handler = require("../api/account-deletion-recovery.js");
const { getRecoveryConfig, isAuthorizedCronRequest } = handler._test;

const FIRST_USER = "10000000-0000-4000-8000-000000000001";
const FIRST_RETIREMENT = "20000000-0000-4000-8000-000000000002";
const SECOND_USER = "30000000-0000-4000-8000-000000000003";
const SECOND_RETIREMENT = "40000000-0000-4000-8000-000000000004";

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

async function withRecoveryEnvironment(fetchImpl, callback) {
  const previousFetch = global.fetch;
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousSecret = process.env.CRON_SECRET;
  global.fetch = fetchImpl;
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";
  process.env.CRON_SECRET = "cron-secret";
  try {
    await callback();
  } finally {
    global.fetch = previousFetch;
    if (previousUrl == null) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    if (previousSecret == null) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  }
}

test("recovery configuration and cron authorization require every secret", () => {
  assert.equal(
    getRecoveryConfig({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-secret"
    }),
    null
  );
  assert.equal(
    isAuthorizedCronRequest(
      { headers: { authorization: "Bearer cron-secret" } },
      "cron-secret"
    ),
    true
  );
  assert.equal(
    isAuthorizedCronRequest(
      { headers: { authorization: "Bearer wrong-secret" } },
      "cron-secret"
    ),
    false
  );
});

test("recovery finalizes missing Auth users and releases existing users", async () => {
  const calls = [];
  await withRecoveryEnvironment(async (url) => {
    calls.push(url);
    if (url.includes("/rest/v1/account_retirements?")) {
      return jsonResponse(200, [
        { id: FIRST_RETIREMENT, user_id: FIRST_USER },
        { id: SECOND_RETIREMENT, user_id: SECOND_USER }
      ]);
    }
    if (url.endsWith(`/auth/v1/admin/users/${FIRST_USER}`)) {
      return jsonResponse(404, { error: "not_found" });
    }
    if (url.endsWith(`/auth/v1/admin/users/${SECOND_USER}`)) {
      return jsonResponse(200, { id: SECOND_USER });
    }
    if (url.endsWith("/rpc/finalize_permanent_account_deletion")) {
      return jsonResponse(200, { deleted: true });
    }
    if (url.endsWith("/rpc/release_permanent_account_deletion")) {
      return jsonResponse(200, { released: true });
    }
    throw new Error(`Unexpected request: ${url}`);
  }, async () => {
    const res = createResponse();
    await handler(
      {
        method: "GET",
        headers: { authorization: "Bearer cron-secret" }
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, {
      scanned: 2,
      finalized: 1,
      released: 1,
      deferred: 0
    });
    assert.equal(
      calls.some(url => url.endsWith("/rpc/finalize_permanent_account_deletion")),
      true
    );
    assert.equal(
      calls.some(url => url.endsWith("/rpc/release_permanent_account_deletion")),
      true
    );
  });
});

test("recovery defers unknown Auth state without changing deletion state", async () => {
  await withRecoveryEnvironment(async (url) => {
    if (url.includes("/rest/v1/account_retirements?")) {
      return jsonResponse(200, [
        { id: FIRST_RETIREMENT, user_id: FIRST_USER }
      ]);
    }
    return jsonResponse(503, { error: "temporary" });
  }, async () => {
    const res = createResponse();
    await handler(
      {
        method: "GET",
        headers: { authorization: "Bearer cron-secret" }
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, {
      scanned: 1,
      finalized: 0,
      released: 0,
      deferred: 1
    });
  });
});
