// Service Worker sin caché: mantiene la app instalable (PWA) y descarga siempre la versión más reciente
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('script.google.com')) {
    return;
  }
  e.respondWith(fetch(e.request, { cache: 'no-store' }));
});
