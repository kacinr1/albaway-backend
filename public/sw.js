/* AlbaWay PWA — Service Worker v1 */
const CACHE = 'albaway-v1';
const SHELL = ['/app', '/manifest.json', '/logo.svg', '/favicon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Jamais de cache pour l'API, Stripe, Socket.io → toujours réseau
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/') || e.request.method !== 'GET') {
    return; // laisse passer au réseau
  }

  // Shell + assets : network-first, fallback cache (offline)
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then(m => m || caches.match('/app')))
  );
});
