(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VoyageMedia = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const STORAGE_BUCKET = "travel-assets";
  const DEFAULT_MAX_BYTES = 12 * 1024 * 1024;
  const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const signedUrlCache = new Map();
  let clientProvider = () => null;

  function configure(options = {}) {
    if (typeof options.clientProvider === "function") clientProvider = options.clientProvider;
  }

  function safeWebUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function isLegacyImageReference(value) {
    const source = String(value || "").trim();
    return /^data:image\/(?:jpeg|png|webp);base64,/i.test(source) || Boolean(safeWebUrl(source));
  }

  function parseStorageReference(value) {
    const source = String(value || "").trim();
    if (!source.startsWith("storage://")) return null;
    const remainder = source.slice("storage://".length).replace(/^\/+/, "");
    if (!remainder) return null;
    if (remainder.startsWith(`${STORAGE_BUCKET}/`)) {
      return { bucket: STORAGE_BUCKET, path: remainder.slice(STORAGE_BUCKET.length + 1) };
    }
    // Backward compatible with existing favorite references: storage://user/path.
    return { bucket: STORAGE_BUCKET, path: remainder };
  }

  function normalizeMediaReference(value) {
    const source = String(value || "").trim();
    if (!source) return "";
    if (parseStorageReference(source) || isLegacyImageReference(source)) return source;
    return "";
  }

  function replaceMediaReference(currentReference, nextReference) {
    const next = normalizeMediaReference(nextReference);
    return next || normalizeMediaReference(currentReference);
  }

  function removeMediaReference() {
    return "";
  }

  function storageReference(bucket, path) {
    const cleanBucket = String(bucket || "").trim();
    const cleanPath = String(path || "").replace(/^\/+/, "").trim();
    if (!cleanBucket || !cleanPath) throw new TypeError("media_storage_reference_invalid");
    return `storage://${cleanBucket}/${cleanPath}`;
  }

  function sniffImageMime(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
    if (data.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => data[index] === value)) return "image/png";
    if (data.length >= 12
      && String.fromCharCode(...data.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...data.slice(8, 12)) === "WEBP") return "image/webp";
    return "";
  }

  async function validateImageBlob(blob, options = {}) {
    if (!blob || typeof blob.arrayBuffer !== "function") throw new TypeError("media_file_required");
    const maxBytes = Number(options.maxBytes) || DEFAULT_MAX_BYTES;
    if (blob.size <= 0) throw new Error("圖片內容是空的。");
    if (blob.size > maxBytes) throw new Error(`圖片不可超過 ${Math.round(maxBytes / 1024 / 1024)} MB。`);
    const declaredMime = String(blob.type || "").toLowerCase();
    if (declaredMime && !ALLOWED_IMAGE_MIMES.has(declaredMime)) {
      throw new Error("僅支援 JPEG、PNG 或 WebP 圖片。");
    }
    const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const detectedMime = sniffImageMime(header);
    if (!detectedMime) throw new Error("檔案內容不是可辨識的 JPEG、PNG 或 WebP 圖片。");
    if (declaredMime && declaredMime !== detectedMime) throw new Error("圖片格式與檔案內容不一致。");
    return { mimeType: detectedMime, byteSize: blob.size };
  }

  function readBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("圖片讀取失敗。"));
      reader.readAsDataURL(blob);
    });
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("瀏覽器無法解碼這張圖片。"));
      image.src = source;
    });
  }

  async function prepareImageBlob(file, options = {}) {
    await validateImageBlob(file, options);
    const sourceUrl = await readBlobAsDataUrl(file);
    const image = await loadImage(sourceUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const maxDimension = Number(options.maxDimension) || 1800;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("瀏覽器無法處理圖片。");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const outputMime = options.outputMime === "image/png" ? "image/png" : "image/jpeg";
    const quality = Number(options.quality) || 0.82;
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error("圖片壓縮失敗。")), outputMime, quality);
    });
    return { blob, mimeType: outputMime, width: canvas.width, height: canvas.height };
  }

  function extensionForMime(mimeType) {
    return mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  }

  async function uploadTripImage(options) {
    const client = options.client;
    const userId = String(options.userId || "").trim();
    const cloudTripId = String(options.cloudTripId || "").trim();
    if (!client || !userId || !cloudTripId) throw new Error("media_cloud_context_required");
    const mediaId = globalThis.crypto?.randomUUID?.();
    if (!mediaId) throw new Error("media_uuid_unavailable");
    const extension = extensionForMime(options.mimeType);
    const path = `${userId}/trips/${cloudTripId}/${mediaId}.${extension}`;
    const { error } = await client.storage.from(STORAGE_BUCKET).upload(path, options.blob, {
      contentType: options.mimeType,
      cacheControl: "31536000",
      upsert: false
    });
    if (error) throw error;
    return storageReference(STORAGE_BUCKET, path);
  }

  async function processImageFile(file, options = {}) {
    const prepared = await prepareImageBlob(file, options);
    let reference;
    let storagePath = "";
    if (options.client && options.userId && options.cloudTripId) {
      reference = await uploadTripImage({ ...options, ...prepared });
      storagePath = parseStorageReference(reference)?.path || "";
    } else {
      reference = await readBlobAsDataUrl(prepared.blob);
    }
    return { ...prepared, reference, storagePath, sourceType: options.sourceType || "file" };
  }

  async function importImageUrl(url, options = {}) {
    const normalized = safeWebUrl(url);
    if (!normalized) throw new Error("請輸入有效的 http 或 https 圖片網址。");
    const accessToken = String(options.accessToken || "").trim();
    if (!accessToken) throw new Error("請先登入雲端帳號再匯入圖片網址。");
    const response = await fetch(options.endpoint || "/api/import-image-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ url: normalized })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.message || payload?.error || "圖片網址匯入失敗。");
    }
    const blob = await response.blob();
    return processImageFile(blob, { ...options, sourceType: "url" });
  }

  async function fetchImageUrlBlob(url, options = {}) {
    const normalized = safeWebUrl(url);
    if (!normalized) throw new Error("請輸入有效的 http 或 https 圖片網址。");
    const accessToken = String(options.accessToken || "").trim();
    if (!accessToken) throw new Error("請先登入雲端帳號再匯入網址圖片。");
    const response = await fetch(options.endpoint || "/api/import-image-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ url: normalized })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.message || payload?.error || "圖片網址匯入失敗。");
    }
    const blob = await response.blob();
    await validateImageBlob(blob, options);
    return blob;
  }

  function isTextEditingTarget(target) {
    return Boolean(target?.closest?.("input, textarea, [contenteditable='true']"));
  }

  function clipboardImageFile(event) {
    if (isTextEditingTarget(event.target)) return null;
    const item = [...(event.clipboardData?.items || [])].find(candidate => candidate.kind === "file" && candidate.type.startsWith("image/"));
    return item?.getAsFile?.() || null;
  }

  function createAuxiliaryControls(zone, options, acceptFile) {
    if (!zone || zone.querySelector(".media-input-tools")) return;
    const tools = document.createElement("div");
    tools.className = "media-input-tools";
    tools.innerHTML = `
      <button type="button" class="media-camera-button">拍照</button>
      ${options.urlImport === false ? "" : `<details class="media-url-import">
        <summary>圖片網址</summary>
        <div><input type="url" inputmode="url" placeholder="https://.../photo.jpg"><button type="button">匯入</button></div>
      </details>`}
    `;
    const cameraInput = document.createElement("input");
    cameraInput.type = "file";
    cameraInput.accept = "image/*";
    cameraInput.setAttribute("capture", "environment");
    cameraInput.hidden = true;
    tools.append(cameraInput);
    zone.append(tools);
    tools.addEventListener("click", event => event.stopPropagation());
    tools.querySelector(".media-camera-button").addEventListener("click", () => cameraInput.click());
    cameraInput.addEventListener("change", () => {
      const file = cameraInput.files?.[0];
      if (file) acceptFile(file, "camera");
      cameraInput.value = "";
    });
    const urlInput = tools.querySelector("input[type='url']");
    tools.querySelector(".media-url-import button")?.addEventListener("click", () => {
      const value = urlInput.value.trim();
      if (value) options.onUrl?.(value);
    });
  }

  function bindMediaInput(options = {}) {
    const zone = options.zone;
    const fileInput = options.fileInput;
    if (!zone || !fileInput) return () => {};
    if (!zone.hasAttribute("tabindex")) zone.tabIndex = 0;
    const acceptFile = (file, sourceType) => options.onFile?.(file, sourceType);
    const onPaste = event => {
      const file = clipboardImageFile(event);
      if (!file) return;
      event.preventDefault();
      acceptFile(file, "clipboard");
    };
    const onDragOver = event => {
      event.preventDefault();
      zone.classList.add("is-dragging", "dragover");
    };
    const onDragLeave = () => zone.classList.remove("is-dragging", "dragover");
    const onDrop = event => {
      event.preventDefault();
      onDragLeave();
      const file = event.dataTransfer?.files?.[0];
      if (file) acceptFile(file, "drop");
    };
    zone.addEventListener("paste", onPaste);
    if (options.dragDrop !== false) {
      zone.addEventListener("dragover", onDragOver);
      zone.addEventListener("dragleave", onDragLeave);
      zone.addEventListener("drop", onDrop);
    }
    if (options.auxiliaryControls !== false) createAuxiliaryControls(zone, options, acceptFile);
    return () => {
      zone.removeEventListener("paste", onPaste);
      if (options.dragDrop !== false) {
        zone.removeEventListener("dragover", onDragOver);
        zone.removeEventListener("dragleave", onDragLeave);
        zone.removeEventListener("drop", onDrop);
      }
    };
  }

  async function resolveMediaReference(reference, client = clientProvider()) {
    const parsed = parseStorageReference(reference);
    if (!parsed) return normalizeMediaReference(reference);
    const cacheKey = `${parsed.bucket}:${parsed.path}`;
    const cached = signedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
    if (!client) return "";
    const { data, error } = await client.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 60);
    if (error || !data?.signedUrl) return "";
    signedUrlCache.set(cacheKey, { url: data.signedUrl, expiresAt: Date.now() + 55 * 60 * 1000 });
    return data.signedUrl;
  }

  async function resolveElement(element) {
    if (!element || element.dataset.mediaResolving === "true") return;
    const reference = element.getAttribute("src") || element.dataset.mediaRef || element.dataset.mediaBackgroundRef || "";
    if (!parseStorageReference(reference)) return;
    element.dataset.mediaResolving = "true";
    const resolved = await resolveMediaReference(reference);
    if (resolved) {
      if (element.tagName === "IMG") element.src = resolved;
      else element.style.backgroundImage = `url("${resolved.replace(/"/g, "%22")}")`;
    }
    delete element.dataset.mediaResolving;
  }

  function resolveMediaElements(root = document) {
    const elements = [];
    if (root?.matches?.("img[src^='storage://'], [data-media-ref], [data-media-background-ref]")) elements.push(root);
    elements.push(...(root?.querySelectorAll?.("img[src^='storage://'], [data-media-ref], [data-media-background-ref]") || []));
    elements.forEach(element => resolveElement(element));
  }

  function installReferenceObserver() {
    if (typeof document === "undefined" || document.documentElement.dataset.mediaObserver === "true") return;
    document.documentElement.dataset.mediaObserver = "true";
    resolveMediaElements(document);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        record.addedNodes.forEach(node => node.nodeType === 1 && resolveMediaElements(node));
        if (record.type === "attributes") resolveElement(record.target);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "data-media-ref", "data-media-background-ref"] });
  }

  return {
    STORAGE_BUCKET,
    DEFAULT_MAX_BYTES,
    configure,
    safeWebUrl,
    isLegacyImageReference,
    parseStorageReference,
    normalizeMediaReference,
    replaceMediaReference,
    removeMediaReference,
    storageReference,
    sniffImageMime,
    validateImageBlob,
    prepareImageBlob,
    processImageFile,
    importImageUrl,
    fetchImageUrlBlob,
    clipboardImageFile,
    bindMediaInput,
    resolveMediaReference,
    resolveMediaElements,
    installReferenceObserver
  };
});
