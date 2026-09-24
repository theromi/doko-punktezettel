const CACHE = 'punktezettel-v4';
const CACHE_PREFIX = 'punktezettel-';
const MAX_RUNTIME_ENTRIES = 40;
// Deploy: any static host. HTTPS required for service worker (localhost exempt).
// Classic scripts (no ES modules) work over HTTP(S); file:// is unsupported for SW.
const ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/state.js',
  './js/storage.js',
  './js/ui.js',
  './js/graph.js',
  './manifest.webmanifest',
  './favicon.ico',
  './apple-touch-icon.png',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];


self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(ASSETS).catch(() =>
          // One 404 must not break offline install: best-effort per asset.
          Promise.allSettled(ASSETS.map((url) => cache.add(url)))
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function trimRuntimeCache() {
  return caches.open(CACHE).then((cache) =>
    cache.keys().then((keys) => {
      if (keys.length <= MAX_RUNTIME_ENTRIES) return;
      const excess = keys.slice(0, keys.length - MAX_RUNTIME_ENTRIES);
      return Promise.all(excess.map((req) => cache.delete(req)));
    })
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Only handle same-origin; let CDN/other origins pass through.
  let url = null;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches
              .open(CACHE)
              .then((cache) => cache.put(req, copy))
              .then(() => trimRuntimeCache());
          }
          return res;
        })
        .catch(() => {
          if (req.mode === 'navigate') return caches.match('./index.html', { ignoreSearch: true });
          return new Response('', { status: 404, statusText: 'Not Found' });
        });
    })
  );
});
