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
// Navigation and API requests pass through to network — Phase 13 adds offline handling
