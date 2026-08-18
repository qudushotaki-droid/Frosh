// Asan Frosh service worker — makes the app installable and lets the
// shell open even with no signal. Data (Supabase) still needs a live
// connection; this only caches the app's own static files.
const CACHE_NAME = 'asanfrosh-shell-v1';
const PRECACHE_URLS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/icon-apple-touch.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return; // never intercept writes (e.g. Supabase POST/PATCH)
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return; // only handle our own files, not Supabase/CDN calls

  // Network-first for the app shell so users always get the latest deploy
  // when online; fall back to whatever was last cached when offline.
  event.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(()=>{});
        return res;
      })
      .catch(() => caches.match(req).then(cached => cached || caches.match('/')))
  );
});
