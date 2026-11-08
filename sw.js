self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('eest2-cache-v1').then((cache) => {
      return cache.addAll(['./index.html', './styles.css', './core.js', './academico.js', './parte.js']);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});