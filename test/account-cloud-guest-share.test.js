import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  copyGuestText,
  createGuestShareManager,
  getCompactExternalLinks,
  getGuestTripSignature,
  getGuestImagePresentation
} from "../account-cloud-share.js";

test("anonymous address copy uses the supplied clipboard and raw links become compact actions", async () => {
  let copied = "";
  assert.equal(await copyGuestText("宜蘭縣羅東鎮", {
    clipboard: { async writeText(value) { copied = value; } }
  }), true);
  assert.equal(copied, "宜蘭縣羅東鎮");
  assert.deepEqual(
    getCompactExternalLinks("行前閱讀 https://example.com/a/very/long/path 後再出發"),
    { text: "行前閱讀 後再出發", links: ["https://example.com/a/very/long/path"] }
  );
});

test("anonymous private media degrades without exposing its Storage path", () => {
  const privateReference = "storage://travel-assets/private-user/trips/private-trip/secret.jpg";
  const presentation = getGuestImagePresentation(privateReference);
  assert.deepEqual(presentation, { url: "", privateUnavailable: true });
  assert.equal(JSON.stringify(presentation).includes("private-user"), false);
});

test("anonymous legacy Base64 and public images remain renderable", () => {
  const base64 = "data:image/png;base64,iVBORw0KGgo=";
  assert.deepEqual(getGuestImagePresentation(base64), { url: base64, privateUnavailable: false });
  assert.equal(getGuestImagePresentation("https://example.com/photo.jpg").url, "https://example.com/photo.jpg");
});

test("guest renderer keeps fallback but can request controlled authorized media", () => {
  const source = fs.readFileSync(new URL("../account-cloud-share.js", import.meta.url), "utf8");
  assert.match(source, /私人圖片僅限登入成員查看/u);
  assert.match(source, /renderPrivateMediaFallback/);
  assert.match(source, /item\?\.coverUrl \|\| \(item\?\.kind === "image" \? item\?\.url : ""\)/);
  assert.match(source, /guestMediaUrl/);
  assert.doesNotMatch(source, /createSignedUrl|SUPABASE_SERVICE_ROLE_KEY/);
});

test("share manager uses only guarded RPCs", async () => {
  const calls = [];
  const client = {
    async rpc(name, payload) {
      calls.push({ name, payload });
      if (name === "create_guest_readonly_share") {
        return {
          data: {
            token: "a".repeat(64),
            include_alternatives: true,
            expires_at: null
          },
          error: null
        };
      }
      if (name === "get_guest_readonly_share_status") {
        return { data: { has_share: true, is_active: true }, error: null };
      }
      if (name === "get_trip_by_guest_readonly_token") {
        return { data: { ok: true, trip: { title: "小明的旅行" } }, error: null };
      }
      return { data: null, error: null };
    }
  };

  const manager = createGuestShareManager(client);
  const created = await manager.create("trip-1", {
    includeChecklists: true,
    includeBudget: true,
    includeLedger: true,
    includeVouchers: true,
    includeDiary: true
  });
  assert.equal(created.token, "a".repeat(64));
  await manager.status("trip-1");
  const read = await manager.read("b".repeat(64));
  assert.equal(read.trip.title, "小明的旅行");
  await manager.revoke("trip-1");

  assert.deepEqual(
    calls.map(call => call.name),
    [
      "create_guest_readonly_share",
      "get_guest_readonly_share_status",
      "get_trip_by_guest_readonly_token",
      "revoke_guest_readonly_share"
    ]
  );
  assert.deepEqual(calls[0].payload, {
    target_trip_id: "trip-1",
    share_expires_at: null,
    share_alternatives: true,
    share_checklists: true,
    share_budget: true,
    share_ledger: true,
    share_vouchers: true,
    share_diary: true
  });
});

test("invalid token never falls back to local trip data", async () => {
  let called = false;
  const manager = createGuestShareManager({
    async rpc() {
      called = true;
      return { data: null, error: null };
    }
  });
  const result = await manager.read("not-a-token");
  assert.deepEqual(result, { ok: false, error: "invalid_or_expired" });
  assert.equal(called, false);
});

test("network errors remain retryable instead of pretending the link expired", async () => {
  const manager = createGuestShareManager({
    async rpc() {
      return { data: null, error: new Error("network unavailable") };
    }
  });
  const result = await manager.read("c".repeat(64));
  assert.deepEqual(result, {
    ok: false,
    error: "temporarily_unavailable",
    retryable: true
  });
});

