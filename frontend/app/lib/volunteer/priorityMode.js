/**
 * Phase 10: Priority Mode
 *
 * Urgent case surge protocol for fresh cases.
 * More aggressive notifications, volunteer surge mechanics.
 */

import prisma from '@/app/lib/prisma';
import { sendDivisionAlert, alertSquadNewCase } from './divisionAlerts';
import { sendPushToMany } from '@/app/lib/push';

// Priority thresholds (hours since report)
const PRIORITY_LEVELS = {
  CRITICAL: 2,    // First 2 hours - highest urgency
  HIGH: 6,        // First 6 hours
  ELEVATED: 24,   // First 24 hours
  NORMAL: 72,     // First 3 days
  LOW: Infinity,  // After 3 days
};

/**
 * Determine case priority level
 */
export function getCasePriority(missionData) {
  const hoursSinceReport = (Date.now() - new Date(missionData.createdAt).getTime()) / (1000 * 60 * 60);

  if (hoursSinceReport <= PRIORITY_LEVELS.CRITICAL) {
    return {
      level: 'CRITICAL',
      color: 'red',
      label: '🚨 CRITICAL',
      hoursRemaining: Math.round(PRIORITY_LEVELS.CRITICAL - hoursSinceReport),
      surgeEligible: true,
    };
  }

  if (hoursSinceReport <= PRIORITY_LEVELS.HIGH) {
    return {
      level: 'HIGH',
      color: 'orange',
      label: '⚠️ HIGH PRIORITY',
      hoursRemaining: Math.round(PRIORITY_LEVELS.HIGH - hoursSinceReport),
      surgeEligible: true,
    };
  }

  if (hoursSinceReport <= PRIORITY_LEVELS.ELEVATED) {
    return {
      level: 'ELEVATED',
      color: 'yellow',
      label: '📢 ELEVATED',
      hoursRemaining: Math.round(PRIORITY_LEVELS.ELEVATED - hoursSinceReport),
      surgeEligible: false,
    };
  }

  if (hoursSinceReport <= PRIORITY_LEVELS.NORMAL) {
    return {
      level: 'NORMAL',
      color: 'blue',
      label: 'ACTIVE',
      hoursRemaining: null,
      surgeEligible: false,
    };
  }

  return {
    level: 'LOW',
    color: 'gray',
    label: 'ONGOING',
    hoursRemaining: null,
    surgeEligible: false,
  };
}

/**
 * Activate priority mode for a case
 */
export async function activatePriorityMode(missionId, options = {}) {
  const {
    triggeredBy = 'SYSTEM',
    reason = 'Fresh case',
    duration = 2, // hours
  } = options;

  const missionData = await prisma.case.findUnique({
    where: { id: missionId },
    include: {
      assignments: {
        include: {
          rescueForce: {
            include: {
              divisions: true,
            }
          }
        }
      }
    }
  });

  if (!missionData) {
    return { success: false, error: 'Mission not found' };
  }

  // Create priority mode record
  const priorityMode = await prisma.casePriorityMode.create({
    data: {
      missionId,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + duration * 60 * 60 * 1000),
      triggeredBy,
      reason,
      isActive: true,
    }
  });

  // Update case priority
  await prisma.case.update({
    where: { id: missionId },
    data: { priorityLevel: 'CRITICAL' }
  });

  // Trigger surge notifications
  await triggerVolunteerSurge(missionData);

  return {
    success: true,
    priorityModeId: priorityMode.id,
    expiresAt: priorityMode.expiresAt,
  };
}

/**
 * Trigger volunteer surge for a case
 */
async function triggerVolunteerSurge(missionData) {
  // Get all forces covering this area
  const forces = await findSquadsCoveringLocation(
    missionData.lastSeenLatitude,
    missionData.lastSeenLongitude
  );

  const results = [];

  for (const force of forces) {
    // Alert all divisions in surge mode
    for (const division of force.divisions || []) {
      const result = await sendDivisionAlert(division.id, {
        type: 'PRIORITY_SURGE',
        title: `🚨 URGENT: ${missionData.petName} just went missing!`,
        body: `${missionData.petSpecies} lost near ${missionData.lastSeenAddress}. Every minute counts!`,
        missionId: missionData.id,
        priority: 'URGENT',
      });
      results.push(result);
    }

    // Also alert individual members with high response rates
    const topResponders = await getTopResponders(force.id, 20);
    await sendSurgeNotificationToUsers(topResponders, missionData);
  }

  // Send broader notification to all nearby patrol members
  await alertNearbyPatrolMembers(missionData);

  // Log surge event
  await prisma.surgeEvent.create({
    data: {
      missionId: missionData.id,
      type: 'PRIORITY_ACTIVATED',
      squadsNotified: forces.length,
      volunteersNotified: results.reduce((sum, r) => sum + (r.sent || 0), 0),
    }
  });

  return results;
}

