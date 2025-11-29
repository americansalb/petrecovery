/**
 * Mission Control Activation
 *
 * Handles the transition from static case page to live operation.
 * The "switch" that goes from informational to tactical.
 */

import prisma from '@/app/lib/prisma';
import { OPERATION_MODES, ZONE_STATUS } from './index';
import { sendPushToMany, PUSH_TEMPLATES } from '@/app/lib/push';

/**
 * Check if user can activate live operation
 */
export async function canActivate(caseId, userId) {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      reporter: true,
      assignment: {
        include: {
          rescueSquad: {
            include: {
              members: {
                where: { role: { in: ['LEADER', 'CO_LEADER', 'COORDINATOR'] } }
              }
            }
          }
        }
      }
    }
  });

  if (!caseData) return { allowed: false, reason: 'Case not found' };

  // Owner can always activate
  if (caseData.reporterId === userId) {
    return { allowed: true, role: 'OWNER' };
  }

  // Squad/Division leaders can activate
  const squadLeaders = caseData.assignment?.rescueSquad?.members || [];
  const isLeader = squadLeaders.some(m => m.userId === userId);
  if (isLeader) {
    return { allowed: true, role: 'LEADER' };
  }

  // Check if user is a site admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
    return { allowed: true, role: 'ADMIN' };
  }

  return { allowed: false, reason: 'Only owner or squad leaders can activate' };
}

/**
 * Activate live operation mode
 */
export async function activateMission(caseId, userId, options = {}) {
  const canAct = await canActivate(caseId, userId);
  if (!canAct.allowed) {
    return { success: false, error: canAct.reason };
  }

  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      lastSeenLat: true,
      lastSeenLng: true,
      petSpecies: true,
    }
  });

  // Create or update mission control
  const mission = await prisma.missionControl.upsert({
    where: { caseId },
    create: {
      caseId,
      mode: OPERATION_MODES.LIVE_SEARCH,
      activatedAt: new Date(),
      activatedById: userId,
      activatorRole: canAct.role,
      initialRadius: options.radiusMiles || getDefaultRadius(caseData?.petSpecies),
    },
    update: {
      mode: OPERATION_MODES.LIVE_SEARCH,
      activatedAt: new Date(),
      activatedById: userId,
      activatorRole: canAct.role,
    }
  });

  // Generate search zones around last seen location
  if (caseData?.lastSeenLat && caseData?.lastSeenLng) {
    await generateSearchZones(
      mission.id,
      { lat: caseData.lastSeenLat, lng: caseData.lastSeenLng },
      options.radiusMiles || getDefaultRadius(caseData?.petSpecies)
    );
  }

  // Update case status
  await prisma.case.update({
    where: { id: caseId },
    data: { status: 'ACTIVE_SEARCH' }
  });

  // Log activation
  await prisma.missionLog.create({
    data: {
      missionId: mission.id,
      action: 'ACTIVATED',
      details: JSON.stringify({
        activatedBy: userId,
        role: canAct.role,
        options,
      }),
      userId,
    }
  });

  // Send notifications to squad members
  await notifySquadActivation(caseId, mission.id);

  return {
    success: true,
    missionId: mission.id,
    mode: OPERATION_MODES.LIVE_SEARCH,
  };
}

/**
 * Deactivate / pause mission
 */
export async function pauseMission(missionId, userId, reason) {
  const mission = await prisma.missionControl.update({
    where: { id: missionId },
    data: {
      mode: OPERATION_MODES.STANDBY,
      pausedAt: new Date(),
      pausedById: userId,
      pauseReason: reason,
    }
  });

  // Notify active volunteers
  await notifyVolunteersPause(missionId, reason);

  // Log
  await prisma.missionLog.create({
    data: {
      missionId,
      action: 'PAUSED',
      details: JSON.stringify({ reason }),
      userId,
    }
  });

  return { success: true, mode: OPERATION_MODES.STANDBY };
}

/**
 * Resume paused mission
 */
export async function resumeMission(missionId, userId) {
  const mission = await prisma.missionControl.update({
    where: { id: missionId },
    data: {
      mode: OPERATION_MODES.LIVE_SEARCH,
      pausedAt: null,
      pauseReason: null,
    }
  });

  await notifyVolunteersResume(missionId);

  await prisma.missionLog.create({
    data: {
      missionId,
      action: 'RESUMED',
      userId,
    }
  });

  return { success: true, mode: OPERATION_MODES.LIVE_SEARCH };
}

/**
 * Get default search radius based on pet type
 */
function getDefaultRadius(petSpecies) {
  switch (petSpecies?.toUpperCase()) {
    case 'CAT':
      return 0.5; // Cats usually stay close, hide
    case 'DOG':
      return 1.5; // Dogs can travel further
    case 'BIRD':
      return 2.0; // Birds can fly
    default:
      return 1.0;
  }
}

/**
 * Generate search zones in a grid around center point
 */
