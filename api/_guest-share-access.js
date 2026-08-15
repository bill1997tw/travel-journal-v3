"use strict";

const crypto = require("node:crypto");

const STORAGE_BUCKET = "travel-assets";
const SHARE_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEDIA_ID_PATTERN = /^(voucher|guide|memory):([a-z0-9._-]{1,128}):(file|qr|cover|image)$/i;

function getServerConfig(env = process.env) {
  const supabaseUrl = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!supabaseUrl || !serviceRoleKey) return null;
  try {
    if (!/^https:$/.test(new URL(supabaseUrl).protocol)) return null;
  } catch {
    return null;
  }
  return { supabaseUrl, serviceRoleKey };
}

function hashShareToken(rawToken) {
  const token = String(rawToken || "").trim();
  if (!SHARE_TOKEN_PATTERN.test(token)) return "";
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function serviceHeaders(config) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    Accept: "application/json"
  };
}

async function fetchRows(config, table, params, fetchImpl = fetch) {
  const url = new URL(`${config.supabaseUrl}/rest/v1/${table}`);
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetchImpl(url, { headers: serviceHeaders(config) });
  if (!response.ok) throw new Error("share_service_unavailable");
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function loadShareContext(rawToken, options = {}) {
  const config = options.config || getServerConfig(options.env);
  const tokenHash = hashShareToken(rawToken);
  if (!tokenHash) return { ok: false, status: 404, error: "invalid_or_expired" };
  if (!config) return { ok: false, status: 503, error: "share_service_unavailable" };

  const fetchImpl = options.fetchImpl || fetch;
  const [share] = await fetchRows(config, "trip_guest_shares", {
    select: "trip_id,include_alternatives,include_checklists,include_budget,include_ledger,include_vouchers,include_diary,expires_at,revoked_at",
    token_hash: `eq.${tokenHash}`,
    limit: "1"
  }, fetchImpl);

  const expired = share?.expires_at && new Date(share.expires_at).getTime() <= Date.now();
  if (!share || share.revoked_at || expired) {
    return { ok: false, status: 404, error: "invalid_or_expired" };
  }

  const [trip] = await fetchRows(config, "trips", {
    select: "id,owner_id,archived_at",
    id: `eq.${share.trip_id}`,
    limit: "1"
  }, fetchImpl);
  if (!trip || trip.archived_at) {
    return { ok: false, status: 404, error: "invalid_or_expired" };
  }

  const [document] = await fetchRows(config, "trip_documents", {
    select: "state,revision",
    trip_id: `eq.${share.trip_id}`,
    limit: "1"
  }, fetchImpl);
  const sourceTrip = document?.state?.trip;
  if (!sourceTrip || typeof sourceTrip !== "object") {
    return { ok: false, status: 404, error: "invalid_or_expired" };
  }

  return { ok: true, config, share, trip, sourceTrip, revision: document.revision, fetchImpl };
}

function normalizePublicUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function safeLegacyMedia(value) {
  const source = String(value || "").trim();
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(source)) return source;
  if (/^data:application\/pdf;base64,[a-z0-9+/=\s]+$/i.test(source)) return source;
  return normalizePublicUrl(source);
}

function mediaId(kind, id, slot) {
  const safeId = String(id || "").trim();
  if (!/^[a-z0-9._-]{1,128}$/i.test(safeId)) return "";
  return `${kind}:${safeId}:${slot}`;
}

function guestMediaUrl(rawToken, descriptor) {
  if (!descriptor) return "";
  const params = new URLSearchParams({ token: rawToken, media: descriptor });
  return `/api/guest-share-media?${params.toString()}`;
}

function publicVoucherRecord(item, rawToken) {
  const id = String(item?.id || "");
  const fileDescriptor = mediaId("voucher", id, "file");
  const qrDescriptor = mediaId("voucher", id, "qr");
  const fileSource = String(item?.fileData || "").trim();
  const qrSource = String(item?.qrCode || item?.qrData || "").trim();
  const fileUrl = fileSource.startsWith("storage://")
    ? guestMediaUrl(rawToken, fileDescriptor)
    : safeLegacyMedia(fileSource);
  const qrUrl = qrSource.startsWith("storage://")
    ? guestMediaUrl(rawToken, qrDescriptor)
    : safeLegacyMedia(qrSource);

  return {
    id,
    title: String(item?.title || ""),
    category: String(item?.category || ""),
    date: String(item?.date || ""),
    notes: String(item?.notes || ""),
    link: normalizePublicUrl(item?.link || item?.bookingUrl),
    fileName: String(item?.fileName || ""),
    fileType: String(item?.fileType || ""),
    fileUrl,
    qrUrl
  };
}

function publicMediaUrl(source, rawToken, descriptor) {
  const value = String(source || "").trim();
  return value.startsWith("storage://")
    ? guestMediaUrl(rawToken, descriptor)
    : safeLegacyMedia(value);
}

function getSharedVouchers(context, rawToken) {
  if (!context?.share?.include_vouchers) return [];
  const vouchers = Array.isArray(context.sourceTrip?.vouchers) ? context.sourceTrip.vouchers : [];
  return vouchers.map(item => publicVoucherRecord(item, rawToken));
}