/**
 * Get top responding volunteers in a force
 */
async function getTopResponders(forceId, limit = 20) {
  const members = await prisma.squadMembership.findMany({
    where: {
      rescueForceId: forceId,
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          responseRate: true, // Percentage of alerts responded to
          averageResponseTime: true, // Minutes
          pushSubscriptions: true,
        }
      }
    }
  });

  // Sort by response rate and response time
  const ranked = members
    .filter(m => m.user.pushSubscriptions.length > 0)
    .map(m => ({
      userId: m.userId,
      score: (m.user.responseRate || 50) - (m.user.averageResponseTime || 30) / 10,
      subscriptions: m.user.pushSubscriptions,
    }))
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, limit);
}

/**
 * Send surge notification to specific users
 */
async function sendSurgeNotificationToUsers(users, missionData) {
  const subscriptions = [];

  for (const user of users) {
    for (const sub of user.subscriptions) {
      subscriptions.push({
        id: sub.id,
        subscription: JSON.parse(sub.subscription),
      });
    }
  }

  if (subscriptions.length === 0) return;

  const payload = {
    title: `🚨 URGENT: Help find ${missionData.petName}!`,
    body: `A ${missionData.petSpecies} just went missing near you. Your help is needed NOW!`,
    icon: '/icons/urgent-alert.png',
    badge: '/icons/badge-urgent.png',
    tag: `surge-${missionData.id}`,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      type: 'PRIORITY_SURGE',
      missionId: missionData.id,
      url: `/search/${missionData.id}`,
    },
    actions: [
      { action: 'join', title: 'I\'ll Help!' },
      { action: 'later', title: 'Remind Later' },
    ],
  };

  await sendPushToMany(subscriptions, payload);
}

/**
 * Alert nearby patrol members (within radius)
 */
async function alertNearbyPatrolMembers(missionData) {
  const radiusMiles = 5;

  // Find users with patrol profiles in range
  const patrolMembers = await prisma.user.findMany({
    where: {
      patrolProfile: { isNot: null },
      profile: {
        latitude: {
          gte: missionData.lastSeenLatitude - (radiusMiles / 69),
          lte: missionData.lastSeenLatitude + (radiusMiles / 69),
        },
        longitude: {
          gte: missionData.lastSeenLongitude - (radiusMiles / 54),
          lte: missionData.lastSeenLongitude + (radiusMiles / 54),
        },
      },
      pushSubscriptions: { some: {} },
    },
    include: {
      pushSubscriptions: true,
      profile: true,
    }
  });

  // Filter by actual distance and send
  const subscriptions = [];

  for (const member of patrolMembers) {
    if (!member.profile) continue;

    const distance = haversineDistance(
      missionData.lastSeenLatitude,
      missionData.lastSeenLongitude,
      member.profile.latitude,
      member.profile.longitude
    );

    if (distance <= radiusMiles) {
      for (const sub of member.pushSubscriptions) {
        subscriptions.push({
          id: sub.id,
          subscription: JSON.parse(sub.subscription),
          distance,
        });
      }
    }
  }

  if (subscriptions.length === 0) return;

  const payload = {
    title: `📍 Lost ${missionData.petSpecies} near you!`,
    body: `${missionData.petName} went missing nearby. Can you help look?`,
    icon: '/icons/location-alert.png',
    tag: `nearby-${missionData.id}`,
    requireInteraction: true,
    data: {
      type: 'NEARBY_ALERT',
      missionId: missionData.id,
      url: `/search/${missionData.id}`,
    },
  };

  await sendPushToMany(subscriptions, payload);
}

/**
 * Deactivate priority mode
 */
export async function deactivatePriorityMode(missionId, reason = 'Expired') {
  await prisma.casePriorityMode.updateMany({
    where: {
      missionId,
      isActive: true,
    },
    data: {
      isActive: false,
      endedAt: new Date(),
      endReason: reason,
    }
  });

  // Update case priority
  const missionData = await prisma.case.findUnique({
    where: { id: missionId },
  });

  const newPriority = getCasePriority(missionData);

  await prisma.case.update({
    where: { id: missionId },
    data: { priorityLevel: newPriority.level }
  });

  return { success: true };
}

/**
 * Get active priority cases
 */
