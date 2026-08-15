import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const access = require("../api/_guest-share-access.js");

const TOKEN = "a".repeat(64);
const USER_A = "11111111-1111-4111-8111-111111111111";
const TRIP_A = "22222222-2222-4222-8222-222222222222";
const TRIP_B = "33333333-3333-4333-8333-333333333333";
const MEDIA = "44444444-4444-4444-8444-444444444444.jpg";
const GUIDE_MEDIA = "55555555-5555-4555-8555-555555555555.webp";
const CONFIG = { supabaseUrl: "https://project.supabase.co", serviceRoleKey: "service-secret" };

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; }
  };
}

function createContext({ includeVouchers = true, expiresAt = null, revokedAt = null, fileTripId = TRIP_A, guideTripId = TRIP_A } = {}) {
  const sourceTrip = {
    vouchers: [{
      id: "voucher-1",
      title: "小明的車票",
      category: "租車/車票",
      date: "2026-08-15",
      notes: "月台在二樓",
      link: "https://example.com/ticket",
      fileName: "ticket.jpg",
      fileType: "image/jpeg",
      fileData: `storage://travel-assets/${USER_A}/trips/${fileTripId}/${MEDIA}`
    }],
    guides: [{
      id: "guide-1",
      kind: "note",
      title: "宜蘭雨天攻略",
      coverUrl: "https://project.supabase.co/storage/v1/object/public/travel-guide-assets/legacy.webp",
      coverStoragePath: `${USER_A}/guide-snapshots/${guideTripId}/${GUIDE_MEDIA}`
    }],
    diary: null
  };
  const calls = [];
  const fetchImpl = async rawUrl => {
    const url = new URL(String(rawUrl));
    calls.push(url);
    if (url.pathname.endsWith("/trip_guest_shares")) {
      return response([{
        trip_id: TRIP_A,
        include_vouchers: includeVouchers,
        include_diary: false,
        include_alternatives: true,
        include_checklists: false,
        include_budget: false,
        include_ledger: false,
        expires_at: expiresAt,
        revoked_at: revokedAt
      }]);
    }
    if (url.pathname.endsWith("/trips")) {
      return response([{ id: TRIP_A, owner_id: USER_A, archived_at: null }]);
    }
    if (url.pathname.endsWith("/trip_documents")) {
      return response([{ state: { trip: sourceTrip }, revision: 8 }]);
    }
    throw new Error(`unexpected URL ${url}`);
  };
  return { fetchImpl, calls };
}

test("valid share token authorizes only an allowlisted ticket image", async () => {
  const fixture = createContext();
  const context = await access.loadShareContext(TOKEN, { config: CONFIG, fetchImpl: fixture.fetchImpl });
  assert.equal(context.ok, true);
  assert.deepEqual(
    access.parseAuthorizedStorageReference(context, "voucher:voucher-1:file"),
    { bucket: "travel-assets", path: `${USER_A}/trips/${TRIP_A}/${MEDIA}` }
  );
  assert.equal(fixture.calls.length, 3);
});

test("invalid and expired share tokens are denied", async () => {
  assert.equal((await access.loadShareContext("invalid", { config: CONFIG })).error, "invalid_or_expired");
  const fixture = createContext({ expiresAt: "2020-01-01T00:00:00.000Z" });
  const expired = await access.loadShareContext(TOKEN, { config: CONFIG, fetchImpl: fixture.fetchImpl });
  assert.equal(expired.ok, false);
  assert.equal(expired.error, "invalid_or_expired");
});

test("Trip A token cannot retrieve Trip B media or an arbitrary path", async () => {
  const fixture = createContext({ fileTripId: TRIP_B });
  const context = await access.loadShareContext(TOKEN, { config: CONFIG, fetchImpl: fixture.fetchImpl });
  assert.equal(access.parseAuthorizedStorageReference(context, "voucher:voucher-1:file"), null);
  assert.equal(access.parseAuthorizedStorageReference(context, "../../arbitrary/object"), null);
  assert.equal(access.parseAuthorizedStorageReference(context, "voucher:missing:file"), null);
});

test("ticket media is denied when the ticket section is disabled", async () => {
  const fixture = createContext({ includeVouchers: false });
  const context = await access.loadShareContext(TOKEN, { config: CONFIG, fetchImpl: fixture.fetchImpl });
  assert.equal(access.parseAuthorizedStorageReference(context, "voucher:voucher-1:file"), null);
  assert.deepEqual(access.getSharedVouchers(context, TOKEN), []);
});

test("shared ticket content exposes safe fields and media capability, never raw Storage paths", async () => {
  const fixture = createContext();
  const context = await access.loadShareContext(TOKEN, { config: CONFIG, fetchImpl: fixture.fetchImpl });
  const vouchers = access.getSharedVouchers(context, TOKEN);
  assert.equal(vouchers[0].notes, "月台在二樓");
  assert.equal(vouchers[0].link, "https://example.com/ticket");
  assert.match(vouchers[0].fileUrl, /^\/api\/guest-share-media\?/);
  assert.doesNotMatch(JSON.stringify(vouchers), /storage:\/\//);
  assert.doesNotMatch(JSON.stringify(vouchers), /service-secret/);
});

test("legacy travel guide snapshots are exposed through the guarded guest media route", async () => {
  const fixture = createContext();
  const context = await access.loadShareContext(TOKEN, { config: CONFIG, fetchImpl: fixture.fetchImpl });
  const guides = access.getSharedGuides(context, TOKEN);
  assert.match(guides[0].coverUrl, /^\/api\/guest-share-media\?/);
  assert.doesNotMatch(JSON.stringify(guides), /guide-snapshots/u);
  assert.deepEqual(
    access.parseAuthorizedStorageReference(context, "guide:guide-1:cover"),
    {
      bucket: "travel-guide-assets",
      path: `${USER_A}/guide-snapshots/${TRIP_A}/${GUIDE_MEDIA}`
    }
  );
});

test("a shared trip cannot retrieve a legacy guide snapshot belonging to another trip", async () => {
  const fixture = createContext({ guideTripId: TRIP_B });
  const context = await access.loadShareContext(TOKEN, { config: CONFIG, fetchImpl: fixture.fetchImpl });
  assert.equal(access.parseAuthorizedStorageReference(context, "guide:guide-1:cover"), null);
});

test("media signing uses a short lifetime and keeps service credentials server-side", async () => {
  let request;
  const context = {
    config: CONFIG,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response({ signedURL: "/object/sign/travel-assets/signed-ticket?token=short" });
    }
  };
  const signedUrl = await access.createSignedMediaUrl(context, {
    bucket: "travel-assets",
    path: `${USER_A}/trips/${TRIP_A}/${MEDIA}`
  });
  assert.match(signedUrl, /signed-ticket\?token=short$/);
  assert.deepEqual(JSON.parse(request.options.body), { expiresIn: 60 });
  assert.equal(request.options.headers.Authorization, "Bearer service-secret");
  assert.doesNotMatch(signedUrl, /service-secret/);
});
