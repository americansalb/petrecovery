/**
 * Phase 6: Division Alerts
 *
 * Neighborhood-specific notifications that feel personal.
 * "Lost dog in YOUR area (Lincoln Park)"
 */

import prisma from '@/app/lib/prisma';
import { sendPushToMany } from '@/app/lib/push';

/**
 * Send alert to specific division
 */
export async function sendDivisionAlert(divisionId, alert) {
  const { type, title, body, missionId, priority = 'NORMAL' } = alert;

  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    include: {
      members: {
        where: { isActive: true },
        include: {
          user: {
            include: {
              pushSubscriptions: true,
            }
          }
        }
      },
      rescueSquad: true,
    }
  });

  if (!division) {
    return { success: false, error: 'Division not found' };
  }

  // Collect all push subscriptions
  const subscriptions = [];
  for (const member of division.members) {
    for (const sub of member.user.pushSubscriptions) {
      subscriptions.push({
        id: sub.id,
        subscription: JSON.parse(sub.subscription),
      });
    }
  }

  // Create alert record
  const alertRecord = await prisma.divisionAlert.create({
    data: {
      divisionId,
      missionId,
      type,
      title,
      body,
      priority,
      sentAt: new Date(),
      recipientCount: subscriptions.length,
    }
  });

  // Send push notifications
  const payload = {
    title: `📍 ${division.name}: ${title}`,
    body,
    icon: '/icons/alert-icon.png',
    tag: `division-${divisionId}-${missionId || 'general'}`,
    data: {
      type: 'DIVISION_ALERT',
      divisionId,
      missionId,
      alertId: alertRecord.id,
      url: missionId ? `/search/${missionId}` : `/divisions/${divisionId}`,
    },
    requireInteraction: priority === 'URGENT',
  };

  const result = await sendPushToMany(subscriptions, payload);

  // Update alert with send results
  await prisma.divisionAlert.update({
    where: { id: alertRecord.id },
    data: {
      deliveredCount: result.sent,
      failedCount: result.failed,
    }
  });

  return {
    success: true,
    alertId: alertRecord.id,
    sent: result.sent,
    failed: result.failed,
  };
}

/**
 * Alert all divisions in a squad about a new case
 */
export async function alertSquadNewCase(squadId, missionData) {
  const squad = await prisma.rescueSquad.findUnique({
    where: { id: squadId },
    include: {
      divisions: {
        where: { isActive: true },
      }
    }
  });

  if (!squad) {
    return { success: false, error: 'Force not found' };
  }

  const results = [];

  // Find which division(s) are closest to the case
  const nearestDivisions = findNearestDivisions(
    squad.divisions,
    missionData.lastSeenLatitude,
    missionData.lastSeenLongitude,
    2 // Get top 2 nearest
  );

  // Send URGENT alert to nearest divisions
  for (const division of nearestDivisions) {
    const result = await sendDivisionAlert(division.id, {
      type: 'NEW_CASE',
      title: `Lost ${missionData.petSpecies}: ${missionData.petName}`,
      body: `Lost near ${missionData.lastSeenAddress || 'your area'}. Help search!`,
      missionId: missionData.id,
      priority: 'URGENT',
    });
    results.push({ divisionId: division.id, ...result });
  }

  // Send NORMAL alert to other divisions
  const otherDivisions = squad.divisions.filter(
    d => !nearestDivisions.find(nd => nd.id === d.id)
  );

  for (const division of otherDivisions) {
    const result = await sendDivisionAlert(division.id, {
      type: 'NEW_CASE',
      title: `New case in ${squad.name}`,
      body: `${missionData.petName} (${missionData.petSpecies}) lost nearby`,
      missionId: missionData.id,
      priority: 'NORMAL',
    });
    results.push({ divisionId: division.id, ...result });
  }

  return {
    success: true,
    results,
    urgentDivisions: nearestDivisions.map(d => d.name),
  };
}

/**
 * Alert division about a sighting in their area
 */
export async function alertDivisionSighting(sighting) {
  // Find division that covers this location
  const division = await findDivisionByLocation(
    sighting.latitude,
    sighting.longitude
  );

  if (!division) {
    return { success: false, error: 'No division covers this area' };
  }

  const missionData = await prisma.case.findUnique({
    where: { id: sighting.missionId },
    select: { petName: true, petSpecies: true }
  });

  return sendDivisionAlert(division.id, {
    type: 'SIGHTING',
    title: `Possible ${missionData.petName} sighting!`,
    body: `Near ${sighting.address || 'your area'}. Check it out!`,
    missionId: sighting.missionId,
    priority: sighting.confidence === 'HIGH' ? 'URGENT' : 'NORMAL',
  });
}

