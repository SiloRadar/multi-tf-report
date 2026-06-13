// Service worker per Diario Backwork — apertura offline (app tutta-in-uno).
// NON gestisce i dati: i trade restano nel localStorage del dispositivo.
const CACHE = 'backwork-v11';

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // solo stessa origine

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(resp => {
      if (resp && resp.status === 200 && resp.type === 'basic') {
        cache.put(req, resp.clone());
      }
      return resp;
    }).catch(() => null);
    // stale-while-revalidate: se ho la cache la servo subito (e aggiorno dietro le quinte)
    if (cached) { network; return cached; }
    const fresh = await network;
    if (fresh) return fresh;
    // fallback: per le navigazioni offline senza match diretto, servo qualunque HTML in cache
    if (req.mode === 'navigate') {
      const any = await cache.match('./', { ignoreSearch: true });
      if (any) return any;
      const all = await cache.keys();
      for (const k of all) {
        if (k.url.endsWith('.html') || k.url.endsWith('/')) {
          const r = await cache.match(k); if (r) return r;
        }
      }
    }
    return new Response('Offline e nessuna copia in cache. Apri l\'app una volta online.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
