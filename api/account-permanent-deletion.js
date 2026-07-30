"use strict";

const MAX_BODY_BYTES = 2048;
const CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  for (const [name, value] of Object.entries(extraHeaders)) {
    res.setHeader(name, value);
  }
  res.status(statusCode).json(payload);
}

function readHeader(req, name) {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function getBearerToken(req) {
  const authorization = String(readHeader(req, "authorization") || "").trim();
  const matched = authorization.match(/^Bearer\s+(\S+)$/i);
  return matched?.[1] || "";
}

function isSameOriginRequest(req) {
  const origin = String(readHeader(req, "origin") || "").trim();
  if (!origin) return true;

  const requestHost = String(
    readHeader(req, "x-forwarded-host") || readHeader(req, "host") || ""
  )
    .split(",")[0]
    .trim()
    .toLowerCase();

  if (!requestHost) return false;

  try {
    return new URL(origin).host.toLowerCase() === requestHost;
  } catch {
    return false;
  }
}

async function readJsonBody(req) {
  if (req.body != null) {
    if (Buffer.isBuffer(req.body)) {
      if (req.body.byteLength > MAX_BODY_BYTES) throw new Error("body_too_large");
      return JSON.parse(req.body.toString("utf8"));
    }
    if (typeof req.body === "string") {
      if (Buffer.byteLength(req.body, "utf8") > MAX_BODY_BYTES) {
        throw new Error("body_too_large");
      }
      return JSON.parse(req.body);
    }
    if (typeof req.body === "object") return req.body;
  }

  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) throw new Error("body_too_large");
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function getServerConfig(env = process.env) {
  const supabaseUrl = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!supabaseUrl || !serviceRoleKey) return null;

  try {
    const parsed = new URL(supabaseUrl);
    if (!["https:", "http:"].includes(parsed.protocol)) return null;
  } catch {
    return null;
  }

  return { supabaseUrl, serviceRoleKey };
}

async function readResponsePayload(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function createServiceHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...extra
  };
}

async function verifyUser(config, accessToken, fetchImpl) {
  const response = await fetchImpl(`${config.supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${accessToken}`
    }
  });
  const payload = await readResponsePayload(response);
  if (!response.ok || !UUID_PATTERN.test(String(payload?.id || ""))) {
    return null;
  }
  return payload;
}

async function getDeletionRequest(config, userId, retirementId, fetchImpl) {
  const query = new URLSearchParams({
    id: `eq.${retirementId}`,
    user_id: `eq.${userId}`,
    select: "id,status,deletion_requested_at",
    limit: "1"
  });
  const response = await fetchImpl(
    `${config.supabaseUrl}/rest/v1/account_retirements?${query}`,
    {
      method: "GET",
      headers: createServiceHeaders(config.serviceRoleKey, {
        Accept: "application/json"
      })
    }
  );
  const payload = await readResponsePayload(response);
  if (!response.ok) throw new Error("deletion_request_lookup_failed");
  return Array.isArray(payload) ? payload[0] || null : null;
}

