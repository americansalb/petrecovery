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
   * Match found alert - when a found pet matches a lost pet
   */
  MATCH_ALERT: (petName, matchScore, location, conversationId) => ({
    title: `🎉 Potential Match for ${petName}!`,
    body: `Someone found a pet that's a ${matchScore}% match near ${location}. Tap to connect!`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: `match-${conversationId}`,
    type: 'MATCH_ALERT',
    url: `/messages/${conversationId}`,
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'View Match' },
      { action: 'dismiss', title: 'Not Now' }
    ],
    data: { conversationId, type: 'MATCH_ALERT' },
  }),

  /**
   * New sighting alert
   */
  SIGHTING_ALERT: (petName, location, missionId) => ({
    title: `🔔 Possible ${petName} Sighting!`,
    body: `Someone may have spotted ${petName} near ${location}. Tap to view details.`,
    icon: '/icons/alert-icon.png',
    badge: '/icons/badge-72x72.png',
    tag: `sighting-${missionId}`,
    type: 'SIGHTING_ALERT',
    missionId,
    url: `/missions/${missionId}`,
    requireInteraction: true,
    data: { missionId, type: 'SIGHTING_ALERT' },
  }),

  /**
   * Case status update
   */
  CASE_UPDATE: (petName, status, missionId) => {
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
      tag: `case-${missionId}`,
      type: 'CASE_UPDATE',
      missionId,
      url: `/missions/${missionId}`,
      data: { missionId, status, type: 'CASE_UPDATE' },
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
  NEARBY_ALERT: (petName, distance, missionId) => ({
    title: '📍 Lost Pet Nearby',
    body: `${petName} was reported missing ${distance} from you. Help spread the word!`,
    icon: '/icons/location-icon.png',
    tag: `nearby-${missionId}`,
    type: 'NEARBY_ALERT',
    missionId,
    url: `/missions/${missionId}`,
    data: { missionId, type: 'NEARBY_ALERT' },
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
    url: `/rescue-forces/${squadId}`,
    data: { squadId, type: 'SQUAD_ACTIVITY' },
  }),

  /**
   * Forum reply notification
   */
  FORUM_REPLY: (authorName, threadTitle, threadSlug) => ({
    title: `💬 New reply from ${authorName}`,
    body: `In: ${threadTitle.length > 50 ? threadTitle.substring(0, 47) + '...' : threadTitle}`,
    icon: '/icons/icon-192x192.png',
    tag: `forum-${threadSlug}`,
    type: 'FORUM_REPLY',
    url: `/hub/thread/${threadSlug}`,
    data: { threadSlug, type: 'FORUM_REPLY' },
  }),

  /**
   * Forum mention notification
   */
  FORUM_MENTION: (authorName, threadTitle, threadSlug) => ({
    title: `📢 ${authorName} mentioned you`,
    body: `In: ${threadTitle.length > 50 ? threadTitle.substring(0, 47) + '...' : threadTitle}`,
    icon: '/icons/icon-192x192.png',
    tag: `forum-mention-${threadSlug}`,
    type: 'FORUM_MENTION',
    url: `/hub/thread/${threadSlug}`,
    data: { threadSlug, type: 'FORUM_MENTION' },
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

/**
 * Send push notification to a specific user by their ID
 *
 * @param {Object} prisma - Prisma client instance
 * @param {string} userId - The user ID to send the notification to
 * @param {Object} payload - The notification payload
 * @returns {Promise<{success: boolean, sent: number, failed: number}>}
 */
export async function sendPushToUser(prisma, userId, payload) {
  if (!isPushConfigured()) {
    console.warn('Push notifications not configured');
    return { success: false, sent: 0, failed: 0, error: 'Push notifications not configured' };
  }

  try {
    // Get all push subscriptions for this user
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      return { success: true, sent: 0, failed: 0, message: 'No subscriptions found' };
    }

    const result = await sendPushToMany(subscriptions, payload);

    // Clean up expired subscriptions
    if (result.expired && result.expired.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { id: { in: result.expired } },
      });
    }

    return { success: true, ...result };
  } catch (error) {
    console.error('Error sending push to user:', error);
    return { success: false, sent: 0, failed: 0, error: error.message };
  }
}

/**
 * Unsubscribe a push subscription
 *
 * @param {Object} prisma - Prisma client instance
 * @param {string} endpoint - The subscription endpoint to remove
 * @param {string} userId - Optional user ID for verification
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function unsubscribePush(prisma, endpoint, userId = null) {
  try {
    const whereClause = { endpoint };
    if (userId) {
      whereClause.userId = userId;
    }

    const result = await prisma.pushSubscription.deleteMany({
      where: whereClause,
    });

    return { success: true, deleted: result.count };
  } catch (error) {
    console.error('Error unsubscribing push:', error);
    return { success: false, error: error.message };
  }
}

export default {
  isPushConfigured,
  getVapidPublicKey,
  sendPushNotification,
  sendPushToMany,
  sendPushToUser,
  unsubscribePush,
  PUSH_TEMPLATES,
  urlBase64ToUint8Array,
};
