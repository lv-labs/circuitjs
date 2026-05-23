const CACHE_NAME = 'circuitjs1-app-cache-v2';
const urlsToCache = [
  './about.html',
  './canvas2svg.js',
  './circuitjs.html',
  './crystal.html',
  './customfunction.html',
  './customlogic.html',
  './customtransformer.html',
  './diodecalc.html',
  './favicon.svg',
  './icon512.png',
  './icon128.png',
  './index.html',
  './iframe.html',
  './lz-string.min.js',
  './manifest.json',
  './mosfet-beta.html',
  './opampreal.html',
  './service-worker.js',
  './subcircuits.html',
  // put everything else here
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }

                return networkResponse;
            })
            .catch(() => caches.match(event.request))
    );
});


// Activate event: cleans up old caches
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];  // List of cache versions you want to keep

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName);  // Delete old caches that aren't in whitelist
                    }
                })
            );
        })
    );
    self.clients.claim();
});
