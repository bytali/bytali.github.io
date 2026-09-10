const CACHE = 'trade-vault-shell-v11';
const SHELL = [
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
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
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function fetchAndCache(request, cacheKey = request) {
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    const copy = response.clone();
    await caches.open(CACHE).then(cache => cache.put(cacheKey, copy));
  }
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  const scope = self.registration.scope;
  const indexUrl = new URL('./index.html', scope).href;
  const shellUrls = new Set(SHELL.map(path => new URL(path, scope).href));
  const isShell = shellUrls.has(request.url) || request.mode === 'navigate';
  if (!isShell) return;

  const cacheKey = request.mode === 'navigate' ? indexUrl : request;
  const networkUpdate = fetchAndCache(request, cacheKey).catch(() => null);
  event.waitUntil(networkUpdate);

  event.respondWith((async () => {
    const cached = await caches.match(cacheKey);
    if (cached) return cached;
    const response = await networkUpdate;
    if (response) return response;
    if (request.mode === 'navigate') {
      const fallback = await caches.match(indexUrl);
      if (fallback) return fallback;
    }
    throw new Error('Offline and resource is not cached.');
  })());
});
