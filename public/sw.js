const CACHE_NAME = "stock-sales-v1";
const STATIC_ASSETS = [
  "/",
  "/dashboard/pos",
  "/manifest.json",
  "/favicon.ico"
];

// Instalación del Service Worker: cachear activos estáticos iniciales
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Algunos recursos estáticos no pudieron ser cacheados inmediatamente:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activación: Limpieza de cachés antiguas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Estrategia de Fetch: Network-First con Fallback a Cache para navegación y estáticos
self.addEventListener("fetch", (event) => {
  // Ignorar peticiones que no sean GET o que pertenezcan a APIs externas/Supabase
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // No interceptar peticiones de Supabase o auth
  if (url.hostname.includes("supabase") || url.pathname.startsWith("/api/auth")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clonar y guardar en caché si la respuesta es válida
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        // Si falla la red, intentar devolver desde la caché
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Si es una navegación HTML, devolver la página cacheada del POS
        if (event.request.headers.get("accept")?.includes("text/html")) {
          const fallback = await caches.match("/dashboard/pos");
          if (fallback) return fallback;
        }

        return new Response("Sin conexión a internet", {
          status: 533,
          statusText: "Offline",
        });
      })
  );
});
