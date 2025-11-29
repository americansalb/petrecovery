/**
 * Owner Hub - The Pet Owner Experience
 *
 * The owner is not passive - they're the most important asset.
 * Scent, voice, trust.
 *
 * Features:
 * - Broadcast location ("I'm at the park with treats")
 * - Call Mode (coordinated audio playback)
 * - Status updates
 * - Verified sightings only (noise filtering)
 */

import prisma from '@/app/lib/prisma';

/**
 * Get owner's mission view
 * Filtered to show effort, not raw tactical data
 */
export async function getOwnerView(missionId, ownerId) {
  const mission = await prisma.missionControl.findUnique({
    where: { id: missionId },
    include: {
      case: {
        include: {
          reporter: true,
        }
      },
      activeVolunteers: true,
      zones: true,
      sightings: {
        where: {
          OR: [
            { verified: true },
            { priority: 'CONFIRMED' },
            { priority: 'HIGH' },
          ]
        },
        orderBy: { createdAt: 'desc' },
      },
    }
  });

  if (!mission) {
    return { error: 'Mission not found' };
  }

  // Verify owner
  if (mission.case.reporterId !== ownerId) {
    return { error: 'Unauthorized' };
  }

  return {
    pet: {
      name: mission.case.petName,
      photoUrl: mission.case.petPhotoUrl,
    },

    // The "Pulse" - visual representation of effort
    pulse: {
      activeSearchers: mission.activeVolunteers.length,
      totalHelpers: mission.totalVolunteersJoined,
      percentSearched: mission.zones.length
        ? Math.round((mission.zones.filter(z => z.status === 'SEARCHED').length / mission.zones.length) * 100)
        : 0,
      hoursActive: mission.activatedAt
        ? Math.round((Date.now() - new Date(mission.activatedAt).getTime()) / 3600000)
        : 0,
    },

    // Searcher positions for "pulse" visualization (anonymized)
    searcherPositions: mission.activeVolunteers
      .filter(v => v.currentLocation)
      .map(v => {
        const loc = JSON.parse(v.currentLocation);
        return { lat: loc.lat, lng: loc.lng };
      }),

    // Verified sightings only - filtered for owner sanity
    sightings: mission.sightings.map(s => ({
      id: s.id,
      time: s.createdAt,
      location: { lat: s.latitude, lng: s.longitude },
      verified: s.verified,
      priority: s.priority,
      notes: s.notes,
      photoUrl: s.photoUrl,
    })),

    // Owner's current status/location
    ownerStatus: {
      currentActivity: mission.ownerStatus,
      location: mission.ownerLocation ? JSON.parse(mission.ownerLocation) : null,
      broadcast: mission.ownerBroadcast,
    },

    // Call mode status
    callMode: {
      active: mission.callModeActive,
      audioUrl: mission.ownerVoiceClipUrl,
      lastTriggered: mission.callModeLastTriggered,
    },

    // Mode
    mode: mission.mode,
    isContainment: mission.mode === 'CONTAINMENT',
  };
}

/**
 * Update owner's location and activity status
 */
export async function updateOwnerStatus(missionId, ownerId, statusData) {
  const { location, activity, broadcast } = statusData;

  const mission = await prisma.missionControl.findUnique({
    where: { id: missionId },
    include: { case: true }
  });

  if (mission.case.reporterId !== ownerId) {
    return { success: false, error: 'Unauthorized' };
  }

  await prisma.missionControl.update({
    where: { id: missionId },
    data: {
      ownerLocation: location ? JSON.stringify(location) : undefined,
      ownerStatus: activity, // 'AT_HOME', 'SEARCHING', 'AT_SHELTER', 'MAKING_FLYERS', etc.
      ownerBroadcast: broadcast,
      ownerLastUpdate: new Date(),
    }
  });

  // Log for volunteers to see
  await prisma.missionLog.create({
    data: {
      missionId,
      action: 'OWNER_STATUS_UPDATE',
      details: JSON.stringify({ activity, broadcast }),
      userId: ownerId,
    }
  });

  // Notify active volunteers if broadcast changed
  if (broadcast) {
    await notifyVolunteersOwnerBroadcast(missionId, broadcast, location);
  }

  return { success: true };
}

/**
 * Upload voice clip for Call Mode
 */
export async function uploadVoiceClip(missionId, ownerId, audioUrl) {
  const mission = await prisma.missionControl.findUnique({
    where: { id: missionId },
    include: { case: true }
  });

  if (mission.case.reporterId !== ownerId) {
    return { success: false, error: 'Unauthorized' };
  }

  await prisma.missionControl.update({
    where: { id: missionId },
    data: {
      ownerVoiceClipUrl: audioUrl,
    }
  });

  return { success: true, audioUrl };
}

