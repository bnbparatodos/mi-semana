const CACHE_NAME = 'mi-semana-static-v15';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-192.png?v=13', './icon-512.png?v=13'];
self.addEventListener('install', evt => {
  evt.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', evt => {
  evt.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mi-semana-static-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', evt => {
  if (evt.request.method !== 'GET' || new URL(evt.request.url).origin !== self.location.origin) return;
  // Prioriza el contenido actualizado cuando hay conexión; conserva uso sin conexión.
  evt.respondWith((async () => {
    try {
      const response = await fetch(evt.request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(evt.request, response.clone()).catch(() => {});
      }
      return response;
    } catch(err) {
      const cached = await caches.match(evt.request);
      if (cached) return cached;
      throw err;
    }
  })());
});
