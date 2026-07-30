import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [entry, accountCloud, share] = await Promise.all([
  readFile(new URL("../app-entry.js", import.meta.url), "utf8"),
  readFile(new URL("../account-cloud.js", import.meta.url), "utf8"),
  readFile(new URL("../account-cloud-share.js", import.meta.url), "utf8"),
]);

test("entry authentication owns one shared Supabase client", () => {
  assert.match(entry, /window\.getVoyageSupabaseClient = \(\) => sharedClient/u);
  assert.match(entry, /storage:\s*authStorage/u);
});

test("account cloud and guest sharing reuse the entry client", () => {
  assert.match(
    accountCloud,
    /state\.client = window\.getVoyageSupabaseClient\?\.\(\) \|\| null/u
  );
  assert.match(
    share,
    /return window\.getVoyageSupabaseClient\?\.\(\) \|\| null/u
  );
  assert.doesNotMatch(accountCloud, /window\.supabase\.createClient/u);
  assert.doesNotMatch(share, /window\.supabase\.createClient/u);
});
