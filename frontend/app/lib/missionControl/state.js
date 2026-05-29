/**
 * Mission Control State Management
 *
 * Real-time state for live operations.
 * Syncs across all connected clients.
 */

import prisma from '@/app/lib/prisma';
import { OPERATION_MODES, VOLUNTEER_STATUS, ZONE_STATUS } from './index';

/**
 * Get or create mission state for a case
 */
export async function getMissionState(missionId, { createIfMissing = false } = {}) {
  let mission = await prisma.missionControl.findUnique({
    where: { missionId },
    include: {
      case: {
        include: {
          reporter: { select: { id: true, firstName: true, phone: true } },
          assignments: {
            include: {
              rescueSquad: true,
              participants: {
                include: {
                  user: { select: { id: true, firstName: true, lastName: true } }
                }
              }
            }
          }
        }
      },
      activeVolunteers: {
        include: {
          user: { select: { id: true, firstName: true } }
        }
      },
      zones: true,
      sightings: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      resources: true,
    }
  });

  if (!mission && !createIfMissing) {
    // Read-only callers (e.g. GET) must not write on read — return null so the
    // caller can 404 instead of materializing a MissionControl row on demand.
    return null;
  }

  if (!mission) {
    // Create inactive mission state
    mission = await prisma.missionControl.create({
      data: {
        missionId,
        mode: OPERATION_MODES.INACTIVE,
        activatedAt: null,
      },
      include: {
        case: {
          include: {
            reporter: { select: { id: true, firstName: true, phone: true } },
          }
        },
        activeVolunteers: true,
        zones: true,
        sightings: true,
        resources: true,
      }
    });
  }

  return formatMissionState(mission);
}

/**
 * Format mission state for client consumption
 */
function formatMissionState(mission) {
  const missionData = mission.case;
  const hoursElapsed = missionData?.lastSeenAt
    ? Math.floor((Date.now() - new Date(missionData.lastSeenAt).getTime()) / 3600000)
    : null;

  return {
    id: mission.id,
    missionId: mission.missionId,
    mode: mission.mode,
    isLive: mission.mode === OPERATION_MODES.LIVE_SEARCH ||
            mission.mode === OPERATION_MODES.CONTAINMENT,

    // Time tracking
    activatedAt: mission.activatedAt,
    hoursElapsed,
    urgencyLevel: getUrgencyLevel(hoursElapsed),

    // Pet info (always visible)
    pet: {
      name: missionData?.petName,
      species: missionData?.petSpecies,
      breed: missionData?.petBreed,
      color: missionData?.petColor,
      photoUrl: missionData?.petPhotoUrl,
      description: missionData?.petDescription,
      temperament: missionData?.temperament,
      medicalNeeds: missionData?.medicalNeeds,
      respondsTo: missionData?.respondsTo,
    },

    // Last seen
    lastSeen: {
      address: missionData?.lastSeenAddress,
      lat: missionData?.lastSeenLat,
      lng: missionData?.lastSeenLng,
      time: missionData?.lastSeenAt,
    },

    // Owner
    owner: {
      id: missionData?.reporter?.id,
      name: missionData?.reporter?.firstName,
      status: mission.ownerStatus,
      location: mission.ownerLocation ? JSON.parse(mission.ownerLocation) : null,
      broadcast: mission.ownerBroadcast,
    },

    // Stats
    stats: {
      activeVolunteers: mission.activeVolunteers?.length || 0,
      totalVolunteers: mission.totalVolunteersJoined || 0,
      zonesSearched: mission.zones?.filter(z => z.status === ZONE_STATUS.SEARCHED).length || 0,
      totalZones: mission.zones?.length || 0,
      sightingsCount: mission.sightingsCount || 0,
      lastSightingAt: mission.lastSightingAt,
    },

    // Active volunteers (for map)
    volunteers: mission.activeVolunteers?.map(v => ({
      id: v.id,
      name: v.user?.firstName || 'Volunteer',
      status: v.status,
      location: v.currentLocation ? JSON.parse(v.currentLocation) : null,
      assignedZone: v.assignedZoneId,
      hasResources: v.resources ? JSON.parse(v.resources) : [],
    })) || [],

    // Zones
    zones: mission.zones?.map(z => ({
      id: z.id,
      bounds: {
        north: z.northLat,
        south: z.southLat,
        east: z.eastLng,
        west: z.westLng,
      },
      status: z.status,
      probability: z.probability,
      lastSearchedAt: z.lastSearchedAt,
      assignedTo: z.assignedToId,
    })) || [],

    // Recent sightings
    sightings: mission.sightings?.map(s => ({
      id: s.id,
      priority: s.priority,
      location: { lat: s.latitude, lng: s.longitude },
      time: s.createdAt,
      verified: s.verified,
      photoUrl: s.photoUrl,
    })) || [],

    // Resources available
    resources: mission.resources?.map(r => ({
      type: r.type,
      volunteerId: r.volunteerId,
      location: r.location ? JSON.parse(r.location) : null,
    })) || [],

    // Containment (if in containment mode)
    containment: mission.mode === OPERATION_MODES.CONTAINMENT ? {
      center: mission.containmentCenter ? JSON.parse(mission.containmentCenter) : null,
      radius: mission.containmentRadius,
      positions: mission.perimeterPositions ? JSON.parse(mission.perimeterPositions) : [],
    } : null,
  };
}

