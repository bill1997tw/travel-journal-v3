import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const htmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const publicExamples = `${appSource}\n${htmlSource}`;

test("public examples use fictional standardized traveler names", () => {
  assert.match(publicExamples, /小明/);
  assert.match(publicExamples, /小華/);
  assert.match(publicExamples, /小美/);
  assert.match(publicExamples, /companion: "小明、小華、小美共5人"/);
});

test("public example payment details are visibly fake", () => {
  assert.match(publicExamples, /範例銀行帳號：0000-000-000000/);
  assert.match(publicExamples, /範例 Line Pay 帳號/);
});
