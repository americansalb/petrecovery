/**
 * Geofence and Location Services
 * Provides location-based alerts for lost pet cases
 */

import prisma from '@/app/lib/prisma';
import { sendPushToUser } from '@/app/lib/push';
import { createInAppNotification } from '@/app/lib/notifications-inapp';

/**
 * Calculate distance between two coordinates in miles
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Find active cases near a location
 */
export async function findNearbyCases(latitude, longitude, radiusMiles = 5) {
  // Get all active cases
  const activeMissions = await prisma.case.findMany({
    where: {
      status: { in: ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'] },
    },
    select: {
      id: true,
      missionNumber: true,
      petName: true,
      petSpecies: true,
      petPhotoUrl: true,
      lastSeenLatitude: true,
      lastSeenLongitude: true,
      lastSeenAddress: true,
      searchRadius: true,
    },
  });

  // Filter by distance
  const nearbyMissions = activeMissions.filter((c) => {
    if (!c.lastSeenLatitude || !c.lastSeenLongitude) return false;
    const distance = calculateDistance(
      latitude, longitude,
      c.lastSeenLatitude, c.lastSeenLongitude
    );
    return distance <= (c.searchRadius || radiusMiles);
  });

  return nearbyMissions.map((c) => ({
    ...c,
    distance: calculateDistance(
      latitude, longitude,
      c.lastSeenLatitude, c.lastSeenLongitude
    ),
  })).sort((a, b) => a.distance - b.distance);
}

/**
 * Check if user is entering a case search zone
 */
export async function checkGeofenceEntry(userId, latitude, longitude) {
  const nearbyMissions = await findNearbyCases(latitude, longitude, 2);

  if (nearbyMissions.length === 0) return [];

  const notifications = [];

  for (const nearbyCase of nearbyMissions.slice(0, 3)) {
    // Check if we've already notified this user about this case recently
    const recentNotification = await prisma.notification.findFirst({
      where: {
        userId,
        type: 'SIGHTING',
        data: { contains: nearbyCase.missionNumber },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (recentNotification) continue;

    const notification = {
      title: `Lost ${nearbyCase.petSpecies}: ${nearbyCase.petName}`,
      body: `You're near where ${nearbyCase.petName} was last seen (${nearbyCase.distance.toFixed(1)} miles). Keep an eye out!`,
      url: `/missions/${nearbyCase.missionNumber}`,
      data: { missionNumber: nearbyCase.missionNumber, type: 'geofence' },
    };

    // Send push notification
    await sendPushToUser(userId, notification);

    // Create in-app notification
    await createInAppNotification({
      userId,
      type: 'SIGHTING',
      title: notification.title,
      message: notification.body,
      actionUrl: notification.url,
      data: { missionNumber: nearbyCase.missionNumber, distance: nearbyCase.distance },
    });

    notifications.push(notification);
  }

  return notifications;
}

/**
 * Get cases within a bounding box (for map views)
 */
export async function getCasesInBounds(northEast, southWest) {
  return prisma.case.findMany({
    where: {
      status: { in: ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'] },
      lastSeenLatitude: {
        gte: southWest.lat,
        lte: northEast.lat,
      },
      lastSeenLongitude: {
        gte: southWest.lng,
        lte: northEast.lng,
      },
    },
    select: {
      id: true,
      missionNumber: true,
      petName: true,
      petSpecies: true,
      petPhotoUrl: true,
      lastSeenLatitude: true,
      lastSeenLongitude: true,
      status: true,
      createdAt: true,
    },
  });
}

/**
 * Update user's last known location
 */
export async function updateUserLocation(userId, latitude, longitude) {
  await prisma.userProfile.upsert({
    where: { userId },
    update: { latitude, longitude },
    create: { userId, latitude, longitude },
  });

  // Check for nearby cases
  return checkGeofenceEntry(userId, latitude, longitude);
}

/**
 * Get rescue forces covering a location
 */
export async function getSquadsCoveringLocation(latitude, longitude) {
  const squads = await prisma.rescueSquad.findMany({
    where: {
      isActive: true,
      isAcceptingCases: true,
    },
    select: {
      id: true,
      name: true,
      centerLatitude: true,
      centerLongitude: true,
      radiusMiles: true,
      city: true,
      state: true,
      _count: { select: { members: { where: { isActive: true } } } },
    },
  });

  return squads.filter((squad) => {
    if (!squad.centerLatitude || !squad.centerLongitude) return false;
    const distance = calculateDistance(
      latitude, longitude,
      squad.centerLatitude, squad.centerLongitude
    );
    return distance <= (squad.radiusMiles || 10);
  }).map((squad) => ({
    ...squad,
    memberCount: squad._count.members,
    distance: calculateDistance(
      latitude, longitude,
      squad.centerLatitude, squad.centerLongitude
    ),
  }));
}
