/**
 * Command Center - Leader & Strategy Tools
 *
 * The "Long Game" - managing 72-hour searches.
 * Shift management, stale data, resources, trap ops.
 */

import prisma from '@/app/lib/prisma';
import { OPERATION_MODES, VOLUNTEER_STATUS, ZONE_STATUS } from './index';

/**
 * Get command center view for leaders
 */
export async function getCommandView(missionId, leaderId) {
  const mission = await prisma.missionControl.findUnique({
    where: { id: missionId },
    include: {
      case: true,
      activeVolunteers: {
        include: {
          user: { select: { id: true, firstName: true, phone: true } }
        }
      },
      zones: true,
      sightings: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      resources: {
        include: {
          volunteer: { select: { displayName: true, currentLocation: true } }
        }
      },
      traps: true,
    }
  });

  if (!mission) {
    return { error: 'Mission not found' };
  }

  return {
    mission: {
      id: mission.id,
      mode: mission.mode,
      activatedAt: mission.activatedAt,
      hoursActive: mission.activatedAt
        ? Math.round((Date.now() - new Date(mission.activatedAt).getTime()) / 3600000)
        : 0,
    },

    // Volunteer overview
    volunteers: {
      active: mission.activeVolunteers.filter(v => v.status === VOLUNTEER_STATUS.ACTIVE).length,
      onBreak: mission.activeVolunteers.filter(v => v.status === VOLUNTEER_STATUS.ON_BREAK).length,
      responding: mission.activeVolunteers.filter(v => v.status === VOLUNTEER_STATUS.RESPONDING).length,
      total: mission.totalVolunteersJoined,
      list: mission.activeVolunteers.map(v => ({
        id: v.id,
        name: v.displayName,
        status: v.status,
        location: v.currentLocation ? JSON.parse(v.currentLocation) : null,
        shiftStarted: v.shiftStartedAt,
        estimatedEnd: v.estimatedEndTime,
        resources: v.resources ? JSON.parse(v.resources) : [],
        assignedZone: v.assignedZoneId,
      })),
    },

    // Zone coverage
    coverage: {
      total: mission.zones.length,
      searched: mission.zones.filter(z => z.status === ZONE_STATUS.SEARCHED).length,
      stale: mission.zones.filter(z => z.status === ZONE_STATUS.STALE).length,
      inProgress: mission.zones.filter(z => z.status === ZONE_STATUS.IN_PROGRESS).length,
      unsearched: mission.zones.filter(z => z.status === ZONE_STATUS.UNSEARCHED).length,
      percentComplete: mission.zones.length
        ? Math.round((mission.zones.filter(z =>
            z.status === ZONE_STATUS.SEARCHED).length / mission.zones.length) * 100)
        : 0,
      zones: mission.zones.map(z => ({
        id: z.id,
        gridRef: z.gridRef,
        status: z.status,
        priority: z.priority,
        probability: z.probability,
        lastSearchedAt: z.lastSearchedAt,
        assignedTo: z.assignedToId,
        isStale: isZoneStale(z),
      })),
    },

    // Sightings
    sightings: {
      total: mission.sightingsCount,
      recent: mission.sightings.map(s => ({
        id: s.id,
        priority: s.priority,
        location: { lat: s.latitude, lng: s.longitude },
        time: s.createdAt,
        verified: s.verified,
        status: s.status,
        reporter: s.reporterName,
        photoUrl: s.photoUrl,
      })),
    },

    // Resources
    resources: {
      traps: mission.resources.filter(r => r.type === 'TRAP').length,
      cars: mission.resources.filter(r => r.type === 'CAR').length,
      flyers: mission.resources.filter(r => r.type === 'FLYERS').length,
      list: mission.resources.map(r => ({
        type: r.type,
        volunteer: r.volunteer?.displayName,
        location: r.location ? JSON.parse(r.location) : null,
        available: r.available,
      })),
    },

    // Trap operations
    trapOps: {
      active: mission.traps?.filter(t => t.status === 'ACTIVE').length || 0,
      traps: mission.traps?.map(t => ({
        id: t.id,
        location: { lat: t.latitude, lng: t.longitude },
        status: t.status,
        lastChecked: t.lastCheckedAt,
        checkSchedule: t.checkSchedule,
        assignedTo: t.assignedToId,
      })) || [],
    },
  };
}

