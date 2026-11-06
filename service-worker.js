const CACHE_NAME = "pesagem-gado-v194";

const urlsToCache = [
"./",
"index.html",
"style.css",
"app.js",
"db.js",
"manifest.json",
"manifest-admin.json",
"instalar.js",
"avisos.js",
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

// ========================================
// AVISOS NO CELULAR (push)
// ========================================
// O servidor manda {titulo, corpo, tela, pagina, tag}; aqui vira a
// notificação do sistema. Tocar nela abre o app na tela certa (se já
// estiver aberto, só traz pra frente e troca de tela).
self.addEventListener("push", event => {
    let d = {};
    try { d = event.data ? event.data.json() : {}; }
    catch (e) { d = { titulo: "PesoCerto", corpo: event.data ? event.data.text() : "" }; }
    const doGerenciamento = d.pagina === "admin.html";
    event.waitUntil(self.registration.showNotification(d.titulo || "PesoCerto", {
        body: d.corpo || "",
        icon: doGerenciamento ? "icon-admin-192.png" : "icon-192.png",
        tag: d.tag || undefined,
        renotify: !!d.tag,
        vibrate: [120, 60, 120],
        data: d
    }));
});

self.addEventListener("notificationclick", event => {
    event.notification.close();
    const d = event.notification.data || {};
    const pagina = d.pagina || "index.html";
    const url = new URL(pagina + (d.tela ? "#aviso=" + d.tela : ""), self.registration.scope).href;
    const ehPagina = c => {
        const p = new URL(c.url).pathname;
        return pagina === "index.html" ? (p.endsWith("/index.html") || p.endsWith("/")) : p.endsWith("/" + pagina);
    };
    event.waitUntil((async () => {
        const abertos = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const aberto = abertos.find(ehPagina);
        if (aberto) {
            await aberto.focus();
            if (d.tela) aberto.postMessage({ tipo: "abrirTelaAviso", tela: d.tela });
            return;
        }
        await self.clients.openWindow(url);
    })());
});
