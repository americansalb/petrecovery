/**
 * End States - Lifecycle Closures
 *
 * Success: Pet found alive - celebrate and stand down
 * Grief: Pet found deceased - handle with dignity
 * Cold Case: Search paused after extended time
 */

import prisma from '@/app/lib/prisma';
import { OPERATION_MODES } from './index';

/**
 * Resolve mission - Pet found alive
 */
export async function resolvePetFound(missionId, resolveData, resolvedBy) {
  const { foundLocation, foundById, reunionPhotoUrl, notes } = resolveData;

  const mission = await prisma.missionControl.findUnique({
    where: { id: missionId },
    include: {
      case: true,
      activeVolunteers: true,
    }
  });

  // Update mission
  await prisma.missionControl.update({
    where: { id: missionId },
    data: {
      mode: OPERATION_MODES.RESOLVED,
      resolvedAt: new Date(),
      resolutionType: 'FOUND_ALIVE',
      foundLocation: foundLocation ? JSON.stringify(foundLocation) : null,
      foundById,
      reunionPhotoUrl,
      resolutionNotes: notes,
    }
  });

  // Update case
  await prisma.case.update({
    where: { id: mission.missionId },
    data: {
      status: 'RESOLVED',
      foundAt: new Date(),
      foundById,
    }
  });

  // Notify all volunteers - CELEBRATION
  await broadcastResolution(mission, 'FOUND_ALIVE', {
    petName: mission.case.petName,
    reunionPhotoUrl,
  });

  // Calculate and save stats
  const stats = await calculateMissionStats(missionId);

  // Log resolution
  await prisma.missionLog.create({
    data: {
      missionId,
      action: 'MISSION_RESOLVED',
      details: JSON.stringify({
        type: 'FOUND_ALIVE',
        foundById,
        stats,
      }),
      userId: resolvedBy,
    }
  });

  // Generate shareable victory card
  const victoryCard = await generateVictoryCard(mission, stats, reunionPhotoUrl);

  return {
    success: true,
    type: 'FOUND_ALIVE',
    stats,
    victoryCard,
    celebrationMessage: getCelebrationMessage(mission.case.petName, stats),
  };
}

/**
 * Resolve mission - Pet found deceased
 * Handle with dignity and privacy
 */
export async function resolvePetDeceased(missionId, resolveData, resolvedBy) {
  const { location, notes, notifyVolunteers = false } = resolveData;

  const mission = await prisma.missionControl.findUnique({
    where: { id: missionId },
    include: { case: true }
  });

  // Update mission
  await prisma.missionControl.update({
    where: { id: missionId },
    data: {
      mode: OPERATION_MODES.CLOSED,
      resolvedAt: new Date(),
      resolutionType: 'FOUND_DECEASED',
      foundLocation: location ? JSON.stringify(location) : null,
      resolutionNotes: notes,
    }
  });

  // Update case - minimal public info
  await prisma.case.update({
    where: { id: mission.missionId },
    data: {
      status: 'CLOSED_OTHER', // Generic closure, respects privacy
      closedAt: new Date(),
    }
  });

  // Only send minimal notification if owner chooses
  if (notifyVolunteers) {
    await broadcastResolution(mission, 'CLOSED', {
      petName: mission.case.petName,
      message: 'The search has ended. Thank you for your help.',
    });
  } else {
    // Silent stand-down
    await silentStandDown(missionId);
  }

  await prisma.missionLog.create({
    data: {
      missionId,
      action: 'MISSION_RESOLVED',
      details: JSON.stringify({ type: 'FOUND_DECEASED' }),
      userId: resolvedBy,
    }
  });

  return {
    success: true,
    type: 'CLOSED',
    message: 'We are so sorry for your loss. The search has been closed.',
  };
}

/**
 * Pause to cold case
 */
export async function pauseToColdCase(missionId, pauseData, pausedBy) {
  const { reason, resumeConditions } = pauseData;

  const mission = await prisma.missionControl.findUnique({
    where: { id: missionId },
    include: { case: true }
  });

  await prisma.missionControl.update({
    where: { id: missionId },
    data: {
      mode: OPERATION_MODES.STANDBY,
      pausedAt: new Date(),
      pausedById: pausedBy,
      pauseReason: reason || 'Extended search without resolution',
      coldCaseAt: new Date(),
      resumeConditions,
    }
  });

  // Update case status
  await prisma.case.update({
    where: { id: mission.missionId },
    data: {
      status: 'OPEN', // Still open, but search paused
    }
  });

  // Notify volunteers
  await broadcastResolution(mission, 'PAUSED', {
    petName: mission.case.petName,
    message: 'Active search paused. Case remains open for tips.',
    resumeConditions,
  });

  // Calculate stats for the search period
  const stats = await calculateMissionStats(missionId);

  await prisma.missionLog.create({
    data: {
      missionId,
      action: 'MISSION_PAUSED_COLD_CASE',
      details: JSON.stringify({ reason, stats }),
      userId: pausedBy,
    }
  });

  return {
    success: true,
    type: 'COLD_CASE',
    stats,
    message: 'Search paused. Case remains open for sighting tips.',
  };
}

