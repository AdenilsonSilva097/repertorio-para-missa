const CACHE_NAME = "repertorio-missa-v2";
const STATIC_ASSETS = ["/", "/login"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET requests and browser extensions
  if (request.method !== "GET") return;
  if (request.url.startsWith("chrome-extension://")) return;

  // Network-first strategy for API routes and auth
  if (
    request.url.includes("/api/") ||
    request.url.includes("/auth/") ||
    request.url.includes("supabase")
  ) {
    return;
  }

  // Navegações (HTML): network-first. Garante que o usuário online sempre
  // receba a versão mais recente após um deploy (evita servir um shell antigo
  // que referencia chunks já removidos). Cai para o cache apenas offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(request)) || (await cache.match("/"));
        })
    );
    return;
  }

  // Demais GET (assets estáticos do Next, com hash imutável no nome):
  // stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
