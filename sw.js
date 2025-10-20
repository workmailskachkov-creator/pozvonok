const CACHE_NAME = 'pozvonok-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/client.js',
  '/2902e775-0845-4e87-8191-4849878d9cce.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

