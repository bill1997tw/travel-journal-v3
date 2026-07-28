import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createGuestShareManager } from "../account-cloud-share.js";

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
  const created = await manager.create("trip-1");
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
