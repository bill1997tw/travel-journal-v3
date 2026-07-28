import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const cloudSource = fs.readFileSync(new URL("../account-cloud.js", import.meta.url), "utf8");

test("all trip persistence routes through the cloud-aware helper", () => {
  assert.match(appSource, /function persistTrips\(\)/);
  assert.equal(
    appSource.match(/localStorage\.setItem\("voyage_trips", JSON\.stringify\(trips\)\);/g)?.length,
    1
  );
  assert.ok((appSource.match(/persistTrips\(\);/g)?.length || 0) > 30);
  assert.match(appSource, /scheduleTripSave\?\.\(cloudTripId\)/);
});

test("cloud autosave is debounced and owner-editor guarded", () => {
  assert.match(cloudSource, /function scheduleTripSave\(tripId\)/);
  assert.match(cloudSource, /window\.clearTimeout\(autoSaveTimer\)/);
  assert.match(cloudSource, /role !== "owner" && role !== "editor"/);
  assert.match(cloudSource, /saveImportedTrip\(targetTripId, \{ automatic: true \}\)/);
  assert.match(cloudSource, /scheduleTripSave,/);
});

test("cloud save mutes rehydration-triggered duplicate writes", () => {
  assert.match(cloudSource, /autoSaveMutedUntil = Date\.now\(\) \+ 3000/);
  assert.match(cloudSource, /Date\.now\(\) < autoSaveMutedUntil/);
});