/**
 * Alert division about help request
 */
export async function alertDivisionHelpRequest(helpRequest) {
  const division = await findDivisionByLocation(
    helpRequest.latitude,
    helpRequest.longitude
  );

  if (!division) {
    // Fall back to case's assigned squad
    const session = await prisma.searchSession.findUnique({
      where: { id: helpRequest.sessionId },
      include: {
        participant: {
          include: {
            assignment: {
              include: {
                rescueSquad: {
                  include: { divisions: true }
                }
              }
            }
          }
        }
      }
    });

    if (!session?.participant?.assignment?.rescueSquad?.divisions?.[0]) {
      return { success: false, error: 'No division found' };
    }

    return sendDivisionAlert(session.participant.assignment.rescueSquad.divisions[0].id, {
      type: 'HELP_REQUEST',
      title: '🆘 Volunteer needs help!',
      body: helpRequest.message || 'A volunteer is requesting assistance',
      missionId: helpRequest.missionId,
      priority: 'URGENT',
    });
  }

  return sendDivisionAlert(division.id, {
    type: 'HELP_REQUEST',
    title: '🆘 Volunteer needs help!',
    body: helpRequest.message || 'A volunteer is requesting assistance',
    missionId: helpRequest.missionId,
    priority: 'URGENT',
  });
}

/**
 * Send coverage gap alert
 */
export async function alertCoverageGap(divisionId, missionId, gapInfo) {
  const { uncoveredCells, hoursWithoutActivity } = gapInfo;

  return sendDivisionAlert(divisionId, {
    type: 'COVERAGE_GAP',
    title: 'Search coverage needed',
    body: `${uncoveredCells} areas still need searching. Can you help?`,
    missionId,
    priority: hoursWithoutActivity > 2 ? 'URGENT' : 'NORMAL',
  });
}

/**
 * Send reunion celebration alert
 */
export async function alertDivisionReunion(divisionId, missionData, finderName) {
  return sendDivisionAlert(divisionId, {
    type: 'REUNION',
    title: `🎉 ${missionData.petName} found!`,
    body: finderName
      ? `${finderName} found ${missionData.petName}! Reunion in progress.`
      : `${missionData.petName} has been found! Thank you for helping!`,
    missionId: missionData.id,
    priority: 'NORMAL',
  });
}

/**
 * Find nearest divisions to a location
 */
function findNearestDivisions(divisions, lat, lng, count = 1) {
  const withDistance = divisions
    .filter(d => d.centerLatitude && d.centerLongitude)
    .map(d => ({
      ...d,
      distance: haversineDistance(lat, lng, d.centerLatitude, d.centerLongitude),
    }))
    .sort((a, b) => a.distance - b.distance);

  return withDistance.slice(0, count);
}

/**
 * Find division that covers a specific location
 */
async function findDivisionByLocation(lat, lng) {
  const divisions = await prisma.division.findMany({
    where: { isActive: true },
  });

  // Find division that contains this point
  for (const division of divisions) {
    if (!division.centerLatitude || !division.centerLongitude) continue;

    const distance = haversineDistance(
      lat, lng,
      division.centerLatitude, division.centerLongitude
    );

    if (distance <= (division.radiusMiles || 3)) {
      return division;
    }

    // Check custom boundary if exists
    if (division.customBoundary) {
      try {
        const boundary = JSON.parse(division.customBoundary);
        if (pointInPolygon([lng, lat], boundary.coordinates[0])) {
          return division;
        }
      } catch (e) {
        // Invalid boundary, skip
      }
    }
  }

  return null;
}

/**
 * Check if point is inside polygon (for custom boundaries)
 */
function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
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

/**
 * Get user's division alert preferences
 */
export async function getAlertPreferences(userId) {
  const preferences = await prisma.userAlertPreferences.findUnique({
    where: { userId },
  });

  return preferences || {
    newCases: true,
    sightings: true,
    helpRequests: true,
    reunions: true,
    coverageGaps: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    maxAlertsPerDay: 20,
  };
}

/**
 * Update user's division alert preferences
 */
export async function updateAlertPreferences(userId, preferences) {
  return prisma.userAlertPreferences.upsert({
    where: { userId },
    update: preferences,
    create: { userId, ...preferences },
  });
}

export default {
  sendDivisionAlert,
  alertSquadNewCase,
  alertDivisionSighting,
  alertDivisionHelpRequest,
  alertCoverageGap,
  alertDivisionReunion,
  getAlertPreferences,
  updateAlertPreferences,
};
