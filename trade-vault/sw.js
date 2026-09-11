const CACHE = 'trade-vault-shell-v19';
const SHELL = [
  './index.html',
  './styles.css?v=20260912.4',
  './app.js?v=20260912.4',
  './manifest.webmanifest?v=20260912.4',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('trade-vault-shell-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function cacheResponse(cacheKey, response) {
  if (response?.ok && response.type === 'basic') {
    await caches.open(CACHE).then(cache => cache.put(cacheKey, response.clone()));
  }
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  const scope = self.registration.scope;
  const indexUrl = new URL('./index.html', scope).href;

  // Network-first for documents prevents a stale index.html from loading a newer app.js.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        await cacheResponse(indexUrl, response);
        return response;
      } catch {
        const cached = await caches.match(indexUrl);
        if (cached) return cached;
        throw new Error('Offline and the app shell is not cached yet.');
      }
    })());
    return;
  }

  const shellUrls = new Set(SHELL.map(path => new URL(path, scope).href));
  if (!shellUrls.has(request.url)) return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    await cacheResponse(request, response);
    return response;
  })());
});
