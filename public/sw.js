const CACHE = 'wayin-shell-v2';
const APP_SHELL = ['/', '/manifest.webmanifest', '/wayin-mark.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('wayin-shell-') && key !== CACHE).map((key) => caches.delete(key)),
  )));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  const cacheResponse = (response) => {
    if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
    return response;
  };

  if (request.mode === 'navigate' || !url.pathname.startsWith('/assets/')) {
    event.respondWith(fetch(request).then(cacheResponse).catch(async () => {
      return (await caches.match(request)) || caches.match('/');
    }));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then(cacheResponse)));
});
