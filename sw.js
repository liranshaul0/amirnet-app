/* AMIRNET ELITE service worker
 *
 * Network-first, cache as the offline fallback.
 *
 * The previous cache-first strategy meant a device kept showing the version it
 * had already stored and only picked up changes on the *next* visit, which made
 * shipped fixes look like they had not been applied. Freshness matters more here
 * than shaving a load, so the network is tried first and the cache answers only
 * when the network does not.
 */
const CACHE = 'amirnet-v9';
const PRECACHE = ['./', './index.html', './app.css', './manifest.webmanifest'];
const NET_TIMEOUT_MS = 4000;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .catch(() => null)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fromNetwork(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), NET_TIMEOUT_MS);
    fetch(request).then(resp => { clearTimeout(timer); resolve(resp); },
                        err => { clearTimeout(timer); reject(err); });
  });
}

self.addEventListener('fetch', e => {
  const request = e.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;   // fonts/CDN go straight to network
  if (url.pathname.startsWith('/api/')) return; // never cache AI responses

  e.respondWith(
    fromNetwork(request)
      .then(resp => {
        if (resp && resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(request, clone)).catch(() => {});
        }
        return resp;
      })
      .catch(() =>
        caches.match(request).then(cached =>
          cached || caches.match('./index.html') ||
          new Response('אין חיבור לרשת', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        )
      )
  );
});
