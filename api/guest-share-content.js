"use strict";

const {
  loadShareContext,
  getSharedVouchers,
  getSharedGuides,
  getSharedDiaryMedia
} = require("./_guest-share-access");

const MAX_BODY_BYTES = 2048;

function sendJson(res, statusCode, payload) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(statusCode).json(payload);
}

function readHeader(req, name) {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function isSameOriginRequest(req) {
  const origin = String(readHeader(req, "origin") || "").trim();
  if (!origin) return true;
  const host = String(readHeader(req, "x-forwarded-host") || readHeader(req, "host") || "")
    .split(",")[0].trim().toLowerCase();
  try {
    return Boolean(host) && new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

async function readJsonBody(req) {
  if (req.body != null) {
    const text = Buffer.isBuffer(req.body) ? req.body.toString("utf8")
      : typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new Error("body_too_large");
    return JSON.parse(text || "{}");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("body_too_large");
    chunks.push(buffer);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });
  if (!isSameOriginRequest(req)) return sendJson(res, 403, { error: "cross_origin_request_rejected" });
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: "invalid_request_body" });
  }

  try {
    const context = await loadShareContext(body?.token);
    if (!context.ok) return sendJson(res, context.status, { error: context.error });
    return sendJson(res, 200, {
      vouchers: getSharedVouchers(context, body.token),
      guides: getSharedGuides(context, body.token),
      diaryMedia: getSharedDiaryMedia(context, body.token)
    });
  } catch {
    return sendJson(res, 503, { error: "share_service_unavailable" });
  }
}

module.exports = handler;
module.exports._test = { MAX_BODY_BYTES, isSameOriginRequest, readJsonBody };