/**
 * Determine urgency level based on hours elapsed
 */
function getUrgencyLevel(hours) {
  if (hours === null) return 'UNKNOWN';
  if (hours < 2) return 'CRITICAL';      // Golden window
  if (hours < 12) return 'HIGH';
  if (hours < 24) return 'ELEVATED';
  if (hours < 72) return 'MODERATE';
  return 'EXTENDED';
}

/**
 * Update mission mode
 */
export async function updateMissionMode(missionId, mode, updatedBy) {
  const mission = await prisma.missionControl.update({
    where: { id: missionId },
    data: {
      mode,
      lastModeChange: new Date(),
      lastUpdatedBy: updatedBy,
      ...(mode === OPERATION_MODES.LIVE_SEARCH && !await getMissionActivatedAt(missionId)
        ? { activatedAt: new Date() }
        : {}),
    }
  });

  // Log mode change
  await prisma.missionLog.create({
    data: {
      missionId,
      action: 'MODE_CHANGE',
      details: JSON.stringify({ newMode: mode }),
      userId: updatedBy,
    }
  });

  return mission;
}

async function getMissionActivatedAt(missionId) {
  const mission = await prisma.missionControl.findUnique({
    where: { id: missionId },
    select: { activatedAt: true }
  });
  return mission?.activatedAt;
}

/**
 * Update volunteer location
 */
export async function updateVolunteerLocation(missionId, volunteerId, location) {
  await prisma.missionVolunteer.update({
    where: {
      missionId_odId: { missionId, odId: volunteerId }
    },
    data: {
      currentLocation: JSON.stringify(location),
      lastLocationUpdate: new Date(),
    }
  });

  // Store in path history
  await prisma.volunteerPath.create({
    data: {
      missionId,
      odId: volunteerId,
      latitude: location.lat,
      longitude: location.lng,
      accuracy: location.accuracy,
      timestamp: new Date(),
    }
  });
}

/**
 * Get probability heat map based on sightings, terrain, time
 */
export async function getProbabilityMap(missionId) {
  const mission = await prisma.missionControl.findUnique({
    where: { id: missionId },
    include: {
      case: true,
      sightings: {
        where: { verified: true },
        orderBy: { createdAt: 'desc' },
      },
      zones: true,
    }
  });

  if (!mission) return null;

  const zones = mission.zones.map(zone => {
    let probability = 0.5; // Base probability

    // Increase for recent sightings nearby
    mission.sightings.forEach(sighting => {
      const distance = calculateDistance(
        { lat: (zone.northLat + zone.southLat) / 2, lng: (zone.eastLng + zone.westLng) / 2 },
        { lat: sighting.latitude, lng: sighting.longitude }
      );

      const hoursSinceSighting = (Date.now() - new Date(sighting.createdAt).getTime()) / 3600000;

      if (distance < 0.5) { // Within 0.5 miles
        probability += (0.3 / (hoursSinceSighting + 1)); // Decay over time
      }
    });

    // Decrease if recently searched thoroughly
    if (zone.status === ZONE_STATUS.SEARCHED) {
      const hoursSinceSearch = (Date.now() - new Date(zone.lastSearchedAt).getTime()) / 3600000;
      probability *= (hoursSinceSearch / 24); // Gradually increase after search
    }

    // Terrain factors (if available)
    if (zone.terrainType === 'WOODED') probability *= 1.2;
    if (zone.terrainType === 'WATER') probability *= 0.8;
    if (zone.hasHidingSpots) probability *= 1.3;

    return {
      ...zone,
      probability: Math.min(Math.max(probability, 0), 1),
    };
  });

  return zones.sort((a, b) => b.probability - a.probability);
}

function calculateDistance(point1, point2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLng = (point2.lng - point1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default {
  getMissionState,
  updateMissionMode,
  updateVolunteerLocation,
  getProbabilityMap,
};
