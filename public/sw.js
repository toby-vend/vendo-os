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

// Phase 14: Push notification handler — display notification when a push event arrives
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/assets/icon-192.png',
      badge: '/assets/icon-192.png',
      data: { url: data.url },
    })
  );
});

// Phase 14: Notification click handler — navigate to task URL or open new window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/tasks';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If an existing window is open, navigate it and focus
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new window
      return clients.openWindow(url);
    })
  );
});