test("share link copying falls back to an explicitly selected URL", () => {
  const source = fs.readFileSync(
    new URL("../account-cloud-share.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /async function copyShareLink\(input\)/);
  assert.match(source, /navigator\.clipboard\?\.writeText/);
  assert.match(source, /selectShareLinkForManualCopy\(input\)/);
  assert.match(source, /input\.setSelectionRange\?\.\(0, input\.value\.length\)/);
  assert.match(source, /瀏覽器未允許自動複製/);
});

test("regenerating an active share warns that the previous URL will stop working", () => {
  const source = fs.readFileSync(
    new URL("../account-cloud-share.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /let hasActiveShare = false/);
  assert.match(source, /hasActiveShare = Boolean\(status\?\.is_active\)/);
  assert.match(source, /if \(hasActiveShare\)/);
  assert.match(source, /舊連結會立刻失效/);
  assert.match(source, /if \(!confirmed\) return/);
  assert.match(source, /hasActiveShare = true/);
  assert.match(source, /hasActiveShare = false/);
});

test("guest mode is a dedicated readonly page and exposes no local fallback", () => {
  const source = fs.readFileSync(
    new URL("../account-cloud-share.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /guest-readonly-active/);
  assert.match(source, /get_trip_by_guest_readonly_token/);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /demo token/i);
  assert.doesNotMatch(source, /Math\.random/);
});

test("guest links hide the private app before token validation finishes", () => {
  const source = fs.readFileSync(
    new URL("../account-cloud-share.js", import.meta.url),
    "utf8"
  );
  const readerStart = source.indexOf("async function initGuestReader");
  const firstRefresh = source.indexOf("await refresh(false)", readerStart);
  const privateShellGuard = source.indexOf(
    'document.body.classList.add("guest-readonly-active", "guest-readonly-loading")',
    readerStart
  );

  assert.ok(readerStart >= 0);
  assert.ok(privateShellGuard > readerStart);
  assert.ok(privateShellGuard < firstRefresh);

  const startFunction = source.indexOf("function start()");
  const startClientCreation = source.indexOf("const client = createClient()", startFunction);
  const startPrivacyGuard = source.indexOf(
    'document.body.classList.add("guest-readonly-active", "guest-readonly-loading")',
    startFunction
  );
  assert.ok(startPrivacyGuard > startFunction);
  assert.ok(startPrivacyGuard < startClientCreation);
});

test("expanded guest view renders sanitized optional sections", () => {
  const source = fs.readFileSync(
    new URL("../account-cloud-share.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /行李與待辦/);
  assert.match(source, /旅行預算摘要/);
  assert.match(source, /小二帳本/);
  assert.match(source, /票券與憑證摘要/);
  assert.match(source, /旅行攻略庫/);
  assert.match(source, /TRIP MEMORY/);
  assert.match(source, /trip\.diary\?\.status === "published"/);
  assert.match(source, /includedInStory !== false/);
  assert.match(source, /normalizeGuestImageUrl/);
  assert.match(source, /normalizePublicUrl/);
  assert.match(source, /guest-share-ticket-image/);
  assert.match(source, /開啟票券連結/);
  assert.doesNotMatch(source, /storage:\/\/travel-assets\//);
});

test("guest readers can refresh and receive visible-page updates", () => {
  const source = fs.readFileSync(
    new URL("../account-cloud-share.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /重新整理最新行程/);
  assert.match(source, /guest-share-refresh-status/);
  assert.match(source, /window\.setInterval\([\s\S]*60_000/);
  assert.match(source, /document\.visibilityState === "visible"/);
  assert.match(source, /window\.addEventListener\("online"/);
  assert.match(source, /getGuestTripSignature\(result\)/);
  assert.match(source, /nextSignature !== currentSignature/);
  assert.match(source, /if \(!shareAvailable\) return/);
  assert.match(source, /暫時無法更新，將保留目前內容/);
  assert.doesNotMatch(source, /window\.location\.reload/);
});

test("guest refresh detects itinerary and ledger changes independently", () => {
  const base = {
    revision: 3,
    trip: {
      itinerary: { days: [{ dayNum: 1, items: [] }] },
      ledger: { entries: [], settlements: [] }
    }
  };
  const itineraryChanged = structuredClone(base);
  itineraryChanged.revision = 4;
  itineraryChanged.trip.itinerary.days[0].items.push({ title: "小明的午餐" });
  const ledgerChanged = structuredClone(base);
  ledgerChanged.trip.ledger.entries.push({
    kind: "expense",
    title: "午餐",
    amount_minor: "10000",
    currency: "TWD"
  });

  assert.notEqual(getGuestTripSignature(base), getGuestTripSignature(itineraryChanged));
  assert.notEqual(getGuestTripSignature(base), getGuestTripSignature(ledgerChanged));
});

test("owners can see whether a share is active, expired, or not created", () => {
  const source = fs.readFileSync(
    new URL("../account-cloud-share.js", import.meta.url),
    "utf8"
  );
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const styles = fs.readFileSync(
    new URL("../cloud-sync.css", import.meta.url),
    "utf8"
  );

  assert.match(
    html,
    /id="share-owner-status" role="status" aria-live="polite"/
  );
  assert.match(source, /function formatOwnerShareStatus\(status\)/);
  assert.match(source, /目前連結有效，到期時間/);
  assert.match(source, /先前的分享連結已過期或停用/);
  assert.match(source, /尚未建立免登入分享連結/);
  assert.match(
    source,
    /generateButton\.textContent = hasActiveShare[\s\S]*重新產生分享連結/
  );
  assert.match(styles, /\.guest-share-owner-status\[data-tone="live"\]/);
});

test("owner share controls bind after delayed app or account initialization", () => {
  const source = fs.readFileSync(
    new URL("../account-cloud-share.js", import.meta.url),
    "utf8"
  );
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(source, /function tryStartOwnerShare\(\)/);
  assert.match(source, /voyage:app-ready/);
  assert.match(source, /voyage:entry-ready/);
  assert.match(source, /document\.readyState === "loading"/);
  assert.match(source, /shareHandlerBound === "true"/);
  assert.match(source, /shareButton\.dataset\.shareHandlerBound = "true"/);
  assert.match(html, /account-cloud-share\.js\?v=v15/);
});
