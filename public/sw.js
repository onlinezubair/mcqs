const CACHE_NAME = self.__CACHE_VERSION__ || 'mcq-projector-v1';
const BASE_PATH = self.__BASE_PATH__ || '';
const PRECACHE_MANIFEST = self.__PRECACHE_MANIFEST__ || [];
const HOME_URL = `${BASE_PATH}/index.html`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_MANIFEST))
  );
  // Take over as soon as the new build is installed so a fresh cache version
  // replaces the old one without waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== location.origin) return;
  if (request.method !== 'GET') return;

  const isHtmlRequest =
    request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');

  if (isHtmlRequest) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match(HOME_URL)) || (await caches.match(`${BASE_PATH}/`)) || Response.error();
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        fetch(request)
          .then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
            }
          })
          .catch(() => {});
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => new Response('Offline', { status: 503 }));
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