/**
 * Check if a zone is stale (needs re-searching)
 */
function isZoneStale(zone) {
  if (zone.status !== ZONE_STATUS.SEARCHED) return false;
  if (!zone.lastSearchedAt) return false;

  const hoursSinceSearch = (Date.now() - new Date(zone.lastSearchedAt).getTime()) / 3600000;
  return hoursSinceSearch >= 4; // Stale after 4 hours
}

/**
 * Update stale zones - run periodically
 */
export async function updateStaleZones(missionId) {
  const staleThreshold = new Date(Date.now() - 4 * 3600000); // 4 hours ago

  const updated = await prisma.missionZone.updateMany({
    where: {
      missionId,
      status: ZONE_STATUS.SEARCHED,
      lastSearchedAt: { lt: staleThreshold },
    },
    data: {
      status: ZONE_STATUS.STALE,
    }
  });

  return { zonesMarkedStale: updated.count };
}

/**
 * Assign volunteer to a zone
 */
export async function assignZone(missionId, zoneId, volunteerId, assignedBy) {
  // Update zone
  await prisma.missionZone.update({
    where: { id: zoneId },
    data: {
      assignedToId: volunteerId,
      assignedAt: new Date(),
      status: ZONE_STATUS.IN_PROGRESS,
    }
  });

  // Update volunteer
  await prisma.missionVolunteer.update({
    where: { id: volunteerId },
    data: {
      assignedZoneId: zoneId,
    }
  });

  await prisma.missionLog.create({
    data: {
      missionId,
      action: 'ZONE_ASSIGNED',
      details: JSON.stringify({ zoneId, volunteerId }),
      userId: assignedBy,
    }
  });

  return { success: true };
}

/**
 * Send broadcast command to all volunteers
 */
export async function sendBroadcast(missionId, message, type, senderId) {
  const broadcast = await prisma.missionBroadcast.create({
    data: {
      missionId,
      message,
      type, // 'INFO', 'ALERT', 'FREEZE', 'STAND_DOWN'
      senderId,
      priority: type === 'FREEZE' ? 'CRITICAL' : 'NORMAL',
    }
  });

  await prisma.missionLog.create({
    data: {
      missionId,
      action: 'BROADCAST_SENT',
      details: JSON.stringify({ message, type }),
      userId: senderId,
    }
  });

  // TODO: Push notification to all active volunteers
  await notifyAllVolunteers(missionId, broadcast);

  return { success: true, broadcastId: broadcast.id };
}

/**
 * Request a resource
 */
export async function requestResource(missionId, resourceType, location, requesterId) {
  // Find nearest available resource of type
  const available = await prisma.missionResource.findFirst({
    where: {
      missionId,
      type: resourceType,
      available: true,
    },
    include: {
      volunteer: true,
    }
  });

  if (!available) {
    return {
      success: false,
      error: `No ${resourceType} available`,
    };
  }

  // Mark as requested
  await prisma.missionResource.update({
    where: { id: available.id },
    data: {
      available: false,
      requestedById: requesterId,
      requestedAt: new Date(),
      requestLocation: JSON.stringify(location),
    }
  });

  // Notify volunteer with the resource
  await notifyResourceRequest(available.volunteer, resourceType, location);

  return {
    success: true,
    resource: {
      type: resourceType,
      volunteer: available.volunteer?.displayName,
      eta: 'Volunteer notified',
    }
  };
}

/**
 * Switch to trap operations mode
 */
export async function switchToTrapOps(missionId, userId) {
  await prisma.missionControl.update({
    where: { id: missionId },
    data: {
      mode: OPERATION_MODES.TRAP_OPS,
      trapOpsStartedAt: new Date(),
    }
  });

  await prisma.missionLog.create({
    data: {
      missionId,
      action: 'SWITCHED_TO_TRAP_OPS',
      userId,
    }
  });

  // Notify volunteers of mode change
  await sendBroadcast(
    missionId,
    'Switching to trap monitoring mode. Active search paused.',
    'INFO',
    userId
  );

  return { success: true, mode: OPERATION_MODES.TRAP_OPS };
}

/**
 * Add a trap location
 */
