import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cloudSource = fs.readFileSync(new URL("../account-cloud.js", import.meta.url), "utf8");
const cloudStyles = fs.readFileSync(new URL("../cloud-sync.css", import.meta.url), "utf8");

test("only owners receive the registered traveler management entry", () => {
  assert.match(cloudSource, /role === "owner"[\s\S]*account-cloud-collaboration-open/);
  assert.match(cloudSource, /getRole\(trip\) !== "owner"/);
});

test("registered travelers are invited through the guarded email RPC", () => {
  assert.match(cloudSource, /\.rpc\("add_trip_member_by_email"/);
  assert.match(cloudSource, /target_trip_id: tripId/);
  assert.match(cloudSource, /member_email: email/);
  assert.match(cloudSource, /member_role: role/);
  assert.match(cloudSource, /member_account_not_found/);
});

test("owner identity cannot be edited or removed from the collaboration UI", () => {
  assert.match(cloudSource, /const isOwner = member\.role === "owner"/);
  assert.match(cloudSource, /member\.role === "owner"/);
  assert.match(cloudSource, /移除後對方將無法再看到這趟旅程/);
});

test("collaboration layout collapses safely on small screens", () => {
  assert.match(cloudStyles, /\.account-cloud-collaboration-form/);
  assert.match(cloudStyles, /@media \(max-width: 640px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
});
