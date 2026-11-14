const CACHE = "my-jarvis-huawei-v1-1-tts-diagnostic-3";
const FILES = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest", "./icon.svg"];
self.addEventListener("install", event => {
 event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
 event.waitUntil(caches.keys().then(keys => Promise.all(
  keys.filter(key => key.startsWith("my-jarvis-huawei-") && key !== CACHE)
   .map(key => caches.delete(key))
 )).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
 const request = event.request;
 if(request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
 // Network first for immediate fixes; cached copy only if offline.
 event.respondWith(fetch(request).then(response => {
  if(response.ok) {
   const copy = response.clone();
   event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
  }
  return response;
 }).catch(async () => (await caches.match(request)) || Response.error()));
});