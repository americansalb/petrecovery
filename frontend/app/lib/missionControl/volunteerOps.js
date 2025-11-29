/**
 * Volunteer Operations - The "10-Minute Hero" Experience
 *
 * Zero-friction join, compass view, resource flagging.
 * Design: They go from SMS link to active search in 3 seconds.
 */

import prisma from '@/app/lib/prisma';
import { VOLUNTEER_STATUS, ZONE_STATUS } from './index';
import { getProbabilityMap } from './state';
import { sendPushToMany, PUSH_TEMPLATES } from '@/app/lib/push';

/**
 * Quick join - no account required
 * Creates a temporary volunteer session from SMS/share link
 */
export async function quickJoin(missionId, options = {}) {
  const { deviceId, location, name } = options;

  const mission = await prisma.missionControl.findUnique({
    where: { id: missionId },
    include: { case: true }
  });

  if (!mission) {
    return { success: false, error: 'Mission not found' };
  }

  if (mission.mode === 'INACTIVE' || mission.mode === 'CLOSED') {
    return { success: false, error: 'This search is not currently active' };
  }

  // Create anonymous volunteer record
  const volunteer = await prisma.missionVolunteer.create({
    data: {
      missionId,
      odId: deviceId || generateDeviceId(),
      displayName: name || `Helper ${Math.floor(Math.random() * 1000)}`,
      isAnonymous: !options.userId,
      userId: options.userId || null,
      status: VOLUNTEER_STATUS.ACTIVE,
      joinedAt: new Date(),
      currentLocation: location ? JSON.stringify(location) : null,
      lastLocationUpdate: location ? new Date() : null,
    }
  });

  // Increment volunteer count
  await prisma.missionControl.update({
    where: { id: missionId },
    data: {
      totalVolunteersJoined: { increment: 1 },
    }
  });

  // Get best zone assignment based on location
  const assignment = await getSmartAssignment(missionId, location);

  // Log join
  await prisma.missionLog.create({
    data: {
      missionId,
      action: 'VOLUNTEER_JOINED',
      details: JSON.stringify({
        odId: volunteer.odId,
        anonymous: volunteer.isAnonymous,
      }),
    }
  });

  return {
    success: true,
    volunteerId: volunteer.id,
    sessionToken: generateSessionToken(volunteer.id),
    assignment,
    pet: {
      name: mission.case.petName,
      species: mission.case.petSpecies,
      photoUrl: mission.case.petPhotoUrl,
      color: mission.case.petColor,
      description: mission.case.petDescription,
    },
  };
}

/**
 * Get smart zone assignment based on volunteer location and probability
 */
async function getSmartAssignment(missionId, volunteerLocation) {
  if (!volunteerLocation) {
    return {
      type: 'GENERAL',
      directive: 'Head toward the last seen location',
      details: null,
    };
  }

  // Get probability map
  const zones = await getProbabilityMap(missionId);

  // Find nearest high-probability unassigned zone
  const availableZones = zones
    ?.filter(z => z.status === ZONE_STATUS.UNSEARCHED || z.status === ZONE_STATUS.STALE)
    ?.filter(z => !z.assignedToId);

  if (!availableZones?.length) {
    return {
      type: 'FLEXIBLE',
      directive: 'All zones covered! Patrol the area and watch for movement',
      details: null,
    };
  }

  // Sort by combination of probability and distance
  const scoredZones = availableZones.map(zone => {
    const zoneCenterLat = (zone.northLat + zone.southLat) / 2;
    const zoneCenterLng = (zone.eastLng + zone.westLng) / 2;
    const distance = calculateDistance(volunteerLocation, {
      lat: zoneCenterLat,
      lng: zoneCenterLng,
    });

    // Score: higher probability and closer = better
    const score = zone.probability * (1 / (distance + 0.1));

    return { ...zone, distance, score };
  }).sort((a, b) => b.score - a.score);

  const bestZone = scoredZones[0];

  // Generate compass directive
  const directive = generateDirective(volunteerLocation, {
    lat: (bestZone.northLat + bestZone.southLat) / 2,
    lng: (bestZone.eastLng + bestZone.westLng) / 2,
  }, bestZone);

  return {
    type: 'ZONE',
    zoneId: bestZone.id,
    gridRef: bestZone.gridRef,
    directive,
    distance: bestZone.distance,
    priority: bestZone.priority,
  };
}

