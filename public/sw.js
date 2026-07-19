/* AlbaWay PWA — Service Worker v2 */
const CACHE = 'albaway-v2';
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
    return;
  }

  // JS/CSS/HTML critiques → toujours réseau, pas de fallback obsolète
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname === '/' || url.pathname === '/app') {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Autres assets (images, fonts) → network-first, fallback cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
