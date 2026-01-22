/**
 * Phase 1: One-Tap Volunteer System
 *
 * Enables instant volunteer signup with zero friction.
 * Users can help without creating a full account first.
 */

import prisma from '@/app/lib/prisma';

/**
 * Quick join a case as a volunteer
 * Creates minimal user record if needed, joins the case immediately
 */
export async function quickJoinCase(missionId, volunteerInfo) {
  const { userId, deviceId, location, name, phone } = volunteerInfo;

  // Get the case and its assignment
  const missionData = await prisma.case.findUnique({
    where: { id: missionId },
    include: {
      assignments: {
        where: { status: 'ACCEPTED' },
        include: {
          rescueForce: {
            include: {
              divisions: true,
            }
          }
        },
        take: 1,
      }
    }
  });

  if (!missionData) {
    return { success: false, error: 'Mission not found' };
  }

  if (missionData.status !== 'ACTIVE') {
    return { success: false, error: 'Case is no longer active' };
  }

  let assignment = missionData.assignments[0];

  // If no assignment exists, this is a community case - create ad-hoc participation
  if (!assignment) {
    // Find nearest force or create community assignment
    const nearestSquad = await findNearestSquad(location);

    if (nearestSquad) {
      assignment = await prisma.caseAssignment.create({
        data: {
          missionId,
          rescueForceId: nearestSquad.id,
          status: 'ACCEPTED',
          acceptedById: nearestSquad.leaderId || 'system',
        }
      });
    }
  }

  // Handle anonymous/guest volunteers
  let finalUserId = userId;

  if (!userId && (deviceId || phone)) {
    // Create or find guest volunteer record
    const guestVolunteer = await getOrCreateGuestVolunteer({
      deviceId,
      phone,
      name: name || 'Anonymous Helper',
      location,
    });
    finalUserId = guestVolunteer.id;
  }

  if (!finalUserId) {
    return { success: false, error: 'Unable to identify volunteer' };
  }

  // Check if already participating
  const existing = await prisma.caseParticipant.findFirst({
    where: {
      assignmentId: assignment?.id,
      userId: finalUserId,
      isActive: true,
    }
  });

  if (existing) {
    return {
      success: true,
      alreadyJoined: true,
      participantId: existing.id,
      message: 'You\'re already helping with this search!'
    };
  }

  // Create participation record
  const participant = await prisma.caseParticipant.create({
    data: {
      assignmentId: assignment.id,
      userId: finalUserId,
      isActive: true,
    }
  });

  // Update active member count
  await prisma.caseAssignment.update({
    where: { id: assignment.id },
    data: { activeMembers: { increment: 1 } }
  });

  // Find best division for this volunteer based on location
  const suggestedDivision = await findBestDivision(
    assignment.rescueForce,
    location
  );

  // Create search session
  const searchSession = await prisma.searchSession.create({
    data: {
      odpaticipantId: participant.id,
      missionId,
      divisionId: suggestedDivision?.id,
      status: 'READY',
      startLocation: location ? JSON.stringify(location) : null,
    }
  });

  return {
    success: true,
    participantId: participant.id,
    sessionId: searchSession.id,
    assignmentId: assignment.id,
    forceName: assignment.rescueForce?.name,
    divisionName: suggestedDivision?.name,
    message: `You're in! ${assignment.rescueForce?.name || 'The search team'} is glad to have you.`,
    nextAction: {
      type: 'VIEW_ASSIGNMENT',
      prompt: 'See where to search',
      url: `/search/${missionId}/field`,
    }
  };
}

/**
 * Get or create a guest volunteer (for anonymous helpers)
 */
async function getOrCreateGuestVolunteer({ deviceId, phone, name, location }) {
  // Try to find existing guest by device or phone
  let guest = null;

  if (phone) {
    guest = await prisma.user.findFirst({
      where: { phone, role: 'GUEST' }
    });
  }

  if (!guest && deviceId) {
    guest = await prisma.user.findFirst({
      where: {
        deviceId,
        role: 'GUEST'
      }
    });
  }

  if (guest) {
    // Update last known location
    if (location) {
      await prisma.userProfile.upsert({
        where: { userId: guest.id },
        update: {
          latitude: location.lat,
          longitude: location.lng,
          lastLocationUpdate: new Date(),
        },
        create: {
          userId: guest.id,
          latitude: location.lat,
          longitude: location.lng,
        }
      });
    }
    return guest;
  }

  // Create new guest volunteer
  const newGuest = await prisma.user.create({
    data: {
      email: `guest_${deviceId || Date.now()}@reunitepets.local`,
      firstName: name || 'Anonymous',
      lastName: 'Helper',
      role: 'GUEST',
      deviceId,
      phone,
      profile: location ? {
        create: {
          latitude: location.lat,
          longitude: location.lng,
        }
      } : undefined,
    },
    include: { profile: true }
  });

  return newGuest;
}