/**
 * Resume from cold case
 */
export async function resumeFromColdCase(missionId, resumeData, resumedBy) {
  const { reason, newSighting } = resumeData;

  await prisma.missionControl.update({
    where: { id: missionId },
    data: {
      mode: OPERATION_MODES.LIVE_SEARCH,
      pausedAt: null,
      coldCaseAt: null,
      resumedAt: new Date(),
      resumeReason: reason,
    }
  });

  // Notify previous volunteers
  await notifyPreviousVolunteers(missionId, reason, newSighting);

  await prisma.missionLog.create({
    data: {
      missionId,
      action: 'MISSION_RESUMED',
      details: JSON.stringify({ reason, newSighting }),
      userId: resumedBy,
    }
  });

  return {
    success: true,
    mode: OPERATION_MODES.LIVE_SEARCH,
  };
}

/**
 * Calculate mission statistics
 */
async function calculateMissionStats(missionId) {
  const mission = await prisma.missionControl.findUnique({
    where: { id: missionId },
    include: {
      zones: true,
      sightings: true,
      activeVolunteers: true,
    }
  });

  const volunteers = await prisma.missionVolunteer.findMany({
    where: { missionId }
  });

  const pathPoints = await prisma.volunteerPath.count({
    where: { missionId }
  });

  const durationHours = mission.activatedAt
    ? Math.round((Date.now() - new Date(mission.activatedAt).getTime()) / 3600000)
    : 0;

  // Estimate distance covered (rough calculation from path points)
  const estimatedMilesCovered = pathPoints * 0.01; // Rough estimate

  return {
    durationHours,
    totalVolunteers: volunteers.length,
    peakActiveVolunteers: mission.peakVolunteers || volunteers.length,
    zonesSearched: mission.zones.filter(z => z.status === 'SEARCHED').length,
    totalZones: mission.zones.length,
    sightingsReported: mission.sightings.length,
    verifiedSightings: mission.sightings.filter(s => s.verified).length,
    estimatedMilesCovered: Math.round(estimatedMilesCovered * 10) / 10,
    totalSearchHours: volunteers.reduce((sum, v) => {
      if (v.shiftStartedAt) {
        const endTime = v.shiftEndedAt || new Date();
        const hours = (new Date(endTime) - new Date(v.shiftStartedAt)) / 3600000;
        return sum + hours;
      }
      return sum;
    }, 0),
  };
}

/**
 * Generate shareable victory card
 */
async function generateVictoryCard(mission, stats, reunionPhotoUrl) {
  // In production, this would generate an actual shareable image
  return {
    title: `${mission.case.petName} is HOME!`,
    subtitle: 'Thanks to our amazing community',
    stats: {
      volunteers: stats.totalVolunteers,
      hours: Math.round(stats.totalSearchHours),
      coverage: `${stats.zonesSearched}/${stats.totalZones} zones`,
    },
    photoUrl: reunionPhotoUrl || mission.case.petPhotoUrl,
    shareText: `${mission.case.petName} is home safe! Thank you to the ${stats.totalVolunteers} volunteers who searched for ${Math.round(stats.durationHours)} hours. Community makes miracles happen! #ReunitePets`,
    shareUrl: `https://www.reunitepets.org/cases/${mission.case.missionNumber}/success`,
  };
}

function getCelebrationMessage(petName, stats) {
  const messages = [
    `${petName} is HOME! 🎉 Thanks to ${stats.totalVolunteers} incredible volunteers!`,
    `MIRACLE! ${petName} is safe! ${stats.totalVolunteers} people, ${Math.round(stats.durationHours)} hours, ONE community!`,
    `${petName} is back with their family! This is what community looks like. 💙`,
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Silent stand down - for grief situations
 */
async function silentStandDown(missionId) {
  // Mark all active volunteers as offline without notification
  await prisma.missionVolunteer.updateMany({
    where: {
      missionId,
      status: { not: 'OFFLINE' }
    },
    data: {
      status: 'OFFLINE',
      shiftEndedAt: new Date(),
    }
  });
}

// Notification stubs
async function broadcastResolution(mission, type, data) {
  console.log(`Resolution broadcast for mission ${mission.id}: ${type}`, data);
}

async function notifyPreviousVolunteers(missionId, reason, newSighting) {
  console.log(`Resuming mission ${missionId}: ${reason}`);
}

export default {
  resolvePetFound,
  resolvePetDeceased,
  pauseToColdCase,
  resumeFromColdCase,
  calculateMissionStats,
};
