"use strict";

const {
  loadShareContext,
  parseAuthorizedStorageReference,
  createSignedMediaUrl
} = require("./_guest-share-access");

function sendJson(res, statusCode, payload, headers = {}) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  Object.entries(headers).forEach(([name, value]) => res.setHeader(name, value));
  return res.status(statusCode).json(payload);
}

async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "method_not_allowed" }, { Allow: "GET" });
  }
  const token = String(req.query?.token || "");
  const descriptor = String(req.query?.media || "");

  try {
    const context = await loadShareContext(token);
    if (!context.ok) return sendJson(res, context.status, { error: context.error });
    const storageReference = parseAuthorizedStorageReference(context, descriptor);
    if (!storageReference) return sendJson(res, 404, { error: "media_not_authorized" });
    const signedUrl = await createSignedMediaUrl(context, storageReference);
    res.setHeader("Cache-Control", "private, max-age=45");
    res.setHeader("Referrer-Policy", "no-referrer");
    return res.redirect(302, signedUrl);
  } catch {
    return sendJson(res, 503, { error: "media_temporarily_unavailable" });
  }
}

module.exports = handler;
