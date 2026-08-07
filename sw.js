const CACHE_NAME = 'mardeofertas-v1';
const PRECACHE_URLS = [
  'index.html',
  'Mar de Ofertas - 2026-08.html',
  'assets/css/main.css',
  'assets/js/main.js',
  'manifest.webmanifest',
  'favicon.svg',
  'robots.txt'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // only handle GET
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // fallback: try cache first, then network
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(resp => {
      // cache same-origin GET responses for future
      if (resp && resp.ok && url.origin === location.origin) {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
      }
      return resp;
    }).catch(()=>{
      // network failed: try to serve the main HTML for navigation requests
      if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')){
        return caches.match('index.html') || caches.match('Mar de Ofertas - 2026-08.html');
      }
    }))
  );
});
