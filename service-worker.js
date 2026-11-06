const CACHE_NAME = "pesagem-gado-v193";

const urlsToCache = [
"./",
"index.html",
"style.css",
"app.js",
"db.js",
"manifest.json",
"manifest-admin.json",
"instalar.js",
"icon-admin-192.png",
"icon-admin-512.png",
"icon-admin-180.png",
"icon-192.png",
"icon-180.png",
"icon-512.png",
"lib/jspdf.umd.min.js",
"lib/xlsx.full.min.js",
"lib/zxing-browser.min.js"
];

self.addEventListener("install", event => {
self.skipWaiting();
event.waitUntil(
caches.open(CACHE_NAME)
.then(cache => {
// cache: "reload" = busca cada arquivo direto do servidor, sem usar a
// cópia que o navegador guarda (o GitHub deixa até 10 min). Sem isso, logo
// depois de uma atualização o app podia guardar o HTML novo junto com
// CSS/JS antigos -- tela desmontada e botões sumindo.
return cache.addAll(urlsToCache.map(url => new Request(url, { cache: "reload" })));
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
