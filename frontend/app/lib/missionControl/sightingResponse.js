/**
 * Sighting Response - The "Critical 60 Seconds"
 *
 * When a volunteer spots the pet, adrenaline spikes.
 * If they chase, the pet is lost.
 *
 * This module handles:
 * 1. The sighting button (accessible but no accidents)
 * 2. The FREEZE protocol (force volunteer to stop)
 * 3. The perimeter (coordinate quiet convergence)
 */

import prisma from '@/app/lib/prisma';
import { OPERATION_MODES, VOLUNTEER_STATUS, SIGHTING_PRIORITY } from './index';

/**
 * Report a sighting - initiates containment protocol
 */
export async function reportSighting(volunteerId, sightingData) {
  const { location, confidence, photoUrl, notes, direction } = sightingData;

  const volunteer = await prisma.missionVolunteer.findUnique({
    where: { id: volunteerId },
    include: {
      mission: {
        include: {
          case: true,
          activeVolunteers: true,
        }
      }
    }
  });

  if (!volunteer) {
    return { success: false, error: 'Volunteer not found' };
  }

  const mission = volunteer.mission;

  // Create sighting record
  const sighting = await prisma.missionSighting.create({
    data: {
      missionId: mission.id,
      reporterId: volunteer.odId,
      reporterName: volunteer.displayName,
      latitude: location.lat,
      longitude: location.lng,
      confidence,
      priority: mapConfidenceToPriority(confidence),
      photoUrl,
      notes,
      petDirection: direction, // Which way pet was heading
      verified: false,
      status: 'PENDING',
    }
  });

  // Update mission stats
  await prisma.missionControl.update({
    where: { id: mission.id },
    data: {
      sightingsCount: { increment: 1 },
      lastSightingAt: new Date(),
    }
  });

  // If high confidence, initiate containment
  if (confidence === 'CONFIRMED' || confidence === 'HIGH') {
    await initiateContainment(mission.id, sighting, volunteer);
  }

  // Log
  await prisma.missionLog.create({
    data: {
      missionId: mission.id,
      action: 'SIGHTING_REPORTED',
      details: JSON.stringify({
        sightingId: sighting.id,
        confidence,
        location,
      }),
    }
  });

  return {
    success: true,
    sightingId: sighting.id,
    protocol: getProtocolForConfidence(confidence),
  };
}

function mapConfidenceToPriority(confidence) {
  switch (confidence) {
    case 'CONFIRMED': return SIGHTING_PRIORITY.CONFIRMED;
    case 'HIGH': return SIGHTING_PRIORITY.HIGH;
    case 'MEDIUM': return SIGHTING_PRIORITY.MEDIUM;
    default: return SIGHTING_PRIORITY.LOW;
  }
}

function getProtocolForConfidence(confidence) {
  if (confidence === 'CONFIRMED') {
    return {
      action: 'FREEZE',
      instructions: [
        'STOP MOVING IMMEDIATELY',
        'Do not approach the pet',
        'Do not make eye contact',
        'Stay very quiet',
        'Help is on the way',
      ],
      nextSteps: 'containment',
    };
  }

  if (confidence === 'HIGH') {
    return {
      action: 'HOLD',
      instructions: [
        'Stop where you are',
        'Keep eyes on the pet if possible',
        'Do not approach or call out',
        'Take a photo if you can without moving',
      ],
      nextSteps: 'verification',
    };
  }

  return {
    action: 'OBSERVE',
    instructions: [
      'Note the location',
      'Try to get a photo',
      'Continue observing from a distance',
    ],
    nextSteps: 'continue',
  };
}

/**
 * Initiate containment protocol
 * - Switches mission to CONTAINMENT mode
 * - Calculates perimeter positions
 * - Reroutes nearby volunteers
 */
async function initiateContainment(missionId, sighting, spotter) {
  // Update mission to containment mode
  await prisma.missionControl.update({
    where: { id: missionId },
    data: {
      mode: OPERATION_MODES.CONTAINMENT,
      containmentCenter: JSON.stringify({
        lat: sighting.latitude,
        lng: sighting.longitude,
      }),
      containmentRadius: 0.05, // ~250 feet initial radius
      containmentStartedAt: new Date(),
      activeSightingId: sighting.id,
    }
  });

  // Update spotter status
  await prisma.missionVolunteer.update({
    where: { id: spotter.id },
    data: {
      status: VOLUNTEER_STATUS.PERIMETER,
      perimeterPosition: 'SPOTTER', // They hold position
    }
  });

  // Get nearby volunteers and assign perimeter positions
  const perimeterPositions = await assignPerimeterPositions(
    missionId,
    { lat: sighting.latitude, lng: sighting.longitude },
    spotter.id
  );

  // Log containment start
  await prisma.missionLog.create({
    data: {
      missionId,
      action: 'CONTAINMENT_INITIATED',
      details: JSON.stringify({
        sightingId: sighting.id,
        spotterId: spotter.odId,
        perimeterPositions,
      }),
    }
  });

  // Notify all volunteers - SILENT APPROACH
  await broadcastContainmentAlert(missionId, sighting, perimeterPositions);

  return perimeterPositions;
}

