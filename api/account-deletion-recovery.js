"use strict";

const crypto = require("node:crypto");

const RECOVERY_BATCH_SIZE = 25;

function sendJson(res, statusCode, payload) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(statusCode).json(payload);
}

function readHeader(req, name) {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  if (!leftBuffer.length || leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isAuthorizedCronRequest(req, cronSecret) {
  const authorization = String(readHeader(req, "authorization") || "").trim();
  return safeEqual(authorization, `Bearer ${cronSecret}`);
}

function getRecoveryConfig(env = process.env) {
  const supabaseUrl = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  const cronSecret = String(env.CRON_SECRET || "");
  if (!supabaseUrl || !serviceRoleKey || !cronSecret) return null;
  try {
    const parsed = new URL(supabaseUrl);
    if (!["https:", "http:"].includes(parsed.protocol)) return null;
  } catch {
    return null;
  }
  return { supabaseUrl, serviceRoleKey, cronSecret };
}

function createServiceHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...extra
  };
}

async function readPayload(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function listProcessingDeletions(config, fetchImpl) {
  const query = new URLSearchParams({
    status: "eq.deletion_processing",
    select: "id,user_id",
    order: "deletion_processing_at.asc",
    limit: String(RECOVERY_BATCH_SIZE)
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
  const payload = await readPayload(response);
  if (!response.ok || !Array.isArray(payload)) {
    throw new Error("processing_deletion_lookup_failed");
  }
  return payload;
}

async function authUserExists(config, userId, fetchImpl) {
  const response = await fetchImpl(
    `${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "GET",
      headers: createServiceHeaders(config.serviceRoleKey)
    }
  );
  if (response.status === 404) return false;
  if (!response.ok) throw new Error("auth_user_status_unknown");
  return true;
}

async function callServiceRpc(config, functionName, record, fetchImpl) {
  const response = await fetchImpl(
    `${config.supabaseUrl}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: createServiceHeaders(config.serviceRoleKey, {
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        target_user_id: record.user_id,
        target_retirement_id: record.id
      })
    }
  );
  if (!response.ok) throw new Error(`${functionName}_failed`);
}

async function recoverRecord(config, record, fetchImpl) {
  const exists = await authUserExists(config, record.user_id, fetchImpl);
  if (exists) {
    await callServiceRpc(
      config,
      "release_permanent_account_deletion",
      record,
      fetchImpl
    );
    return "released";
  }
  await callServiceRpc(
    config,
    "finalize_permanent_account_deletion",
    record,
    fetchImpl
  );
  return "finalized";
}

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const config = getRecoveryConfig();
  if (!config) {
    sendJson(res, 503, { error: "account_deletion_recovery_unavailable" });
    return;
  }
  if (!isAuthorizedCronRequest(req, config.cronSecret)) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  let records;
  try {
    records = await listProcessingDeletions(config, fetch);
  } catch {
    sendJson(res, 503, { error: "account_deletion_recovery_unavailable" });
    return;
  }

  const summary = {
    scanned: records.length,
    finalized: 0,
    released: 0,
    deferred: 0
  };

  for (const record of records) {
    try {
      const result = await recoverRecord(config, record, fetch);
      summary[result] += 1;
    } catch {
      summary.deferred += 1;
    }
  }

  sendJson(res, 200, summary);
}

module.exports = handler;
module.exports._test = {
  RECOVERY_BATCH_SIZE,
  getRecoveryConfig,
  isAuthorizedCronRequest,
  safeEqual
};
