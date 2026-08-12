const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const media = require("../media-uploader.js");
const root = path.join(__dirname, "..");

function imageBlob(type = "image/png") {
  const signatures = {
    "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    "image/jpeg": [0xff, 0xd8, 0xff, 0xdb],
    "image/webp": [...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]
  };
  return new Blob([new Uint8Array(signatures[type])], { type });
}

function eventTarget() {
  const handlers = new Map();
  return {
    handlers,
    tabIndex: -1,
    classList: { add() {}, remove() {} },
    hasAttribute() { return false; },
    querySelector() { return null; },
    addEventListener(name, handler) { handlers.set(name, handler); },
    removeEventListener(name) { handlers.delete(name); }
  };
}

test("existing Base64 image remains a valid media reference", () => {
  const value = "data:image/png;base64,iVBORw0KGgo=";
  assert.equal(media.normalizeMediaReference(value), value);
});

test("existing external image URL remains readable", () => {
  const value = "https://example.com/photo.jpg";
  assert.equal(media.normalizeMediaReference(value), value);
});

test("new and legacy Storage references remain readable", () => {
  assert.deepEqual(media.parseStorageReference("storage://travel-assets/u/trips/t/a.jpg"), {
    bucket: "travel-assets", path: "u/trips/t/a.jpg"
  });
  assert.equal(media.parseStorageReference("storage://u/favorites/a.jpg").path, "u/favorites/a.jpg");
});

test("actual PNG, JPEG and WebP signatures are accepted", async () => {
  for (const type of ["image/png", "image/jpeg", "image/webp"]) {
    assert.equal((await media.validateImageBlob(imageBlob(type))).mimeType, type);
  }
});

test("unsupported declared MIME is rejected", async () => {
  await assert.rejects(media.validateImageBlob(new Blob(["hello"], { type: "image/gif" })));
});

test("declared MIME must match actual bytes", async () => {
  const jpegBytes = await imageBlob("image/jpeg").arrayBuffer();
  await assert.rejects(media.validateImageBlob(new Blob([jpegBytes], { type: "image/png" })));
});

test("oversized local image is rejected", async () => {
  await assert.rejects(media.validateImageBlob(imageBlob(), { maxBytes: 2 }));
});

test("drag and drop routes a file through one shared callback", () => {
  const zone = eventTarget();
  const file = imageBlob();
  let received;
  media.bindMediaInput({ zone, fileInput: {}, auxiliaryControls: false, onFile: (value, source) => { received = [value, source]; } });
  zone.handlers.get("drop")({ preventDefault() {}, dataTransfer: { files: [file] } });
  assert.deepEqual(received, [file, "drop"]);
});

test("clipboard image and screenshot paste route through the shared callback", () => {
  const zone = eventTarget();
  const file = imageBlob();
  const received = [];
  media.bindMediaInput({ zone, fileInput: {}, auxiliaryControls: false, dragDrop: false, onFile: (_value, source) => received.push(source) });
  const paste = zone.handlers.get("paste");
  for (let index = 0; index < 2; index += 1) paste({
    target: { closest: () => null }, preventDefault() {},
    clipboardData: { items: [{ kind: "file", type: "image/png", getAsFile: () => file }] }
  });
  assert.deepEqual(received, ["clipboard", "clipboard"]);
});

test("text clipboard is ignored", () => {
  assert.equal(media.clipboardImageFile({
    target: { closest: () => null },
    clipboardData: { items: [{ kind: "string", type: "text/plain" }] }
  }), null);
});

test("paste inside text fields remains normal", () => {
  const file = imageBlob();
  assert.equal(media.clipboardImageFile({
    target: { closest: () => ({ tagName: "INPUT" }) },
    clipboardData: { items: [{ kind: "file", type: "image/png", getAsFile: () => file }] }
  }), null);
});

test("invalid or unsafe URL schemes are rejected client-side", () => {
  assert.equal(media.safeWebUrl("file:///etc/passwd"), "");
  assert.equal(media.safeWebUrl("javascript:alert(1)"), "");
});

test("failed replacement keeps the previous valid image reference", () => {
  const oldValue = "data:image/jpeg;base64,/9j/";
  assert.equal(media.replaceMediaReference(oldValue, "not-a-media-reference"), oldValue);
});

test("successful replacement and explicit removal are deterministic", () => {
  assert.equal(media.replaceMediaReference("https://old.test/a.jpg", "https://new.test/b.jpg"), "https://new.test/b.jpg");
  assert.equal(media.removeMediaReference("https://old.test/a.jpg"), "");
});

test("new media references survive JSON save/load without device-local identity", () => {
  const ref = "storage://travel-assets/user/trips/trip/media.jpg";
  const hydrated = JSON.parse(JSON.stringify({ image: ref }));
  assert.equal(hydrated.image, ref);
  assert.equal(media.normalizeMediaReference(hydrated.image), ref);
});

test("old Base64 data is not rewritten during JSON hydration", () => {
  const ref = "data:image/jpeg;base64,/9j/4AAQ";
  assert.equal(JSON.parse(JSON.stringify({ image: ref })).image, ref);
});

test("all six existing image entry points are wired to shared media support", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const favorites = fs.readFileSync(path.join(root, "account-favorites.js"), "utf8");
  for (const token of ["t-upload-zone", "ws-diary-upload-stage", "memory-moment-upload-stage", "v-upload-zone", "guide-cover-upload"]) {
    assert.match(app, new RegExp(token));
  }
  assert.match(favorites, /VoyageMedia\?\.bindMediaInput/);
  assert.match(favorites, /VoyageMedia\.prepareImageBlob/);
});

test("service worker caches the shared uploader and uses the new cache generation", () => {
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  assert.match(sw, /voyage-book-shell-v80/);
  assert.match(sw, /media-uploader\.js/);
});