/**
 * Assign perimeter positions to nearby volunteers
 * Creates a circle around the sighting location
 */
async function assignPerimeterPositions(missionId, center, spotterId) {
  const volunteers = await prisma.missionVolunteer.findMany({
    where: {
      missionId,
      status: VOLUNTEER_STATUS.ACTIVE,
      id: { not: spotterId },
    }
  });

  // Calculate positions for 8-point perimeter
  const perimeterRadius = 0.03; // ~150 feet
  const positions = [];

  for (let i = 0; i < 8; i++) {
    const angle = (i * 45) * Math.PI / 180;
    const latOffset = perimeterRadius / 69;
    const lngOffset = perimeterRadius / (69 * Math.cos(center.lat * Math.PI / 180));

    positions.push({
      position: getPositionName(i),
      lat: center.lat + (latOffset * Math.cos(angle)),
      lng: center.lng + (lngOffset * Math.sin(angle)),
      angle: i * 45,
      assigned: false,
      volunteerId: null,
    });
  }

  // Sort volunteers by distance to center
  const volunteersWithDistance = volunteers.map(v => {
    const loc = v.currentLocation ? JSON.parse(v.currentLocation) : null;
    if (!loc) return { ...v, distance: Infinity };

    const distance = Math.sqrt(
      Math.pow((loc.lat - center.lat) * 69, 2) +
      Math.pow((loc.lng - center.lng) * 69 * Math.cos(center.lat * Math.PI / 180), 2)
    );
    return { ...v, distance, location: loc };
  }).filter(v => v.distance < 0.5) // Within 0.5 miles
    .sort((a, b) => a.distance - b.distance);

  // Assign volunteers to nearest available position
  for (const volunteer of volunteersWithDistance) {
    if (!volunteer.location) continue;

    // Find nearest unassigned position
    let nearestPosition = null;
    let nearestDistance = Infinity;

    for (const pos of positions) {
      if (pos.assigned) continue;

      const dist = Math.sqrt(
        Math.pow((volunteer.location.lat - pos.lat) * 69, 2) +
        Math.pow((volunteer.location.lng - pos.lng) * 69 * Math.cos(pos.lat * Math.PI / 180), 2)
      );

      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestPosition = pos;
      }
    }

    if (nearestPosition) {
      nearestPosition.assigned = true;
      nearestPosition.volunteerId = volunteer.id;
      nearestPosition.volunteerName = volunteer.displayName;

      // Update volunteer with perimeter assignment
      await prisma.missionVolunteer.update({
        where: { id: volunteer.id },
        data: {
          status: VOLUNTEER_STATUS.RESPONDING,
          perimeterPosition: nearestPosition.position,
          perimeterTarget: JSON.stringify({
            lat: nearestPosition.lat,
            lng: nearestPosition.lng,
          }),
        }
      });
    }
  }

  // Store perimeter in mission
  await prisma.missionControl.update({
    where: { id: missionId },
    data: {
      perimeterPositions: JSON.stringify(positions),
    }
  });

  return positions;
}

function getPositionName(index) {
  const names = ['NORTH', 'NORTHEAST', 'EAST', 'SOUTHEAST',
                 'SOUTH', 'SOUTHWEST', 'WEST', 'NORTHWEST'];
  return names[index];
}

/**
 * Volunteer confirms arrival at perimeter position
 */
