/**
 * Real-time Notifications SSE Utilities
 *
 * Manages connections and broadcasting for user notifications.
 */

// Store active connections by user ID
export const connections = new Map();

// Helper function to broadcast to a user
export function broadcastToUser(userId, data) {
  const userConnections = connections.get(userId);
  if (userConnections) {
    const encoder = new TextEncoder();
    const message = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
    userConnections.forEach((controller) => {
      try {
        controller.enqueue(message);
      } catch (e) {
        // Connection closed, will be cleaned up
      }
    });
  }
}

// Helper to broadcast to multiple users
export function broadcastToUsers(userIds, data) {
  userIds.forEach((userId) => broadcastToUser(userId, data));
}
