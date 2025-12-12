/**
 * Server-side realtime notification utilities
 *
 * These functions help broadcast real-time updates to connected users
 */

// In-memory store for SSE connections
// In production, use Redis pub/sub for multi-instance support
const connections = new Map();

/**
 * Register a user connection
 */
export function registerConnection(userId, controller) {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId).add(controller);
}

/**
 * Unregister a user connection
 */
export function unregisterConnection(userId, controller) {
  const userConnections = connections.get(userId);
  if (userConnections) {
    userConnections.delete(controller);
    if (userConnections.size === 0) {
      connections.delete(userId);
    }
  }
}

/**
 * Broadcast to a single user
 */
export function broadcastToUser(userId, data) {
  const userConnections = connections.get(userId);
  if (!userConnections || userConnections.size === 0) return false;

  const encoder = new TextEncoder();
  const message = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

  let sent = false;
  userConnections.forEach((controller) => {
    try {
      controller.enqueue(message);
      sent = true;
    } catch (e) {
      // Connection closed, will be cleaned up
    }
  });

  return sent;
}

/**
 * Broadcast to multiple users
 */
export function broadcastToUsers(userIds, data) {
  const results = { sent: 0, failed: 0 };
  userIds.forEach((userId) => {
    if (broadcastToUser(userId, data)) {
      results.sent++;
    } else {
      results.failed++;
    }
  });
  return results;
}

/**
 * Send a notification to a user in real-time
 */
export function sendRealtimeNotification(userId, notification) {
  return broadcastToUser(userId, {
    type: 'notification',
    payload: notification,
    timestamp: Date.now(),
  });
}

/**
 * Send case update to all participants
 */
export async function broadcastCaseUpdate(missionId, event, data, participantUserIds) {
  return broadcastToUsers(participantUserIds, {
    type: 'case_update',
    payload: {
      missionId,
      event,
      data,
    },
    timestamp: Date.now(),
  });
}

/**
 * Send squad message in real-time
 */
export function broadcastSquadMessage(memberUserIds, message) {
  return broadcastToUsers(memberUserIds, {
    type: 'squad_message',
    payload: message,
    timestamp: Date.now(),
  });
}

/**
 * Send sighting alert to relevant users
 */
export function broadcastSighting(userIds, sighting) {
  return broadcastToUsers(userIds, {
    type: 'sighting',
    payload: sighting,
    timestamp: Date.now(),
  });
}

/**
 * Get count of connected users
 */
export function getConnectedUserCount() {
  return connections.size;
}

/**
 * Check if a user is connected
 */
export function isUserConnected(userId) {
  const userConnections = connections.get(userId);
  return userConnections && userConnections.size > 0;
}

export { connections };