async function generateSearchZones(missionId, center, radiusMiles) {
  const zones = [];
  const cellSizeMiles = 0.1; // ~500 feet per cell

  // Calculate grid dimensions
  const cellsPerSide = Math.ceil((radiusMiles * 2) / cellSizeMiles);
  const latOffset = cellSizeMiles / 69; // ~69 miles per degree latitude
  const lngOffset = cellSizeMiles / (69 * Math.cos(center.lat * Math.PI / 180));

  const startLat = center.lat + (radiusMiles / 69);
  const startLng = center.lng - (radiusMiles / (69 * Math.cos(center.lat * Math.PI / 180)));

  for (let row = 0; row < cellsPerSide; row++) {
    for (let col = 0; col < cellsPerSide; col++) {
      const northLat = startLat - (row * latOffset);
      const southLat = northLat - latOffset;
      const westLng = startLng + (col * lngOffset);
      const eastLng = westLng + lngOffset;

      // Calculate distance from center
      const cellCenterLat = (northLat + southLat) / 2;
      const cellCenterLng = (westLng + eastLng) / 2;
      const distanceFromCenter = Math.sqrt(
        Math.pow((cellCenterLat - center.lat) * 69, 2) +
        Math.pow((cellCenterLng - center.lng) * 69 * Math.cos(center.lat * Math.PI / 180), 2)
      );

      // Only include zones within radius
      if (distanceFromCenter <= radiusMiles) {
        // Higher probability closer to center
        const probability = 1 - (distanceFromCenter / radiusMiles);

        zones.push({
          missionId,
          gridRef: `${String.fromCharCode(65 + row)}${col + 1}`, // A1, A2, B1, etc.
          northLat,
          southLat,
          eastLng,
          westLng,
          status: ZONE_STATUS.UNSEARCHED,
          probability,
          priority: probability > 0.7 ? 'HIGH' : probability > 0.4 ? 'MEDIUM' : 'LOW',
        });
      }
    }
  }

  // Bulk create zones
  await prisma.missionZone.createMany({
    data: zones,
    skipDuplicates: true,
  });

  return zones.length;
}

// Push notification functions
async function notifySquadActivation(caseId, missionId) {
  try {
    // Get case and squad info for notification
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        petName: true,
        caseNumber: true,
        lastSeenAddress: true,
        assignment: {
          select: {
            rescueSquad: {
              select: {
                id: true,
                name: true,
                members: {
                  where: { isActive: true },
                  select: { userId: true }
                }
              }
            }
          }
        }
      }
    });

    if (!caseData?.assignment?.rescueSquad) {
      console.log(`No squad assigned to case ${caseId}`);
      return;
    }

    const squad = caseData.assignment.rescueSquad;
    const userIds = squad.members.map(m => m.userId);

    if (userIds.length === 0) {
      console.log(`No active members in squad ${squad.id}`);
      return;
    }

    // Get push subscriptions for these users
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userId: { in: userIds },
        isActive: true,
      },
      select: {
        id: true,
        subscription: true,
      }
    });

    if (subscriptions.length === 0) {
      console.log(`No push subscriptions for squad members`);
      return;
    }

    const formattedSubs = subscriptions.map(sub => ({
      id: sub.id,
      subscription: JSON.parse(sub.subscription),
    }));

    const payload = PUSH_TEMPLATES.SQUAD_ACTIVITY(
      squad.name,
      `🔴 LIVE SEARCH activated for ${caseData.petName}! Tap to join.`,
      squad.id
    );

    // Override URL to go directly to case
    payload.url = `/cases/${caseData.caseNumber}`;
    payload.tag = `mission-${missionId}`;
    payload.requireInteraction = true;

    const result = await sendPushToMany(formattedSubs, payload);
    console.log(`✅ Mission activation notified: ${result.sent} sent, ${result.failed} failed`);

    // Clean up expired subscriptions
    if (result.expired?.length > 0) {
      await prisma.pushSubscription.updateMany({
        where: { id: { in: result.expired } },
        data: { isActive: false },
      });
    }
  } catch (error) {
    console.error('Error sending mission activation notification:', error);
  }
}

async function notifyVolunteersPause(missionId, reason) {
  try {
    // Get active volunteers for this mission
    const volunteers = await prisma.missionVolunteer.findMany({
      where: { missionId, status: 'ACTIVE' },
      select: { userId: true }
    });

    const userIds = volunteers.map(v => v.userId);
    if (userIds.length === 0) return;

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { id: true, subscription: true }
    });

    if (subscriptions.length === 0) return;

    const formattedSubs = subscriptions.map(sub => ({
      id: sub.id,
      subscription: JSON.parse(sub.subscription),
    }));

    const payload = PUSH_TEMPLATES.GENERIC(
      '⏸️ Search Paused',
      reason || 'The search has been temporarily paused.',
      '/'
    );

    await sendPushToMany(formattedSubs, payload);
    console.log(`✅ Mission pause notified to ${subscriptions.length} volunteers`);
  } catch (error) {
    console.error('Error sending pause notification:', error);
  }
}

async function notifyVolunteersResume(missionId) {
  try {
    const volunteers = await prisma.missionVolunteer.findMany({
      where: { missionId },
      select: { userId: true }
    });

    const userIds = volunteers.map(v => v.userId);
    if (userIds.length === 0) return;

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { id: true, subscription: true }
    });

    if (subscriptions.length === 0) return;

    const formattedSubs = subscriptions.map(sub => ({
      id: sub.id,
      subscription: JSON.parse(sub.subscription),
    }));

    const payload = PUSH_TEMPLATES.GENERIC(
      '▶️ Search Resumed',
      'The search has resumed! Return to your area.',
      '/'
    );

    await sendPushToMany(formattedSubs, payload);
    console.log(`✅ Mission resume notified to ${subscriptions.length} volunteers`);
  } catch (error) {
    console.error('Error sending resume notification:', error);
  }
}

export default {
  canActivate,
  activateMission,
  pauseMission,
  resumeMission,
};
