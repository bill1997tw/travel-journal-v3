const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const accountCloudSource = fs.readFileSync(
  path.join(root, "account-cloud.js"),
  "utf8"
);
const htmlSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const cloudStyles = fs.readFileSync(path.join(root, "cloud-sync.css"), "utf8");

test("budget workspace exposes the bound trip ledger directly", () => {
  assert.match(
    htmlSource,
    /voyageAccountCloud\?\.openLedgerForLocalTrip\(activeTripId\)/
  );
  assert.match(htmlSource, />\s*查看小二帳本\s*</);
});

test("workspace ledger entry keeps cloud membership authorization", () => {
  assert.match(
    accountCloudSource,
    /if \(!state\.trips\.some\(\(trip\) => trip\.id === cloudTripId\)\)/
  );
  assert.match(
    accountCloudSource,
    /目前登入的帳號沒有這個旅程的查看權限/
  );
  assert.match(accountCloudSource, /openLedgerForLocalTrip,/);
});

test("budget split cards stay inside the workspace width", () => {
  assert.match(
    cloudStyles,
    /grid-template-columns:\s*minmax\(0,\s*1\.5fr\)\s+minmax\(0,\s*1fr\)\s*!important/
  );
  assert.match(
    cloudStyles,
    /#ws-panel-budget \.ledger-row-split-grid > \.glass[\s\S]*?min-width:\s*0/
  );
  assert.match(
    cloudStyles,
    /#ws-panel-budget \.ledger-row-split-grid \.table-container[\s\S]*?overflow-x:\s*auto/
  );
});
