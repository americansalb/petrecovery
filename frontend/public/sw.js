/**
 * Phase 8: Service Worker for Push Notifications
 *
 * Handles push notifications and offline caching.
 */

const CACHE_NAME = 'petrecovery-v1';
const OFFLINE_URL = '/offline.html';

// Files to cache for offline access
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

/**
 * Install event - cache core assets
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })()
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );

      // Take control of all clients immediately
      await self.clients.claim();
    })()
  );
});

/**
 * Fetch event - serve from cache with network fallback
 */
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API requests
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // Try network first
        const networkResponse = await fetch(event.request);

        // Cache successful responses
        if (networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }

        return networkResponse;
      } catch (error) {
        // Network failed, try cache
        const cachedResponse = await caches.match(event.request);

        if (cachedResponse) {
          return cachedResponse;
        }

        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }

        throw error;
      }
    })()
  );
});

/**
 * Push event - handle incoming push notifications
 */
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('Push event without data');
    return;
  }

  const data = event.data.json();

  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/badge-72x72.png',
    tag: data.tag || 'petrecovery-notification',
    renotify: data.renotify || false,
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    timestamp: data.timestamp || Date.now(),
    vibrate: data.vibrate || [200, 100, 200],
    data: {
      url: data.url || '/',
      missionId: data.missionId,
      type: data.type,
      ...data.data,
    },
    actions: data.actions || [],
  };

  // Handle different notification types
  if (data.type === 'SIGHTING_ALERT') {
    options.icon = '/icons/alert-icon.png';
    options.requireInteraction = true;
    options.actions = [
      { action: 'view', title: 'View Details' },
      { action: 'dismiss', title: 'Dismiss' },
    ];
  } else if (data.type === 'CASE_UPDATE') {
    options.actions = [
      { action: 'view', title: 'View Case' },
    ];
  } else if (data.type === 'MESSAGE') {
    options.actions = [
      { action: 'reply', title: 'Reply' },
      { action: 'view', title: 'View' },
    ];
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'PetRecovery', options)
  );
});

/**
 * Notification click event - handle user interaction
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;
  let url = data?.url || '/';

  // Handle action buttons
  if (event.action === 'view' && data?.missionId) {
    url = `/cases/${data.missionId}`;
  } else if (event.action === 'reply' && data?.conversationId) {
    url = `/messages/${data.conversationId}`;
  } else if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil(
    (async () => {
      // Try to focus existing window
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }

      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })()
  );
});

/**
 * Notification close event - track dismissals
 */
self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data;

  // Could send analytics about dismissed notifications
  if (data?.notificationId) {
    fetch('/api/push/dismissed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: data.notificationId }),
    }).catch(() => {});
  }
});

/**
 * Push subscription change event
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const newSubscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: self.VAPID_PUBLIC_KEY,
      });

      // Update subscription on server
      await fetch('/api/push/subscription', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldEndpoint: event.oldSubscription?.endpoint,
          newSubscription: newSubscription.toJSON(),
        }),
      });
    })()
  );
});

/**
 * Message event - handle messages from the main app
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'SET_VAPID_KEY') {
    self.VAPID_PUBLIC_KEY = event.data.key;
  }
});
