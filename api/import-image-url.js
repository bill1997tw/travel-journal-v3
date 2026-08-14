"use strict";

const dns = require("node:dns").promises;
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");

const MAX_BODY_BYTES = 4096;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 8000;
const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

function sendJson(res, statusCode, payload, headers = {}) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  Object.entries(headers).forEach(([name, value]) => res.setHeader(name, value));
  res.status(statusCode).json(payload);
}

function readHeader(req, name) {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function getBearerToken(req) {
  const matched = String(readHeader(req, "authorization") || "").trim().match(/^Bearer\s+(\S+)$/i);
  return matched?.[1] || "";
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

function getServerConfig(env = process.env) {
  const supabaseUrl = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!supabaseUrl || !serviceRoleKey) return null;
  try {
    if (!/^https?:$/.test(new URL(supabaseUrl).protocol)) return null;
  } catch {
    return null;
  }
  return { supabaseUrl, serviceRoleKey };
}

async function verifyUser(config, accessToken, fetchImpl = fetch) {
  const response = await fetchImpl(`${config.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  return payload?.id ? payload : null;
}

function normalizeImportUrl(value, base) {
  let url;
  try {
    url = base ? new URL(String(value || ""), base) : new URL(String(value || "").trim());
  } catch {
    throw new Error("invalid_url");
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error("invalid_url");
  }
  if (!url.hostname || url.hostname.endsWith(".")) url.hostname = url.hostname.replace(/\.$/, "");
  return url;
}

function isPrivateIp(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19))
      || a >= 224;
  }
  if (family === 6) {
    const normalized = address.toLowerCase().split("%")[0];
    if (normalized === "::" || normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized)) return true;
    if (normalized.startsWith("::ffff:")) return isPrivateIp(normalized.slice(7));
    return false;
  }
  return true;
}

async function resolvePublicAddress(hostname, lookup = dns.lookup) {
  const normalizedHost = String(hostname || "").toLowerCase();
  if (!normalizedHost || normalizedHost === "localhost" || normalizedHost.endsWith(".localhost")) {
    throw new Error("private_network_rejected");
  }
  if (net.isIP(normalizedHost)) {
    if (isPrivateIp(normalizedHost)) throw new Error("private_network_rejected");
    return { address: normalizedHost, family: net.isIP(normalizedHost) };
  }
  const addresses = await lookup(normalizedHost, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(entry => isPrivateIp(entry.address))) {
    throw new Error("private_network_rejected");
  }
  return addresses[0];
}

function sniffImageMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).equals(buffer.subarray(0, 8))) return "image/png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return "";
}

function requestPinned(url, address, options = {}) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.get(url, {
      headers: { Accept: "image/jpeg,image/png,image/webp", "User-Agent": "VoyageBook-ImageImporter/1.0" },
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      servername: url.hostname
    }, response => {
      const chunks = [];
      let size = 0;
      response.on("data", chunk => {
        size += chunk.length;
        if (size > (options.maxBytes || MAX_IMAGE_BYTES)) {
          request.destroy(new Error("download_too_large"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({
        statusCode: response.statusCode || 0,
        headers: response.headers,
        body: Buffer.concat(chunks)
      }));
    });
    request.setTimeout(options.timeoutMs || REQUEST_TIMEOUT_MS, () => request.destroy(new Error("request_timeout")));
    request.on("error", reject);
  });
}

async function downloadImage(rawUrl, options = {}) {
  let url = normalizeImportUrl(rawUrl);
  for (let redirects = 0; redirects <= (options.maxRedirects ?? MAX_REDIRECTS); redirects += 1) {
    const address = await resolvePublicAddress(url.hostname, options.lookup || dns.lookup);
    const response = await (options.request || requestPinned)(url, address, options);
    if (response.body.length > (options.maxBytes || MAX_IMAGE_BYTES)) throw new Error("download_too_large");
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      if (redirects >= (options.maxRedirects ?? MAX_REDIRECTS)) throw new Error("too_many_redirects");
      const location = response.headers.location;
      if (!location) throw new Error("invalid_redirect");
      url = normalizeImportUrl(location, url);
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) throw new Error("download_failed");
    const declared = String(response.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_MIMES.has(declared)) throw new Error("unsupported_mime");
    const detected = sniffImageMime(response.body);
    if (!detected || detected !== declared) throw new Error("invalid_image_data");
    return { buffer: response.body, mimeType: detected };
  }
  throw new Error("too_many_redirects");
}

async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" }, { Allow: "POST" });
  if (!isSameOriginRequest(req)) return sendJson(res, 403, { error: "cross_origin_request_rejected" });
  const config = getServerConfig();
  if (!config) return sendJson(res, 503, { error: "image_import_service_unavailable" });
  const token = getBearerToken(req);
  if (!token) return sendJson(res, 401, { error: "authentication_required" });
  let body;
  try { body = await readJsonBody(req); } catch { return sendJson(res, 400, { error: "invalid_request_body" }); }
  let user;
  try { user = await verifyUser(config, token); } catch { return sendJson(res, 503, { error: "image_import_service_unavailable" }); }
  if (!user) return sendJson(res, 401, { error: "invalid_session" });
  try {
    const image = await downloadImage(body?.url);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", image.mimeType);
    res.setHeader("Content-Length", String(image.buffer.length));
    return res.status(200).send(image.buffer);
  } catch (error) {
    const code = String(error?.message || "image_import_failed");
    const clientErrors = new Set(["invalid_url", "private_network_rejected", "too_many_redirects", "invalid_redirect", "download_too_large", "unsupported_mime", "invalid_image_data"]);
    return sendJson(res, clientErrors.has(code) ? 400 : 502, { error: code });
  }
}

module.exports = handler;
module.exports._test = {
  MAX_IMAGE_BYTES,
  MAX_REDIRECTS,
  normalizeImportUrl,
  isPrivateIp,
  resolvePublicAddress,
  sniffImageMime,
  downloadImage,
  getBearerToken,
  isSameOriginRequest
};
