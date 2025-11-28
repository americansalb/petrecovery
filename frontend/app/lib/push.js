/**
 * Phase 8: Web Push Notification Service
 *
 * Server-side push notification service using web-push.
 */

import webpush from 'web-push';

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:notifications@petrecovery.org';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

/**
 * Check if push notifications are configured
 */
export function isPushConfigured() {
  return !!(vapidPublicKey && vapidPrivateKey);
}

/**
 * Get the VAPID public key
 */
export function getVapidPublicKey() {
  return vapidPublicKey;
}

/**
 * Send a push notification to a subscription
 *
 * @param {Object} subscription - The push subscription object
 * @param {Object} payload - The notification payload
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendPushNotification(subscription, payload) {
  if (!isPushConfigured()) {
    console.warn('Push notifications not configured');
    return { success: false, error: 'Push notifications not configured' };
  }

  try {
    const payloadString = JSON.stringify(payload);

    await webpush.sendNotification(subscription, payloadString);

    return { success: true };
  } catch (error) {
    console.error('Push notification error:', error);

    // Handle specific error codes
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Subscription expired or invalid
      return {
        success: false,
        error: 'Subscription expired',
        expired: true,
        statusCode: error.statusCode,
      };
    }

    return {
      success: false,
      error: error.message || 'Failed to send notification',
      statusCode: error.statusCode,
    };
  }
}

/**
 * Send push notification to multiple subscriptions
 *
 * @param {Array} subscriptions - Array of push subscriptions
 * @param {Object} payload - The notification payload
 * @returns {Promise<{sent: number, failed: number, expired: string[]}>}
 */
export async function sendPushToMany(subscriptions, payload) {
  const results = await Promise.all(
    subscriptions.map(async (sub) => {
      const result = await sendPushNotification(sub.subscription, payload);
      return {
        subscriptionId: sub.id,
        endpoint: sub.subscription.endpoint,
        ...result,
      };
    })
  );

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const expired = results.filter((r) => r.expired).map((r) => r.subscriptionId);

  return { sent, failed, expired, results };
}

/**
 * Notification payload templates
 */
export const PUSH_TEMPLATES = {
  /**
   * New sighting alert
   */
  SIGHTING_ALERT: (petName, location, caseId) => ({
    title: `🔔 Possible ${petName} Sighting!`,
    body: `Someone may have spotted ${petName} near ${location}. Tap to view details.`,
    icon: '/icons/alert-icon.png',
    badge: '/icons/badge-72x72.png',
    tag: `sighting-${caseId}`,
    type: 'SIGHTING_ALERT',
    caseId,
    url: `/cases/${caseId}`,
    requireInteraction: true,
    data: { caseId, type: 'SIGHTING_ALERT' },
  }),

  /**
   * Case status update
   */
  CASE_UPDATE: (petName, status, caseId) => {
    const statusMessages = {
      FOUND: `${petName} has been found!`,
      REUNITED: `${petName} has been reunited!`,
      CLOSED: `Case for ${petName} has been closed`,
      NEW_LEAD: `New lead on ${petName}'s case`,
    };

    return {
      title: status === 'FOUND' || status === 'REUNITED' ? '🎉 Great News!' : '📢 Case Update',
      body: statusMessages[status] || `Update on ${petName}'s case: ${status}`,
      icon: '/icons/icon-192x192.png',
      tag: `case-${caseId}`,
      type: 'CASE_UPDATE',
      caseId,
      url: `/cases/${caseId}`,
      data: { caseId, status, type: 'CASE_UPDATE' },
    };
  },

  /**
   * New message notification
   */
  NEW_MESSAGE: (senderName, preview, conversationId) => ({
    title: `💬 New message from ${senderName}`,
    body: preview.length > 100 ? preview.substring(0, 97) + '...' : preview,
    icon: '/icons/message-icon.png',
    tag: `message-${conversationId}`,
    type: 'MESSAGE',
    url: `/messages/${conversationId}`,
    data: { conversationId, type: 'MESSAGE' },
  }),

  /**
   * Nearby lost pet alert
   */
  NEARBY_ALERT: (petName, distance, caseId) => ({
    title: '📍 Lost Pet Nearby',
    body: `${petName} was reported missing ${distance} from you. Help spread the word!`,
    icon: '/icons/location-icon.png',
    tag: `nearby-${caseId}`,
    type: 'NEARBY_ALERT',
    caseId,
    url: `/cases/${caseId}`,
    data: { caseId, type: 'NEARBY_ALERT' },
  }),

  /**
   * Squad activity notification
   */
  SQUAD_ACTIVITY: (squadName, message, squadId) => ({
    title: `🦮 ${squadName}`,
    body: message,
    icon: '/icons/squad-icon.png',
    tag: `squad-${squadId}`,
    type: 'SQUAD_ACTIVITY',
    url: `/rescue-squads/${squadId}`,
    data: { squadId, type: 'SQUAD_ACTIVITY' },
  }),

  /**
   * Generic notification
   */
  GENERIC: (title, body, url = '/') => ({
    title,
    body,
    icon: '/icons/icon-192x192.png',
    tag: `generic-${Date.now()}`,
    type: 'GENERIC',
    url,
    data: { type: 'GENERIC' },
  }),
};

/**
 * Convert URL-safe base64 to Uint8Array for subscription
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default {
  isPushConfigured,
  getVapidPublicKey,
  sendPushNotification,
  sendPushToMany,
  PUSH_TEMPLATES,
  urlBase64ToUint8Array,
};
