/**
 * Mission Control SSE Stream
 *
 * Server-Sent Events endpoint for real-time mission updates.
 * Clients connect and receive updates for:
 * - Volunteer movements
 * - Zone status changes
 * - Sighting reports
 * - Command broadcasts
 * - Mode changes (containment, etc.)
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

// Store active connections by mission ID
const connections = new Map();

// Cleanup interval (remove stale connections)
const CLEANUP_INTERVAL = 30000; // 30 seconds
const CONNECTION_TIMEOUT = 60000; // 1 minute

export async function GET(request, { params }) {
  const { caseId } = params;

  // Verify mission exists
  const mission = await prisma.missionControl.findUnique({
    where: { caseId },
    select: { id: true, mode: true },
  });

  if (!mission) {
    return NextResponse.json(
      { error: 'No active mission for this case' },
      { status: 404 }
    );
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const data = JSON.stringify({
        type: 'CONNECTED',
        missionId: mission.id,
        mode: mission.mode,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));

      // Generate connection ID
      const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store connection
      if (!connections.has(caseId)) {
        connections.set(caseId, new Map());
      }
      connections.get(caseId).set(connectionId, {
        controller,
        lastPing: Date.now(),
      });

      // Heartbeat every 15 seconds
      const heartbeat = setInterval(() => {
        try {
          const ping = JSON.stringify({
            type: 'PING',
            timestamp: new Date().toISOString(),
          });
          controller.enqueue(encoder.encode(`data: ${ping}\n\n`));

          const conn = connections.get(caseId)?.get(connectionId);
          if (conn) {
            conn.lastPing = Date.now();
          }
        } catch (err) {
          // Connection closed
          clearInterval(heartbeat);
          cleanup();
        }
      }, 15000);

      // Cleanup function
      const cleanup = () => {
        clearInterval(heartbeat);
        connections.get(caseId)?.delete(connectionId);
        if (connections.get(caseId)?.size === 0) {
          connections.delete(caseId);
        }
      };

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch (e) {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

// Broadcast to all connections for a mission
export function broadcast(caseId, event) {
  const missionConnections = connections.get(caseId);
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