/**
 * Generate human-readable compass directive
 */
function generateDirective(from, to, zone) {
  const bearing = calculateBearing(from, to);
  const direction = bearingToCardinal(bearing);
  const distanceFeet = Math.round(zone.distance * 5280);

  let distanceText;
  if (distanceFeet < 500) {
    distanceText = `${distanceFeet} feet`;
  } else {
    distanceText = `${(zone.distance).toFixed(1)} miles`;
  }

  // Create actionable directive
  const searchTips = getSearchTips(zone);

  return {
    heading: direction,
    distance: distanceText,
    text: `Walk ${direction.toLowerCase()} ${distanceText}`,
    tips: searchTips,
    arrow: getArrowEmoji(bearing),
  };
}

function getSearchTips(zone) {
  const tips = ['Keep eyes low - check under bushes, porches, cars'];

  if (zone.priority === 'HIGH') {
    tips.unshift('HIGH PRIORITY ZONE - Recent activity here');
  }

  if (zone.status === ZONE_STATUS.STALE) {
    tips.push('This area was searched earlier - look again carefully');
  }

  return tips;
}

function calculateBearing(from, to) {
  const dLng = (to.lng - from.lng) * Math.PI / 180;
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

function bearingToCardinal(bearing) {
  const directions = ['North', 'Northeast', 'East', 'Southeast',
                      'South', 'Southwest', 'West', 'Northwest'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

function getArrowEmoji(bearing) {
  const arrows = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];
  const index = Math.round(bearing / 45) % 8;
  return arrows[index];
}

function calculateDistance(from, to) {
  const R = 3959; // Earth radius in miles
  const dLat = (to.lat - from.lat) * Math.PI / 180;
  const dLng = (to.lng - from.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Update volunteer location and get new directive if needed
 */
export async function updateLocation(volunteerId, location) {
  const volunteer = await prisma.missionVolunteer.update({
    where: { id: volunteerId },
    data: {
      currentLocation: JSON.stringify(location),
      lastLocationUpdate: new Date(),
    },
    include: { mission: true }
  });

  // Store path point
  await prisma.volunteerPath.create({
    data: {
      missionId: volunteer.missionId,
      odId: volunteer.odId,
      latitude: location.lat,
      longitude: location.lng,
      accuracy: location.accuracy,
    }
  });

  // Check if volunteer has entered their assigned zone
  const assignedZone = await getAssignedZone(volunteerId);
  let inZone = false;
  if (assignedZone) {
    inZone = isInBounds(location, assignedZone);
    if (inZone && assignedZone.status === ZONE_STATUS.UNSEARCHED) {
      await prisma.missionZone.update({
        where: { id: assignedZone.id },
        data: { status: ZONE_STATUS.IN_PROGRESS }
      });
    }
  }

  return {
    success: true,
    inAssignedZone: inZone,
  };
}

async function getAssignedZone(volunteerId) {
  const volunteer = await prisma.missionVolunteer.findUnique({
    where: { id: volunteerId },
    select: { assignedZoneId: true }
  });

  if (!volunteer?.assignedZoneId) return null;

  return prisma.missionZone.findUnique({
    where: { id: volunteer.assignedZoneId }
  });
}

function isInBounds(location, zone) {
  return location.lat <= zone.northLat &&
         location.lat >= zone.southLat &&
         location.lng <= zone.eastLng &&
         location.lng >= zone.westLng;
}

/**
 * Flag volunteer resources
 */
export async function flagResources(volunteerId, resources) {
  // resources: ['CAR', 'TRAP', 'FLYERS', 'TREATS', 'CARRIER']
  await prisma.missionVolunteer.update({
    where: { id: volunteerId },
    data: {
      resources: JSON.stringify(resources),
    }
  });

  // Also add to mission resources pool
  const volunteer = await prisma.missionVolunteer.findUnique({
    where: { id: volunteerId },
    select: { missionId: true, currentLocation: true }
  });

  for (const resource of resources) {
    await prisma.missionResource.upsert({
      where: {
        missionId_type_volunteerId: {
          missionId: volunteer.missionId,
          type: resource,
          volunteerId,
        }
      },
      create: {
        missionId: volunteer.missionId,
        type: resource,
        volunteerId,
        location: volunteer.currentLocation,
        available: true,
      },
      update: {
        location: volunteer.currentLocation,
        available: true,
      }
    });
  }

  return { success: true };
}

/**
 * Quick signals - non-verbal communication
 */
export async function sendSignal(volunteerId, signalType, location) {
  const volunteer = await prisma.missionVolunteer.findUnique({
    where: { id: volunteerId },
    include: { mission: true }
  });

  const signal = await prisma.volunteerSignal.create({
    data: {
      missionId: volunteer.missionId,
      odId: volunteer.odId,
      signalType, // 'NEED_BACKUP', 'AREA_CLEAR', 'TAKING_BREAK', 'HEADING_HOME'
      latitude: location?.lat,
      longitude: location?.lng,
    }
  });

  // Notify relevant parties based on signal type
  if (signalType === 'NEED_BACKUP') {
    await notifyNearbyVolunteers(volunteer.missionId, location, 'Volunteer needs backup!');
  }

  return { success: true, signalId: signal.id };
}

/**
 * Check in for a shift
 */
export async function checkIn(volunteerId, estimatedMinutes) {
  await prisma.missionVolunteer.update({
    where: { id: volunteerId },
    data: {
      status: VOLUNTEER_STATUS.ACTIVE,
      shiftStartedAt: new Date(),
      estimatedEndTime: estimatedMinutes
        ? new Date(Date.now() + estimatedMinutes * 60000)
        : null,
    }
  });

  return { success: true };
}

/**
 * Check out from shift
 */
export async function checkOut(volunteerId) {
  const volunteer = await prisma.missionVolunteer.update({
    where: { id: volunteerId },
    data: {
      status: VOLUNTEER_STATUS.OFFLINE,
      shiftEndedAt: new Date(),
      assignedZoneId: null,
    },
    include: { mission: true }
  });

  // Release any assigned zone
  if (volunteer.assignedZoneId) {
    await prisma.missionZone.update({
      where: { id: volunteer.assignedZoneId },
      data: {
        assignedToId: null,
        status: ZONE_STATUS.UNSEARCHED,
      }
    });
  }

  // Calculate contribution
  const shiftMinutes = volunteer.shiftStartedAt
    ? Math.round((Date.now() - new Date(volunteer.shiftStartedAt).getTime()) / 60000)
    : 0;

  return {
    success: true,
    summary: {
      minutesSearched: shiftMinutes,
      // Could add zones cleared, distance covered, etc.
    }
  };
}

// Helpers
function generateDeviceId() {
  return 'anon_' + Math.random().toString(36).substring(2, 15);
}

function generateSessionToken(odId) {
  // In production, use proper JWT
  return Buffer.from(`${odId}:${Date.now()}`).toString('base64');
}

async function notifyNearbyVolunteers(missionId, location, message) {
  try {
    // Get active volunteers for this mission
    const volunteers = await prisma.missionVolunteer.findMany({
      where: { missionId, status: 'ACTIVE' },
      select: { userId: true, currentLocation: true }
    });

    // Filter by proximity if location provided (within 1 mile)
    let targetUserIds = volunteers.map(v => v.userId).filter(Boolean);

    if (location && targetUserIds.length > 0) {
      const nearbyVolunteers = volunteers.filter(v => {
        if (!v.currentLocation) return true; // Include if no location
        const vLoc = JSON.parse(v.currentLocation);
        const distance = haversineDistance(
          location.lat, location.lng,
          vLoc.lat, vLoc.lng
        );
        return distance <= 1; // Within 1 mile
      });
      targetUserIds = nearbyVolunteers.map(v => v.userId).filter(Boolean);
    }

    if (targetUserIds.length === 0) return;

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: { in: targetUserIds }, isActive: true },
      select: { id: true, subscription: true }
    });

    if (subscriptions.length === 0) return;

    const formattedSubs = subscriptions.map(sub => ({
      id: sub.id,
      subscription: JSON.parse(sub.subscription),
    }));

    const payload = PUSH_TEMPLATES.GENERIC(
      '📍 Nearby Update',
      message,
      '/'
    );
    payload.tag = `mission-${missionId}-update`;

    const result = await sendPushToMany(formattedSubs, payload);
    console.log(`✅ Nearby volunteers notified: ${result.sent} sent`);
  } catch (error) {
    console.error('Error notifying nearby volunteers:', error);
  }
}

// Haversine distance calculation (miles)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default {
  quickJoin,
  updateLocation,
  flagResources,
  sendSignal,
  checkIn,
  checkOut,
};