function getSharedGuides(context, rawToken) {
  const guides = Array.isArray(context.sourceTrip?.guides) ? context.sourceTrip.guides : [];
  return guides.map(item => {
    const id = String(item?.id || "");
    const source = item?.coverUrl || (item?.kind === "image" ? item?.url : "");
    return {
      id,
      kind: String(item?.kind || "note"),
      title: String(item?.title || ""),
      description: String(item?.description || ""),
      url: normalizePublicUrl(item?.url),
      dayLabel: String(item?.dayLabel || ""),
      region: String(item?.region || ""),
      tags: (Array.isArray(item?.tags) ? item.tags : []).map(tag => String(tag || "")).slice(0, 12),
      coverUrl: publicMediaUrl(source, rawToken, mediaId("guide", id, "cover"))
    };
  });
}

function getSharedDiaryMedia(context, rawToken) {
  const diary = context.sourceTrip?.diary;
  if (!context.share.include_diary || diary?.status !== "published") return null;
  const memories = (Array.isArray(diary.memories) ? diary.memories : [])
    .filter(item => item?.includedInStory !== false)
    .map(item => {
      const id = String(item?.id || "");
      return {
        id,
        imageUrl: publicMediaUrl(item?.image, rawToken, mediaId("memory", id, "image"))
      };
    });
  return {
    imageUrl: publicMediaUrl(diary.image, rawToken, "diary:cover"),
    memories
  };
}

function resolveMediaReference(context, descriptor) {
  if (descriptor === "diary:cover") {
    const diary = context.sourceTrip?.diary;
    return context.share.include_diary && diary?.status === "published"
      ? String(diary.image || "")
      : "";
  }
  const match = String(descriptor || "").match(MEDIA_ID_PATTERN);
  if (!match) return "";
  const [, kind, id, slot] = match;
  const trip = context.sourceTrip || {};

  if (kind === "voucher") {
    if (!context.share.include_vouchers) return "";
    const voucher = (Array.isArray(trip.vouchers) ? trip.vouchers : [])
      .find(item => String(item?.id || "") === id);
    if (!voucher) return "";
    if (slot === "file") return String(voucher.fileData || "");
    if (slot === "qr") return String(voucher.qrCode || voucher.qrData || "");
    return "";
  }

  if (kind === "guide") {
    const guide = (Array.isArray(trip.guides) ? trip.guides : [])
      .find(item => String(item?.id || "") === id);
    if (!guide || slot !== "cover") return "";
    return String(guide.coverUrl || (guide.kind === "image" ? guide.url : "") || "");
  }

  const diary = trip.diary;
  if (!context.share.include_diary || diary?.status !== "published") return "";
  if (kind === "memory" && slot === "image") {
    const memory = (Array.isArray(diary.memories) ? diary.memories : [])
      .find(item => String(item?.id || "") === id && item?.includedInStory !== false);
    return String(memory?.image || "");
  }
  return "";
}

function parseAuthorizedStorageReference(context, descriptor) {
  const reference = resolveMediaReference(context, descriptor).trim();
  if (!reference.startsWith(`storage://${STORAGE_BUCKET}/`)) return null;
  const path = reference.slice(`storage://${STORAGE_BUCKET}/`.length).replace(/^\/+/, "");
  const parts = path.split("/");
  const fileMatch = String(parts[3] || "").match(/^([0-9a-f-]{36})\.(jpg|jpeg|png|webp)$/i);
  if (parts.length !== 4 || !UUID_PATTERN.test(parts[0]) || parts[1] !== "trips"
    || parts[2].toLowerCase() !== String(context.trip.id).toLowerCase()
    || !fileMatch || !UUID_PATTERN.test(fileMatch[1])) {
    return null;
  }
  return { bucket: STORAGE_BUCKET, path };
}

async function createSignedMediaUrl(context, storageReference, expiresIn = 60) {
  const encodedPath = storageReference.path.split("/").map(encodeURIComponent).join("/");
  const response = await context.fetchImpl(
    `${context.config.supabaseUrl}/storage/v1/object/sign/${storageReference.bucket}/${encodedPath}`,
    {
      method: "POST",
      headers: {
        ...serviceHeaders(context.config),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ expiresIn })
    }
  );
  if (!response.ok) throw new Error("media_sign_failed");
  const payload = await response.json().catch(() => ({}));
  const signedPath = payload.signedURL || payload.signedUrl;
  if (!signedPath) throw new Error("media_sign_failed");
  return new URL(signedPath, `${context.config.supabaseUrl}/storage/v1/`).toString();
}

module.exports = {
  STORAGE_BUCKET,
  SHARE_TOKEN_PATTERN,
  getServerConfig,
  hashShareToken,
  loadShareContext,
  normalizePublicUrl,
  safeLegacyMedia,
  mediaId,
  guestMediaUrl,
  getSharedVouchers,
  getSharedGuides,
  getSharedDiaryMedia,
  resolveMediaReference,
  parseAuthorizedStorageReference,
  createSignedMediaUrl
};
