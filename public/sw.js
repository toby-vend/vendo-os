importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.4.0/workbox-sw.js');

workbox.core.skipWaiting();
workbox.core.clientsClaim();

// Static assets — CacheFirst with 30-day expiry
workbox.routing.registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font',
  new workbox.strategies.CacheFirst({
    cacheName: 'vendo-static-v1',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
);
// Phase 13: Precache offline fallback files at install time
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('vendo-precache-v1').then((cache) =>
      cache.addAll(['/offline.html', '/offline-partial.html'])
    )
  );
});

// Phase 13: Full-page navigation — NetworkFirst with offline.html fallback
const pageStrategy = new workbox.strategies.NetworkFirst({
  cacheName: 'vendo-pages-v1',
  plugins: [
    new workbox.expiration.ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 7 * 24 * 60 * 60,
    }),
  ],
});

workbox.routing.registerRoute(
  ({ request }) =>
    request.mode === 'navigate' &&
    request.headers.get('HX-Request') !== 'true',
  async ({ request }) => {
    try {
      return await pageStrategy.handle({ request });
    } catch {
      return caches.match('/offline.html');
    }
  }
);

// Phase 13: HTMX partial requests — NetworkFirst with offline-partial.html fallback
const partialStrategy = new workbox.strategies.NetworkFirst({
  cacheName: 'vendo-partials-v1',
  plugins: [
    new workbox.expiration.ExpirationPlugin({
      maxEntries: 100,
      maxAgeSeconds: 24 * 60 * 60,
    }),
  ],
});

workbox.routing.registerRoute(
  ({ request }) =>
    request.method === 'GET' &&
    request.headers.get('HX-Request') === 'true',
  async ({ request }) => {
    try {
      return await partialStrategy.handle({ request });
    } catch {
      return caches.match('/offline-partial.html');
    }
  }
);
