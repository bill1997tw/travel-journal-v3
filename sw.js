const CACHE_NAME = "voyage-book-shell-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./index.css",
  "./cloud-sync.css",
  "./app.js",
  "./cloud-sync.js",
  "./supabase-config.js",
  "./manifest.webmanifest",
  "./assets/app-icon.svg",
  "./assets/kyoto_street.png",
  "./assets/paris_cafe.png",
  "./assets/swiss_alps.png"
];

const NETWORK_FIRST_EXTENSIONS = new Set([
  ".html",
  ".css",
  ".js",
  ".json",
  ".webmanifest"
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const pathname = requestUrl.pathname || "";
  const extensionMatch = pathname.match(/\.[a-z0-9]+$/i);
  const extension = extensionMatch ? extensionMatch[0].toLowerCase() : "";
  const isNavigationRequest = event.request.mode === "navigate";
  const shouldUseNetworkFirst = isNavigationRequest || NETWORK_FIRST_EXTENSIONS.has(extension);

  if (shouldUseNetworkFirst) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          return cachedResponse || caches.match("./index.html");
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
