const test = require("node:test");
const assert = require("node:assert/strict");

const { _test: importer } = require("../api/import-image-url.js");

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

test("valid public image URL downloads an actual image", async () => {
  const result = await importer.downloadImage("https://example.com/photo.png", {
    lookup: publicLookup,
    request: async () => ({ statusCode: 200, headers: { "content-type": "image/png" }, body: PNG })
  });
  assert.equal(result.mimeType, "image/png");
  assert.deepEqual(result.buffer, PNG);
});

test("invalid URL is rejected", async () => {
  await assert.rejects(importer.downloadImage("not a url"), /invalid_url/);
});

test("localhost, loopback and private IPv4 are rejected", async () => {
  for (const url of ["http://localhost/a.png", "http://127.0.0.1/a.png", "http://10.0.0.1/a.png", "http://192.168.1.2/a.png"]) {
    await assert.rejects(importer.downloadImage(url), /private_network_rejected/);
  }
});

test("private and link-local IPv6 are rejected", () => {
  for (const address of ["::1", "fc00::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    assert.equal(importer.isPrivateIp(address), true);
  }
});

test("DNS answers are all checked before one address is pinned", async () => {
  await assert.rejects(importer.resolvePublicAddress("mixed.example", async () => [
    { address: "93.184.216.34", family: 4 },
    { address: "10.0.0.2", family: 4 }
  ]), /private_network_rejected/);
});

test("safe redirects are followed and each host is revalidated", async () => {
  const calls = [];
  const result = await importer.downloadImage("https://one.example/a", {
    lookup: async host => {
      calls.push(host);
      return [{ address: "93.184.216.34", family: 4 }];
    },
    request: async url => url.hostname === "one.example"
      ? { statusCode: 302, headers: { location: "https://two.example/b.png" }, body: Buffer.alloc(0) }
      : { statusCode: 200, headers: { "content-type": "image/png" }, body: PNG }
  });
  assert.equal(result.mimeType, "image/png");
  assert.deepEqual(calls, ["one.example", "two.example"]);
});

test("redirect to a private destination is rejected", async () => {
  await assert.rejects(importer.downloadImage("https://public.example/a", {
    lookup: publicLookup,
    request: async () => ({ statusCode: 302, headers: { location: "http://127.0.0.1/secret" }, body: Buffer.alloc(0) })
  }), /private_network_rejected/);
});

test("redirect count is bounded", async () => {
  await assert.rejects(importer.downloadImage("https://example.com/a", {
    maxRedirects: 1,
    lookup: publicLookup,
    request: async () => ({ statusCode: 302, headers: { location: "/again" }, body: Buffer.alloc(0) })
  }), /too_many_redirects/);
});

test("non-image response MIME is rejected", async () => {
  await assert.rejects(importer.downloadImage("https://example.com/a", {
    lookup: publicLookup,
    request: async () => ({ statusCode: 200, headers: { "content-type": "text/html" }, body: Buffer.from("<html>") })
  }), /unsupported_mime/);
});

test("declared image MIME must match actual image data", async () => {
  await assert.rejects(importer.downloadImage("https://example.com/a", {
    lookup: publicLookup,
    request: async () => ({ statusCode: 200, headers: { "content-type": "image/png" }, body: Buffer.from("not png") })
  }), /invalid_image_data/);
});

test("oversized URL download is rejected", async () => {
  await assert.rejects(importer.downloadImage("https://example.com/a", {
    maxBytes: 4,
    lookup: publicLookup,
    request: async () => ({ statusCode: 200, headers: { "content-type": "image/png" }, body: PNG })
  }), /download_too_large/);
});

test("credentials and non-http schemes are rejected", () => {
  assert.throws(() => importer.normalizeImportUrl("https://user:pass@example.com/a.png"), /invalid_url/);
  assert.throws(() => importer.normalizeImportUrl("file:///tmp/a.png"), /invalid_url/);
});