/**
 * Find the nearest active rescue force
 */
async function findNearestSquad(location) {
  if (!location?.lat || !location?.lng) {
    return null;
  }

  const forces = await prisma.rescueForce.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      centerLatitude: true,
      centerLongitude: true,
      radiusMiles: true,
      leaderId: true,
    }
  });

  let nearest = null;
  let minDistance = Infinity;

  for (const force of forces) {
    if (!force.centerLatitude || !force.centerLongitude) continue;

    const distance = haversineDistance(
      location.lat, location.lng,
      force.centerLatitude, force.centerLongitude
    );

    if (distance < minDistance && distance <= (force.radiusMiles || 50)) {
      minDistance = distance;
      nearest = force;
    }
  }

  return nearest;
}

/**
 * Find the best division within a force for a volunteer
 */
async function findBestDivision(force, location) {
  if (!force?.divisions?.length || !location?.lat || !location?.lng) {
    return null;
  }

  let bestDivision = null;
  let minDistance = Infinity;

  for (const division of force.divisions) {
    if (!division.isActive || !division.centerLatitude || !division.centerLongitude) {
      continue;
    }

    const distance = haversineDistance(
      location.lat, location.lng,
      division.centerLatitude, division.centerLongitude
    );

    if (distance < minDistance) {
      minDistance = distance;
      bestDivision = division;
    }
  }

  return bestDivision;
}

/**
 * Leave a case / end participation
 */
export async function leaveCase(participantId, reason = null) {
  const participant = await prisma.caseParticipant.findUnique({
    where: { id: participantId },
    include: { assignment: true }
  });

  if (!participant) {
    return { success: false, error: 'Participation not found' };
  }

  // End any active search session
  await prisma.searchSession.updateMany({
    where: {
      participantId,
      status: { in: ['READY', 'ACTIVE'] }
    },
    data: {
      status: 'COMPLETED',
      endedAt: new Date(),
      endReason: reason || 'Volunteer left',
    }
  });

  // Mark participation as inactive
  await prisma.caseParticipant.update({
    where: { id: participantId },
    data: {
      isActive: false,
      optedOutAt: new Date(),
    }
  });

  // Update active member count
  await prisma.caseAssignment.update({
    where: { id: participant.assignmentId },
    data: { activeMembers: { decrement: 1 } }
  });

  return {
    success: true,
    message: 'Thank you for helping! Your contribution matters.',
  };
}

/**
 * Get volunteer status for a case
 */
export async function getVolunteerStatus(missionId, userId) {
  const participation = await prisma.caseParticipant.findFirst({
    where: {
      assignment: { missionId },
      userId,
      isActive: true,
    },
    include: {
      assignment: {
        include: {
          case: true,
          rescueForce: true,
          _count: { select: { participants: { where: { isActive: true } } } }
        }
      }
    }
  });

  if (!participation) {
    return { isVolunteering: false };
  }

  // Get active search session
  const session = await prisma.searchSession.findFirst({
    where: {
      participantId: participation.id,
      status: { in: ['READY', 'ACTIVE'] }
    },
    include: {
      gridCell: true,
      division: true,
    }
  });

  return {
    isVolunteering: true,
    participantId: participation.id,
    sessionId: session?.id,
    sessionStatus: session?.status || 'READY',
    assignedCell: session?.gridCell,
    division: session?.division,
    forceName: participation.assignment.rescueForce?.name,
    activeVolunteers: participation.assignment._count.participants,
    myStats: {
      searchHours: participation.searchHours,
      areasMarked: participation.areasMarked,
      sightingsReported: participation.sightingsReported,
    }
  };
}

/**
 * Haversine distance calculation (miles)
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
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
  quickJoinCase,
  leaveCase,
  getVolunteerStatus,
};
