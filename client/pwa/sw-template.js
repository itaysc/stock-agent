/* Bullwether's service worker. Built from pwa/sw-template.js (the build fills in
   the version and the app's files): the app opens instantly and offline, while
   prices, trades and logins always come live from the server. */
const VERSION = '__VERSION__';
const CACHE = `bullwether-${VERSION}`;
const PRECACHE = __PRECACHE__;
// Never from the cache: the API (live data, logins), the reports, the API docs.
const LIVE = /^\/(api|reports|docs|health)(\/|$)/;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  // A new version waits until the app asks for it ("Reload" on the update notice).
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith('bullwether-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || LIVE.test(url.pathname)) return;

  if (req.mode === 'navigate') {
    // The page: fresh when online, the saved one offline.
    event.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }
  // The app's files: their names change with every build, so a saved copy is always right.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && url.pathname.startsWith('/assets/')) {
            const copy = res.clone();
            void caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