export async function getActivePriorityCases() {
  const cases = await prisma.case.findMany({
    where: {
      status: 'ACTIVE',
      priorityModes: {
        some: { isActive: true }
      }
    },
    include: {
      priorityModes: {
        where: { isActive: true },
        orderBy: { startedAt: 'desc' },
        take: 1,
      },
      _count: {
        select: {
          assignments: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' },
  });

  return cases.map(c => ({
    id: c.id,
    petName: c.petName,
    petSpecies: c.petSpecies,
    petPhotoUrl: c.petPhotoUrl,
    location: {
      lat: c.lastSeenLatitude,
      lng: c.lastSeenLongitude,
      address: c.lastSeenAddress,
    },
    priority: getCasePriority(c),
    priorityMode: c.priorityModes[0],
    volunteerCount: c._count.assignments,
    createdAt: c.createdAt,
  }));
}

/**
 * Auto-manage priority modes (cron job)
 */
export async function managePriorityModes() {
  // Expire old priority modes
  await prisma.casePriorityMode.updateMany({
    where: {
      isActive: true,
      expiresAt: { lt: new Date() },
    },
    data: {
      isActive: false,
      endedAt: new Date(),
      endReason: 'Expired',
    }
  });

  // Auto-activate for new cases
  const newCases = await prisma.case.findMany({
    where: {
      status: 'ACTIVE',
      createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }, // Last 2 hours
      priorityModes: { none: {} },
    }
  });

  for (const missionData of newCases) {
    await activatePriorityMode(missionData.id, {
      triggeredBy: 'AUTO',
      reason: 'New case auto-activation',
    });
  }

  // Check for coverage gaps and potentially re-surge
  await checkCoverageGaps();

  return {
    expired: await prisma.casePriorityMode.count({ where: { endReason: 'Expired' } }),
    activated: newCases.length,
  };
}

/**
 * Check for cases with poor coverage and trigger re-surge
 */
async function checkCoverageGaps() {
  const activeMissions = await prisma.case.findMany({
    where: {
      status: 'ACTIVE',
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
    },
    include: {
      assignments: {
        include: {
          _count: { select: { participants: { where: { isActive: true } } } }
        }
      }
    }
  });

  for (const missionData of activeMissions) {
    const totalVolunteers = missionData.assignments.reduce(
      (sum, a) => sum + a._count.participants, 0
    );

    // If case is less than 6 hours old with < 5 volunteers, re-surge
    const hoursOld = (Date.now() - new Date(missionData.createdAt).getTime()) / (1000 * 60 * 60);

    if (hoursOld < 6 && totalVolunteers < 5) {
      // Check if already in priority mode
      const existingPriority = await prisma.casePriorityMode.findFirst({
        where: { missionId: missionData.id, isActive: true },
      });

      if (!existingPriority) {
        await activatePriorityMode(missionData.id, {
          triggeredBy: 'AUTO',
          reason: 'Low volunteer coverage',
          duration: 1,
        });
      }
    }
  }
}

/**
 * Get volunteer surge stats for a case
 */
export async function getSurgeStats(missionId) {
  const surgeEvents = await prisma.surgeEvent.findMany({
    where: { missionId },
    orderBy: { createdAt: 'desc' },
  });

  const priorityModes = await prisma.casePriorityMode.findMany({
    where: { missionId },
    orderBy: { startedAt: 'desc' },
  });

  return {
    totalSurges: surgeEvents.length,
    totalNotificationsSent: surgeEvents.reduce((sum, e) => sum + e.volunteersNotified, 0),
    priorityModes: priorityModes.map(pm => ({
      startedAt: pm.startedAt,
      endedAt: pm.endedAt,
      duration: pm.endedAt
        ? (new Date(pm.endedAt) - new Date(pm.startedAt)) / (1000 * 60)
        : null,
      reason: pm.reason,
      isActive: pm.isActive,
    })),
  };
}

/**
 * Find forces covering a location
 */
async function findSquadsCoveringLocation(lat, lng) {
  const forces = await prisma.rescueForce.findMany({
    where: { isActive: true },
    include: {
      divisions: {
        where: { isActive: true },
      }
    }
  });

  return forces.filter(force => {
    if (!force.centerLatitude || !force.centerLongitude) return false;

    const distance = haversineDistance(
      lat, lng,
      force.centerLatitude, force.centerLongitude
    );

    return distance <= (force.radiusMiles || 10);
  });
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default {
  getCasePriority,
  activatePriorityMode,
  deactivatePriorityMode,
  getActivePriorityCases,
  managePriorityModes,
  getSurgeStats,
};
