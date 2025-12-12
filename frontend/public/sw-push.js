/**
 * Service Worker for Push Notifications
 *
 * Handles push notification events for Mission Control
 */

self.addEventListener('push', function(event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const { title, body, icon, badge, tag, data: notificationData } = data;

    const options = {
      body: body || 'New notification',
      icon: icon || '/icons/paw-192.png',
      badge: badge || '/icons/badge-72.png',
      tag: tag || 'petrecovery',
      renotify: true,
      vibrate: [200, 100, 200],
      data: notificationData || {},
      actions: getActionsForType(notificationData?.type),
      requireInteraction: notificationData?.urgent || false,
    };

    event.waitUntil(
      self.registration.showNotification(title || 'PetRecovery', options)
    );
  } catch (err) {
    console.error('Push notification error:', err);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/dashboard';

  // Determine URL based on notification type
  switch (data.type) {
    case 'SIGHTING':
      url = `/cases/${data.missionNumber}`;
      break;
    case 'MISSION_STARTED':
    case 'LIVE_SEARCH':
      url = `/cases/${data.missionNumber}`;
      break;
    case 'CONTAINMENT':
      url = `/cases/${data.missionNumber}`;
      break;
    case 'BROADCAST':
      url = `/cases/${data.missionNumber}`;
      break;
    case 'JOIN_REQUEST':
      url = `/join/${data.missionId}`;
      break;
    case 'SQUAD_ALERT':
      url = `/rescue-squads/${data.squadId}`;
      break;
    default:
      if (data.missionNumber) {
        url = `/cases/${data.missionNumber}`;
      }
  }

  // Handle action buttons
  if (event.action === 'join') {
    url = `/join/${data.missionId}`;
  } else if (event.action === 'view') {
    url = `/cases/${data.missionNumber}`;
  } else if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Try to focus existing window
        for (let client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

function getActionsForType(type) {
  switch (type) {
    case 'SIGHTING':
      return [
        { action: 'view', title: 'View Sighting', icon: '/icons/eye.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/x.png' },
      ];
    case 'MISSION_STARTED':
    case 'LIVE_SEARCH':
      return [
        { action: 'join', title: 'Join Search', icon: '/icons/join.png' },
        { action: 'view', title: 'View Details', icon: '/icons/eye.png' },
      ];
    case 'CONTAINMENT':
      return [
        { action: 'view', title: 'View Map', icon: '/icons/map.png' },
      ];
    default:
      return [
        { action: 'view', title: 'View', icon: '/icons/eye.png' },
      ];
  }
}

// Handle subscription changes
self.addEventListener('pushsubscriptionchange', function(event) {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(self.VAPID_PUBLIC_KEY)
    })
    .then(function(subscription) {
      // Send new subscription to server
      return fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          resubscribe: true,
        }),
      });
    })
  );
});

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
