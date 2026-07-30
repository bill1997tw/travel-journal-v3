import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [bootstrap, config, accountCloud] = await Promise.all([
  readFile(new URL("../cloud-sync.js", import.meta.url), "utf8"),
  readFile(new URL("../supabase-config.js", import.meta.url), "utf8"),
  readFile(new URL("../account-cloud.js", import.meta.url), "utf8"),
]);

test("account lifecycle loads before the account cloud UI adapter", () => {
  assert.match(
    config,
    /accountLifecycleScript:\s*"account-lifecycle\.js\?v=account_lifecycle_v1"/u
  );
  assert.match(
    bootstrap,
    /lifecycleScript\.addEventListener\("load", loadAccountCloud/gu
  );
  assert.match(
    bootstrap,
    /ledgerScript\.addEventListener\("load", loadAccountLifecycle/gu
  );
});

test("account cloud exposes a guarded lifecycle service factory", () => {
  assert.match(accountCloud, /createLifecycleService:\s*\(\)\s*=>/u);
  assert.match(accountCloud, /window\.VoyageAccountLifecycle/u);
  assert.match(accountCloud, /if \(!lifecycleApi\?\.create \|\| !client\) return null/u);
  assert.match(accountCloud, /return lifecycleApi\.create\(client\)/u);
});
