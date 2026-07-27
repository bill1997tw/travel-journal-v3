import test from "node:test";
import assert from "node:assert/strict";
import { generateRandomShareToken, createGuestShareManager } from "../account-cloud-share.js";

test("generateRandomShareToken returns 64 hex characters (256 bits)", () => {
  const token = generateRandomShareToken();
  assert.equal(typeof token, "string");
  assert.equal(token.length, 64);
  assert.match(token, /^[0-9a-f]{64}$/);
});

test("Guest share manager correctly interfaces with RPCs and enforces scopes", async () => {
  const activeShares = new Map();

  const mockSupabase = {
    async rpc(fnName, args) {
      if (fnName === "create_guest_share") {
        activeShares.set(args.p_trip_id, {
          tripId: args.p_trip_id,
          scopes: args.p_scopes,
          expiresAt: args.p_expires_at,
          rawToken: args.p_raw_token,
          revokedAt: null
        });
        return {
          data: {
            success: true,
            trip_id: args.p_trip_id,
            scopes: args.p_scopes
          },
          error: null
        };
      }

      if (fnName === "get_guest_share_status") {
        const share = activeShares.get(args.p_trip_id);
        if (!share || share.revokedAt) {
          return { data: { has_share: false, is_active: false }, error: null };
        }
        return {
          data: {
            has_share: true,
            is_active: true,
            scopes: share.scopes
          },
          error: null
        };
      }

      if (fnName === "revoke_guest_share") {
        const share = activeShares.get(args.p_trip_id);
        if (share) {
          share.revokedAt = new Date().toISOString();
        }
        return { data: { success: true }, error: null };
      }

      if (fnName === "get_trip_by_guest_token") {
        let matched = null;
        for (const s of activeShares.values()) {
          if (s.rawToken === args.p_raw_token && !s.revokedAt) {
            matched = s;
            break;
          }
        }
        if (!matched) {
          return {
            data: {
              success: false,
              error: "invalid_or_expired",
              message: "這份旅程邀請已失效，請向旅程建立者索取新連結。"
            },
            error: null
          };
        }

        const rawDoc = {
          title: "嘉義阿里山之行",
          privateNotes: "這是絕對私密的備註",
          bankAccount: "1234-5678-9012",
          qrCode: "data:image/png;base64,SECRET",
          barcode: "BARCODE_123456",
          itinerary: { days: [{ title: "DAY 1 奮起湖" }] },
          alternativeSpots: { sights: [{ name: "二延平步道" }] },
          budget: { total: 15000 },
          tickets: [{ title: "高鐵票" }]
        };

        const doc = { ...rawDoc };
        delete doc.privateNotes;
        delete doc.bankAccount;
        delete doc.qrCode;
        delete doc.barcode;

        if (!matched.scopes.itinerary) doc.itinerary = { days: [] };
        if (!matched.scopes.alternatives) doc.alternativeSpots = { sights: [], restaurants: [] };
        if (!matched.scopes.budget) delete doc.budget;
        if (!matched.scopes.tickets) delete doc.tickets;

        return {
          data: {
            success: true,
            trip_id: matched.tripId,
            title: "嘉義阿里山之行",
            scopes: matched.scopes,
            document: doc
          },
          error: null
        };
      }

      return { data: null, error: null };
    }
  };

  const manager = createGuestShareManager({ supabaseClient: mockSupabase });

  // 1. Owner 建立分享連結
  const createRes = await manager.createOrRegenerateShare(
    "trip-001",
    { itinerary: true, alternatives: true, budget: false, ledger: false, tickets: false },
    7
  );
  assert.equal(createRes.success, true);
  assert.equal(typeof createRes.rawToken, "string");

  const token1 = createRes.rawToken;

  // 2. 未登入訪客用 token 讀取
  const guestRes = await manager.fetchTripByToken(token1);
  assert.equal(guestRes.success, true);
  assert.equal(guestRes.title, "嘉義阿里山之行");
  assert.equal(guestRes.document.privateNotes, undefined, "Sensitive privateNotes must be removed");
  assert.equal(guestRes.document.bankAccount, undefined, "Sensitive bankAccount must be removed");
  assert.equal(guestRes.document.budget, undefined, "Budget must be excluded when scope=false");

  // 3. 重新產生分享，舊 token 必須失效
  const regenRes = await manager.createOrRegenerateShare(
    "trip-001",
    { itinerary: true, alternatives: true, budget: true, ledger: false, tickets: false },
    3
  );
  const token2 = regenRes.rawToken;
  assert.notEqual(token1, token2);

  const oldTokenFetch = await manager.fetchTripByToken(token1);
  assert.equal(oldTokenFetch.success, false);
  assert.equal(oldTokenFetch.error, "invalid_or_expired");

  const newTokenFetch = await manager.fetchTripByToken(token2);
  assert.equal(newTokenFetch.success, true);
  assert.equal(newTokenFetch.document.budget !== undefined, true, "Budget should be included when scope=true");

  // 4. 停用分享
  await manager.revokeShare("trip-001");
  const revokedFetch = await manager.fetchTripByToken(token2);
  assert.equal(revokedFetch.success, false);
  assert.equal(revokedFetch.error, "invalid_or_expired");
});
