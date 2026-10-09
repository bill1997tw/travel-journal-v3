const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const time = require("../itinerary-time.js");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "index.css"), "utf8");
const swSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");

test("legacy itinerary times remain compatible and default to estimated", () => {
  assert.deepEqual(time.parseTimeRange("09:00 - 11:30"), { start: "09:00", end: "11:30" });
  assert.equal(time.inferTimeType({ time: "09:00 - 11:30" }), "estimated");
  assert.equal(time.inferTimeType({ time: "", timeType: "unset" }), "unset");
  assert.equal(time.inferTimeType({ time: "07:43", timeType: "fixed" }), "fixed");
});

test("time range builder accepts unset and rejects an invalid range", () => {
  assert.equal(time.buildTimeValue("09:00", "10:30"), "09:00 - 10:30");
  assert.equal(time.buildTimeValue("09:00", ""), "09:00");
  assert.equal(time.buildTimeValue("", ""), "");
  assert.equal(time.buildTimeValue("11:00", "10:30"), null);
});

test("reordered itinerary detects chronological conflicts without counting unset items", () => {
  const items = [
    { id: "late", time: "18:00", timeType: "fixed" },
    { id: "flex", time: "", timeType: "unset" },
    { id: "early", time: "12:00", timeType: "estimated" }
  ];
  assert.deepEqual(time.detectConflicts(items), [{
    previousId: "late",
    currentId: "early",
    previousIndex: 0,
    currentIndex: 2
  }]);
});

test("automatic adjustment reorders by start time without rewriting fixed times", () => {
  const fixed = { id: "train", time: "18:00", timeType: "fixed" };
  const unset = { id: "walk", time: "", timeType: "unset" };
  const result = time.sortItemsChronologically([
    fixed,
    unset,
    { id: "lunch", time: "12:00 - 13:00", timeType: "estimated" }
  ]);
  assert.deepEqual(result.map(item => item.id), ["lunch", "train", "walk"]);
  assert.equal(fixed.time, "18:00");
  assert.equal(fixed.timeType, "fixed");
});

test("timeline exposes inline time editing and explicit conflict actions", () => {
  assert.match(appSource, /openInlineScheduleTimeEditor/);
  assert.match(appSource, /openOverviewScheduleTimeEditor/);
  assert.match(appSource, /saveInlineScheduleTime/);
  assert.match(appSource, /時間順序有衝突/);
  assert.match(appSource, /autoSortItineraryByTime/);
  assert.match(appSource, /keepItineraryTimeOrder/);
  assert.match(appSource, /item\.timeType = timeType;\s*persistTrips\(\)/);
});

test("schedule editor supports fixed estimated and unset time types", () => {
  assert.match(appSource, /id="s-time-type"/);
  assert.match(appSource, /value="estimated"/);
  assert.match(appSource, /value="fixed"/);
  assert.match(appSource, /value="unset"/);
  assert.match(htmlSource, /itinerary-time\.js\?v=v1/);
});

test("mobile inline time editor uses native controls without iOS focus zoom", () => {
  assert.match(cssSource, /\.inline-time-editor[\s\S]*position:\s*fixed/);
  assert.match(cssSource, /\.inline-time-editor-fields \.form-input,[\s\S]*font-size:\s*16px/);
  assert.match(appSource, /type="time" data-inline-time-start/);
  assert.match(swSource, /voyage-book-shell-v89/);
  assert.match(swSource, /itinerary-time\.js\?v=v1/);
});
