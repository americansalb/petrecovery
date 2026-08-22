/**
 * Mission Control SSE Stream Utilities
 *
 * Manages connections and broadcasting for mission real-time updates.
 */

// Store active connections by mission ID.
//
// On globalThis, not module scope - the same reason prisma.ts does it.
// Next bundles each route separately, so the stream route (which fills
// this map) and the mutation routes (which broadcast into it) can get
// DIFFERENT instances of this module. With a plain module-level Map,
// every broadcast landed in an empty map and no event ever reached a
// listener: observed live, with two browsers open. globalThis is shared
// across bundles in the one server process.
//
// Still per-process: on more than one container this needs Redis
// pub/sub. One box, one truth; two boxes, two half-truths.
const globalForStream = globalThis;
if (!globalForStream.__missionStreamConnections) {
  globalForStream.__missionStreamConnections = new Map();
}
export const connections = globalForStream.__missionStreamConnections;

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
