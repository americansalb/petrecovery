/**
 * Mission Control SSE Stream Utilities
 *
 * Manages connections and broadcasting for mission real-time updates.
 */

// Store active connections by mission ID
export const connections = new Map();

// Broadcast to all connections for a mission
export function broadcast(missionId, event) {
  const missionConnections = connections.get(missionId);
  if (!missionConnections || missionConnections.size === 0) {
    return;
  }

  const encoder = new TextEncoder();
  const data = JSON.stringify({
    ...event,
    timestamp: new Date().toISOString(),
  });

  const toRemove = [];

  missionConnections.forEach((conn, id) => {
    try {
      conn.controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    } catch (err) {
      // Connection dead, mark for removal
      toRemove.push(id);
    }
  });

  // Remove dead connections
  toRemove.forEach(id => missionConnections.delete(id));
}

// Event types for Mission Control:
// - VOLUNTEER_JOINED: New volunteer joined
// - VOLUNTEER_LEFT: Volunteer checked out
// - VOLUNTEER_MOVED: Volunteer location updated
// - ZONE_UPDATED: Zone status changed
// - SIGHTING_REPORTED: New sighting
// - SIGHTING_VERIFIED: Sighting confirmed
// - MODE_CHANGED: Mission mode changed (containment, etc.)
// - BROADCAST: Command center broadcast
// - CONTAINMENT_ACTIVATED: Perimeter being formed
// - CALL_MODE_TRIGGERED: Owner's voice playing