async function callServiceRpc(config, functionName, args, fetchImpl) {
  const response = await fetchImpl(
    `${config.supabaseUrl}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: createServiceHeaders(config.serviceRoleKey, {
        "Content-Type": "application/json"
      }),
      body: JSON.stringify(args)
    }
  );
  const payload = await readResponsePayload(response);
  if (!response.ok) {
    const error = new Error(`${functionName}_failed`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function deleteAuthUser(config, userId, fetchImpl) {
  const response = await fetchImpl(
    `${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}?should_soft_delete=false`,
    {
      method: "DELETE",
      headers: createServiceHeaders(config.serviceRoleKey)
    }
  );
  if (!response.ok) {
    const error = new Error("auth_user_deletion_failed");
    error.status = response.status;
    throw error;
  }
}

function getCancellationWindow(request, nowMs = Date.now()) {
  if (request?.status === "deletion_processing") {
    return { active: false, retryAfterSeconds: 0 };
  }
  const requestedAt = Date.parse(String(request?.deletion_requested_at || ""));
  if (!Number.isFinite(requestedAt)) {
    return { active: true, retryAfterSeconds: Math.ceil(CANCELLATION_WINDOW_MS / 1000) };
  }
  const remainingMs = requestedAt + CANCELLATION_WINDOW_MS - nowMs;
  return {
    active: remainingMs > 0,
    retryAfterSeconds: Math.max(0, Math.ceil(remainingMs / 1000))
  };
}

async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "method_not_allowed" }, { Allow: "POST" });
    return;
  }
  if (!isSameOriginRequest(req)) {
    sendJson(res, 403, { error: "cross_origin_request_rejected" });
    return;
  }

  const config = getServerConfig();
  if (!config) {
    sendJson(res, 503, { error: "account_deletion_service_unavailable" });
    return;
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) {
    sendJson(res, 401, { error: "authentication_required" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "invalid_request_body" });
    return;
  }

  const retirementId = String(body?.retirementId || "").trim();
  if (!UUID_PATTERN.test(retirementId)) {
    sendJson(res, 400, { error: "valid_retirement_id_required" });
    return;
  }

  let user;
  try {
    user = await verifyUser(config, accessToken, fetch);
  } catch {
    sendJson(res, 503, { error: "account_deletion_service_unavailable" });
    return;
  }
  if (!user) {
    sendJson(res, 401, { error: "invalid_session" });
    return;
  }

  let deletionRequest;
  try {
    deletionRequest = await getDeletionRequest(
      config,
      user.id,
      retirementId,
      fetch
    );
  } catch {
    sendJson(res, 503, { error: "account_deletion_service_unavailable" });
    return;
  }
  if (
    !deletionRequest ||
    !["deletion_pending", "deletion_processing"].includes(deletionRequest.status)
  ) {
    sendJson(res, 409, { error: "pending_account_deletion_not_found" });
    return;
  }

  const cancellationWindow = getCancellationWindow(deletionRequest);
  if (cancellationWindow.active) {
    sendJson(
      res,
      409,
      {
        error: "account_deletion_cancellation_window_active",
        retryAfterSeconds: cancellationWindow.retryAfterSeconds
      },
      { "Retry-After": String(cancellationWindow.retryAfterSeconds) }
    );
    return;
  }

  const rpcArgs = {
    target_user_id: user.id,
    target_retirement_id: retirementId
  };

  try {
    await callServiceRpc(
      config,
      "prepare_permanent_account_deletion",
      rpcArgs,
      fetch
    );
  } catch {
    sendJson(res, 409, { error: "account_deletion_not_ready" });
    return;
  }

  let authDeletionFailed = false;
  try {
    await deleteAuthUser(config, user.id, fetch);
  } catch {
    authDeletionFailed = true;
  }

  try {
    const finalized = await callServiceRpc(
      config,
      "finalize_permanent_account_deletion",
      rpcArgs,
      fetch
    );
    sendJson(res, 200, {
      deleted: true,
      retirementId,
      completedAt: finalized?.completed_at || null
    });
    return;
  } catch {
    if (authDeletionFailed) {
      try {
        await callServiceRpc(
          config,
          "release_permanent_account_deletion",
          rpcArgs,
          fetch
        );
        sendJson(res, 502, {
          error: "auth_user_deletion_failed",
          retryable: true
        });
        return;
      } catch {
        // Auth may already be gone. Leave the durable processing record for
        // the recovery worker instead of falsely reporting a safe rollback.
      }
    }
  }

  sendJson(res, 202, {
    accepted: true,
    pendingRecovery: true,
    retirementId
  });
}

module.exports = handler;
module.exports._test = {
  CANCELLATION_WINDOW_MS,
  UUID_PATTERN,
  getBearerToken,
  getCancellationWindow,
  getServerConfig,
  isSameOriginRequest,
  readJsonBody
};
