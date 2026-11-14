const CACHE="my-jarvis-huawei-v1-1-prod-1";
const FILES=["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("my-jarvis-huawei-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{const request=e.request;if(request.method!=="GET")return;if(new URL(request.url).origin!==self.location.origin)return;e.respondWith(caches.match(request).then(cached=>cached||fetch(request)))});
