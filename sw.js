const CACHE_NAME = "thegrid-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/firebase-setup.js",
  "./js/map-setup.js",
  "./js/utils.js",
  "./js/i18n.js",
  "./js/ui.js",
  "./src/view/login.html",
  "./src/view/login.js",
  "./sound.mp3",
];

self.addEventListener("install", (e) => {
  self.skipWaiting(); // Força a ativação imediata da nova versão
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Controla as páginas imediatamente
});

self.addEventListener("fetch", (e) => {
  // Estratégia Network-First: Tenta buscar na rede, se falhar, usa o cache.
  // Também atualiza o cache com a nova versão da rede a cada sucesso.
  if (e.request.method !== "GET") return;

  // Ignora requisições de extensões do Chrome
  if (!e.request.url.startsWith("http")) return;

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // Clona a resposta para salvar no cache
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseClone);
        });
        return networkResponse;
      })
      .catch(() => {
        // Se falhar (offline), retorna do cache
        return caches.match(e.request);
      })
  );
});
