const CACHE_NAME = 'ALV-SPORT-LEAGUES-V1';
const assets = [
  '/',
  '/index.html',
  '/logoalvnegro.jpeg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});