export async function addTrap(missionId, trapData, userId) {
  const { location, type, notes } = trapData;

  const trap = await prisma.missionTrap.create({
    data: {
      missionId,
      latitude: location.lat,
      longitude: location.lng,
      type: type || 'HUMANE_TRAP',
      notes,
      status: 'ACTIVE',
      placedById: userId,
      placedAt: new Date(),
      checkSchedule: JSON.stringify({
        intervalHours: 4,
        nextCheck: new Date(Date.now() + 4 * 3600000),
      }),
    }
  });

  return { success: true, trapId: trap.id };
}

/**
 * Log trap check
 */
export async function checkTrap(trapId, checkData, userId) {
  const { status, notes, triggered } = checkData;

  const trap = await prisma.missionTrap.update({
    where: { id: trapId },
    data: {
      lastCheckedAt: new Date(),
      lastCheckedById: userId,
      status: triggered ? 'TRIGGERED' : status,
      checkSchedule: JSON.stringify({
        intervalHours: 4,
        nextCheck: new Date(Date.now() + 4 * 3600000),
      }),
    }
  });

  // Log the check
  await prisma.trapCheck.create({
    data: {
      trapId,
      checkedById: userId,
      status,
      notes,
      triggered,
    }
  });

  if (triggered) {
    // Alert everyone - potential recovery!
    await sendBroadcast(
      trap.missionId,
      `TRAP TRIGGERED at trap location! Check immediately!`,
      'ALERT',
      userId
    );
  }

  return { success: true, triggered };
}

/**
 * Get shift summary for handoff
 */
export async function getShiftSummary(missionId) {
  const mission = await prisma.missionControl.findUnique({
    where: { id: missionId },
    include: {
      zones: true,
      sightings: {
        where: { createdAt: { gte: new Date(Date.now() - 8 * 3600000) } },
        orderBy: { createdAt: 'desc' },
      },
      traps: true,
    }
  });

  const logs = await prisma.missionLog.findMany({
    where: {
      missionId,
      createdAt: { gte: new Date(Date.now() - 8 * 3600000) },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return {
    summary: {
      zonesSearched: mission.zones.filter(z => z.status === ZONE_STATUS.SEARCHED).length,
      zoneStale: mission.zones.filter(z => z.status === ZONE_STATUS.STALE).length,
      sightingsReported: mission.sightings.length,
      verifiedSightings: mission.sightings.filter(s => s.verified).length,
      activeTraps: mission.traps.filter(t => t.status === 'ACTIVE').length,
    },
    recentSightings: mission.sightings.slice(0, 5),
    keyEvents: logs.filter(l =>
      ['SIGHTING_REPORTED', 'CONTAINMENT_INITIATED', 'CONTAINMENT_ENDED'].includes(l.action)
    ),
    recommendations: generateRecommendations(mission),
  };
}

function generateRecommendations(mission) {
  const recs = [];

  const staleZones = mission.zones.filter(z => z.status === ZONE_STATUS.STALE);
  if (staleZones.length > 0) {
    recs.push(`${staleZones.length} zones need re-searching (marked stale)`);
  }

  const recentSightings = mission.sightings.filter(s =>
    new Date(s.createdAt) > new Date(Date.now() - 2 * 3600000)
  );
  if (recentSightings.length > 0) {
    recs.push(`Focus on areas near recent sightings`);
  }

  const uncheckedTraps = mission.traps.filter(t => {
    if (!t.lastCheckedAt) return true;
    return new Date(t.lastCheckedAt) < new Date(Date.now() - 4 * 3600000);
  });
  if (uncheckedTraps.length > 0) {
    recs.push(`${uncheckedTraps.length} traps need checking`);
  }

  return recs;
}

// Notification stubs
async function notifyAllVolunteers(missionId, broadcast) {
  console.log(`Broadcasting to mission ${missionId}: ${broadcast.message}`);
}

async function notifyResourceRequest(volunteer, type, location) {
  console.log(`Resource request: ${type} to ${location.lat},${location.lng}`);
}

export default {
  getCommandView,
  updateStaleZones,
  assignZone,
  sendBroadcast,
  requestResource,
  switchToTrapOps,
  addTrap,
  checkTrap,
  getShiftSummary,
};