export async function confirmPerimeterPosition(volunteerId) {
  const volunteer = await prisma.missionVolunteer.update({
    where: { id: volunteerId },
    data: {
      status: VOLUNTEER_STATUS.PERIMETER,
      perimeterArrivedAt: new Date(),
    },
    include: { mission: true }
  });

  // Check if all positions are filled
  const positions = volunteer.mission.perimeterPositions
    ? JSON.parse(volunteer.mission.perimeterPositions)
    : [];

  const allVolunteers = await prisma.missionVolunteer.findMany({
    where: {
      missionId: volunteer.missionId,
      status: VOLUNTEER_STATUS.PERIMETER,
    }
  });

  const perimeterComplete = allVolunteers.length >= 4; // Minimum viable perimeter

  await prisma.missionLog.create({
    data: {
      missionId: volunteer.missionId,
      action: 'PERIMETER_POSITION_CONFIRMED',
      details: JSON.stringify({
        odId: volunteer.odId,
        position: volunteer.perimeterPosition,
        perimeterComplete,
      }),
    }
  });

  return {
    success: true,
    position: volunteer.perimeterPosition,
    perimeterComplete,
    instructions: perimeterComplete
      ? ['Perimeter secure. Hold position. Wait for leader instruction.']
      : ['Position confirmed. Waiting for more volunteers to arrive.'],
  };
}

/**
 * Verify a sighting (leader action)
 */
export async function verifySighting(sightingId, verified, verifierId) {
  const sighting = await prisma.missionSighting.update({
    where: { id: sightingId },
    data: {
      verified,
      verifiedById: verifierId,
      verifiedAt: new Date(),
      status: verified ? 'VERIFIED' : 'DISMISSED',
    },
    include: { mission: true }
  });

  if (!verified) {
    // False alarm - stand down containment
    await standDownContainment(sighting.missionId, 'FALSE_ALARM');
  }

  return { success: true, verified };
}

/**
 * Stand down containment (false alarm or pet secured)
 */
export async function standDownContainment(missionId, reason) {
  // Reset mission mode
  await prisma.missionControl.update({
    where: { id: missionId },
    data: {
      mode: OPERATION_MODES.LIVE_SEARCH,
      containmentCenter: null,
      containmentRadius: null,
      perimeterPositions: null,
      activeSightingId: null,
    }
  });

  // Reset all perimeter volunteers to active
  await prisma.missionVolunteer.updateMany({
    where: {
      missionId,
      status: { in: [VOLUNTEER_STATUS.PERIMETER, VOLUNTEER_STATUS.RESPONDING] },
    },
    data: {
      status: VOLUNTEER_STATUS.ACTIVE,
      perimeterPosition: null,
      perimeterTarget: null,
    }
  });

  await prisma.missionLog.create({
    data: {
      missionId,
      action: 'CONTAINMENT_ENDED',
      details: JSON.stringify({ reason }),
    }
  });

  // Notify all volunteers
  await broadcastStandDown(missionId, reason);

  return { success: true };
}

/**
 * Handle conflicting sightings
 */
export async function handleConflictingSightings(missionId) {
  // Get recent unresolved sightings
  const recentSightings = await prisma.missionSighting.findMany({
    where: {
      missionId,
      status: 'PENDING',
      createdAt: { gte: new Date(Date.now() - 30 * 60000) }, // Last 30 min
    },
    orderBy: { createdAt: 'desc' },
  });

  if (recentSightings.length < 2) {
    return { hasConflict: false };
  }

  // Calculate distances between sightings
  const conflicts = [];
  for (let i = 0; i < recentSightings.length; i++) {
    for (let j = i + 1; j < recentSightings.length; j++) {
      const s1 = recentSightings[i];
      const s2 = recentSightings[j];
      const distance = calculateDistance(
        { lat: s1.latitude, lng: s1.longitude },
        { lat: s2.latitude, lng: s2.longitude }
      );

      if (distance > 0.25) { // More than quarter mile apart
        conflicts.push({
          sighting1: s1,
          sighting2: s2,
          distanceMiles: distance,
        });
      }
    }
  }

  if (conflicts.length === 0) {
    return { hasConflict: false };
  }

  return {
    hasConflict: true,
    conflicts,
    recommendation: 'Split resources between locations. Prioritize higher confidence sighting.',
  };
}

function calculateDistance(from, to) {
  const R = 3959;
  const dLat = (to.lat - from.lat) * Math.PI / 180;
  const dLng = (to.lng - from.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Notification stubs
async function broadcastContainmentAlert(missionId, sighting, positions) {
  // TODO: Push notification with SILENT mode instruction
  console.log(`CONTAINMENT ALERT for mission ${missionId}`);
}

async function broadcastStandDown(missionId, reason) {
  // TODO: Push notification
  console.log(`STAND DOWN for mission ${missionId}: ${reason}`);
}

export default {
  reportSighting,
  confirmPerimeterPosition,
  verifySighting,
  standDownContainment,
  handleConflictingSightings,
};
