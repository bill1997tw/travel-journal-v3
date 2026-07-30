import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cloudSource = fs.readFileSync(new URL("../account-cloud.js", import.meta.url), "utf8");

test("LINE pairing copy has a manual fallback for restricted mobile clipboards", () => {
  assert.match(cloudSource, /async function copyTextWithFallback\(text, fallbackElement\)/);
  assert.match(cloudSource, /navigator\.clipboard\?\.writeText/);
  assert.match(cloudSource, /function selectTextForManualCopy\(element\)/);
  assert.match(cloudSource, /range\.selectNodeContents\(element\)/);
  assert.match(cloudSource, /const command = `綁定旅程 \$\{state\.linePairingCode\}`/);
  assert.match(cloudSource, /const command = `連結成員 \$\{state\.lineMemberPairingCode\}`/);
  assert.match(cloudSource, /瀏覽器未允許自動複製，代碼已選取/);
});