/**
 * Trigger Call Mode - play owner's voice across all volunteer phones
 */
export async function triggerCallMode(missionId, triggeredBy) {
  const mission = await prisma.missionControl.findUnique({
    where: { id: missionId },
  });

  if (!mission.ownerVoiceClipUrl) {
    return { success: false, error: 'No voice clip uploaded' };
  }

  await prisma.missionControl.update({
    where: { id: missionId },
    data: {
      callModeActive: true,
      callModeLastTriggered: new Date(),
    }
  });

  // Get all active volunteers
  const volunteers = await prisma.missionVolunteer.findMany({
    where: {
      missionId,
      status: 'ACTIVE',
    }
  });

  // Send push notification with audio playback instruction
  await broadcastCallMode(missionId, mission.ownerVoiceClipUrl, volunteers);

  await prisma.missionLog.create({
    data: {
      missionId,
      action: 'CALL_MODE_TRIGGERED',
      details: JSON.stringify({ triggeredBy, volunteerCount: volunteers.length }),
    }
  });

  return {
    success: true,
    volunteersNotified: volunteers.length,
  };
}

/**
 * Stop Call Mode
 */
export async function stopCallMode(missionId) {
  await prisma.missionControl.update({
    where: { id: missionId },
    data: {
      callModeActive: false,
    }
  });

  return { success: true };
}

/**
 * Send thank you message to volunteers (after resolution)
 */
export async function sendThankYou(missionId, ownerId, message, photoUrl) {
  const mission = await prisma.missionControl.findUnique({
    where: { id: missionId },
    include: {
      case: true,
      activeVolunteers: true,
    }
  });

  if (mission.case.reporterId !== ownerId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Create thank you record
  const thankYou = await prisma.missionThankYou.create({
    data: {
      missionId,
      message,
      photoUrl, // Reunion photo
      sentAt: new Date(),
    }
  });

  // Get all volunteers who participated (not just active)
  const allVolunteers = await prisma.missionVolunteer.findMany({
    where: { missionId },
    include: {
      user: { select: { id: true, email: true } }
    }
  });

  // Send thank you notification to all
  await broadcastThankYou(missionId, thankYou, allVolunteers);

  return {
    success: true,
    recipientCount: allVolunteers.length,
  };
}

/**
 * Get filtered sightings for owner
 * Only shows verified or high-confidence sightings
 */
export async function getFilteredSightings(missionId, ownerId) {
  const mission = await prisma.missionControl.findUnique({
    where: { id: missionId },
    include: { case: true }
  });

  if (mission.case.reporterId !== ownerId) {
    return { error: 'Unauthorized' };
  }

  const sightings = await prisma.missionSighting.findMany({
    where: {
      missionId,
      OR: [
        { verified: true },
        { priority: 'CONFIRMED' },
        { priority: 'HIGH' },
      ]
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    sightings: sightings.map(s => ({
      id: s.id,
      time: s.createdAt,
      timeAgo: getTimeAgo(s.createdAt),
      location: {
        lat: s.latitude,
        lng: s.longitude,
      },
      verified: s.verified,
      priority: s.priority,
      photoUrl: s.photoUrl,
      notes: s.notes,
    })),
    lastUpdate: sightings[0]?.createdAt || null,
  };
}

function getTimeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

// Pre-defined owner activity statuses
export const OWNER_ACTIVITIES = [
  { id: 'AT_HOME', label: 'At home', icon: '🏠' },
  { id: 'SEARCHING', label: 'Out searching', icon: '🔍' },
  { id: 'AT_SHELTER', label: 'Checking shelter', icon: '🏥' },
  { id: 'MAKING_FLYERS', label: 'Making flyers', icon: '📄' },
  { id: 'SETTING_TRAP', label: 'Setting trap', icon: '🪤' },
  { id: 'WAITING_SIGHTING', label: 'At sighting location', icon: '📍' },
  { id: 'WITH_PET', label: 'With pet!', icon: '❤️' },
];

// Notification stubs
async function notifyVolunteersOwnerBroadcast(missionId, broadcast, location) {
  console.log(`Owner broadcast for mission ${missionId}: ${broadcast}`);
}

async function broadcastCallMode(missionId, audioUrl, volunteers) {
  console.log(`Call mode triggered for mission ${missionId} to ${volunteers.length} volunteers`);
}

async function broadcastThankYou(missionId, thankYou, volunteers) {
  console.log(`Thank you sent for mission ${missionId} to ${volunteers.length} volunteers`);
}

export default {
  getOwnerView,
  updateOwnerStatus,
  uploadVoiceClip,
  triggerCallMode,
  stopCallMode,
  sendThankYou,
  getFilteredSightings,
  OWNER_ACTIVITIES,
};
