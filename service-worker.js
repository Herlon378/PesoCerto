const CACHE_NAME = "pesagem-gado-v25";

const urlsToCache = [
"./",
"index.html",
"style.css",
"app.js",
"db.js",
"manifest.json",
"icon-192.png",
"icon-512.png",
"lib/jspdf.umd.min.js",
"lib/xlsx.full.min.js"
];

self.addEventListener("install", event => {
self.skipWaiting();
event.waitUntil(
caches.open(CACHE_NAME)
.then(cache => {
return cache.addAll(urlsToCache);
})
);
});

self.addEventListener("activate", event => {
event.waitUntil(
caches.keys().then(nomes =>
Promise.all(
nomes.filter(nome => nome !== CACHE_NAME)
.map(nome => caches.delete(nome))
)
).then(() => self.clients.claim())
);
});

self.addEventListener("fetch", event => {
event.respondWith(
caches.match(event.request)
.then(response => {
return response || fetch(event.request);
})
);
});