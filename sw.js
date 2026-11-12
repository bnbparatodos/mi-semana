const CACHE_NAME = 'mi-semana-static-v1';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', evt => {
  evt.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', evt => {
  evt.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', evt => {
  if (evt.request.method !== 'GET' || new URL(evt.request.url).origin !== self.location.origin) return;
  evt.respondWith(caches.match(evt.request).then(cached => cached || fetch(evt.request)));
});
