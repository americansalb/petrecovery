/**
 * Phase 3: Field Mode
 *
 * Mobile-optimized interface for active searching.
 * Big buttons, simple actions, live location tracking.
 */

import prisma from '@/app/lib/prisma';
import { sendPushToUser, sendPushToMany, PUSH_TEMPLATES } from '@/app/lib/push';

/**
 * Start field mode for a volunteer
 */
export async function startFieldMode(sessionId, location) {
  const session = await prisma.searchSession.findUnique({
    where: { id: sessionId },
    include: {
      participant: {
        include: {
          user: true,
          assignment: {
            include: {
              case: true,
              rescueSquad: true,
            }
          }
        }
      },
      gridCell: true,
    }
  });

  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  // Update session to active
  await prisma.searchSession.update({
    where: { id: sessionId },
    data: {
      status: 'ACTIVE',
      startedAt: new Date(),
      currentLocation: location ? JSON.stringify(location) : null,
    }
  });

  const caseData = session.participant.assignment.case;

  return {
    success: true,
    fieldData: {
      sessionId,
      caseId: caseData.id,
      petName: caseData.petName,
      petSpecies: caseData.petSpecies,
      petPhotoUrl: caseData.petPhotoUrl,
      petDescription: caseData.petDescription,
      petColor: caseData.petColor,
      assignedCell: session.gridCell ? {
        id: session.gridCell.id,
        bounds: {
          north: session.gridCell.northLat,
          south: session.gridCell.southLat,
          east: session.gridCell.eastLng,
          west: session.gridCell.westLng,
        },
        center: {
          lat: session.gridCell.centerLatitude,
          lng: session.gridCell.centerLongitude,
        },
      } : null,
      squadName: session.participant.assignment.rescueSquad?.name,
    },
    // Pre-configured actions for the UI
    actions: getFieldActions(session),
  };
}

/**
 * Get available field actions based on session state
 */
function getFieldActions(session) {
  const baseActions = [
    {
      id: 'found_pet',
      label: 'I SEE THEM!',
      icon: '🎯',
      color: 'green',
      size: 'large',
      priority: 1,
      action: 'REPORT_FOUND',
    },
    {
      id: 'possible_sighting',
      label: 'Possible Sighting',
      icon: '👀',
      color: 'yellow',
      size: 'medium',
      priority: 2,
      action: 'REPORT_SIGHTING',
    },
    {
      id: 'found_clue',
      label: 'Found Clue',
      icon: '🔍',
      color: 'blue',
      size: 'medium',
      priority: 3,
      action: 'REPORT_CLUE',
    },
    {
      id: 'area_clear',
      label: 'Nothing Here',
      icon: '✓',
      color: 'gray',
      size: 'medium',
      priority: 4,
      action: 'MARK_SEARCHED',
    },
    {
      id: 'need_help',
      label: 'Need Help',
      icon: '🆘',
      color: 'red',
      size: 'small',
      priority: 5,
      action: 'REQUEST_HELP',
    },
    {
      id: 'take_break',
      label: 'Take Break',
      icon: '⏸',
      color: 'gray',
      size: 'small',
      priority: 6,
      action: 'PAUSE_SESSION',
    },
  ];

  return baseActions;
}

/**
 * Update volunteer location during field mode
 */
export async function updateLocation(sessionId, location) {
  const { lat, lng, accuracy, heading } = location;

  await prisma.searchSession.update({
    where: { id: sessionId },
    data: {
      currentLocation: JSON.stringify({ lat, lng, accuracy, heading }),
      lastLocationUpdate: new Date(),
    }
  });

  // Store location history for path tracking
  await prisma.locationPing.create({
    data: {
      sessionId,
      latitude: lat,
      longitude: lng,
      accuracy,
      heading,
    }
  });

  // Check if volunteer left their assigned cell
  const session = await prisma.searchSession.findUnique({
    where: { id: sessionId },
    include: { gridCell: true }
  });

  let inAssignedArea = true;
  if (session?.gridCell) {
    const { northLat, southLat, eastLng, westLng } = session.gridCell;
    inAssignedArea = lat <= northLat && lat >= southLat &&
                     lng <= eastLng && lng >= westLng;
  }

  return {
    success: true,
    inAssignedArea,
    message: inAssignedArea ? null : 'You\'ve left your assigned area',
  };
}

/**
 * Handle field action
 */
export async function handleFieldAction(sessionId, action, data = {}) {
  const session = await prisma.searchSession.findUnique({
    where: { id: sessionId },
    include: {
      participant: {
        include: {
          user: true,
          assignment: {
            include: { case: true }
          }
        }
      },
      gridCell: true,
    }
  });

  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  const caseId = session.participant.assignment.caseId;
  const userId = session.participant.userId;

  switch (action) {
    case 'REPORT_FOUND':
      return await reportPetFound(session, data);

    case 'REPORT_SIGHTING':
      return await reportSighting(session, data);

    case 'REPORT_CLUE':
      return await reportClue(session, data);

    case 'MARK_SEARCHED':
      return await markAreaSearched(session, data);

    case 'REQUEST_HELP':
      return await requestHelp(session, data);

    case 'PAUSE_SESSION':
      return await pauseSession(session, data);

    case 'RESUME_SESSION':
      return await resumeSession(session, data);

    case 'END_SESSION':
      return await endSession(session, data);

    default:
      return { success: false, error: 'Unknown action' };
  }
}

/**
 * Report pet found
 */
async function reportPetFound(session, data) {
  const { location, photoUrl, notes, confidence } = data;

  // Create high-priority sighting
  const sighting = await prisma.caseSighting.create({
    data: {
      caseId: session.participant.assignment.caseId,
      reporterId: session.participant.userId,
      latitude: location?.lat,
      longitude: location?.lng,
      address: data.address || '',
      description: notes || 'Pet found!',
      photoUrl,
      confidence: confidence || 'HIGH',
      status: 'VERIFIED',
      isPetFound: true,
    }
  });

  // Update case status
  await prisma.case.update({
    where: { id: session.participant.assignment.caseId },
    data: {
      status: 'FOUND',
      foundById: session.participant.userId,
      foundAt: new Date(),
    }
  });

  // Notify owner immediately
  await notifyOwnerPetFound(session.participant.assignment.case, sighting);

  // Update participant stats
  await prisma.caseParticipant.update({
    where: { id: session.participantId },
    data: {
      sightingsReported: { increment: 1 },
    }
  });

  // Mark cell as pet found
  if (session.gridCellId) {
    await prisma.gridCell.update({
      where: { id: session.gridCellId },
      data: { status: 'PET_FOUND' }
    });
  }

  return {
    success: true,
    sightingId: sighting.id,
    message: 'AMAZING! You found them! The owner has been notified.',
    celebrateMode: true,
    nextAction: {
      type: 'STAY_WITH_PET',
      prompt: 'Please stay with the pet until the owner arrives',
    }
  };
}

/**
 * Report possible sighting
 */
async function reportSighting(session, data) {
  const { location, photoUrl, notes, direction, confidence } = data;

  const sighting = await prisma.caseSighting.create({
    data: {
      caseId: session.participant.assignment.caseId,
      reporterId: session.participant.userId,
      latitude: location?.lat,
      longitude: location?.lng,
      address: data.address || '',
      description: notes || 'Possible sighting',
      photoUrl,
      confidence: confidence || 'MEDIUM',
      direction: direction, // Which way was pet heading
      status: 'PENDING',
    }
  });

  // Update participant stats
  await prisma.caseParticipant.update({
    where: { id: session.participantId },
    data: { sightingsReported: { increment: 1 } }
  });

  // Notify nearby volunteers
  await notifyNearbyVolunteers(session.participant.assignment.caseId, sighting);

  return {
    success: true,
    sightingId: sighting.id,
    message: 'Sighting reported! Nearby volunteers notified.',
    nextAction: {
      type: 'CONTINUE_OR_FOLLOW',
      options: [
        { label: 'Follow the pet', action: 'FOLLOW_PET' },
        { label: 'Continue searching area', action: 'CONTINUE_SEARCH' },
      ]
    }
  };
}

/**
 * Report clue (collar, food bowl, paw prints, etc.)
 */
async function reportClue(session, data) {
  const { location, photoUrl, clueType, notes } = data;

  const clue = await prisma.caseClue.create({
    data: {
      caseId: session.participant.assignment.caseId,
      reporterId: session.participant.userId,
      latitude: location?.lat,
      longitude: location?.lng,
      clueType: clueType || 'OTHER', // COLLAR, LEASH, FOOD, TRACKS, SCAT, OTHER
      description: notes,
      photoUrl,
    }
  });

  // Mark cell as having clue
  if (session.gridCellId) {
    await prisma.gridCell.update({
      where: { id: session.gridCellId },
      data: { status: 'CLUE_FOUND' }
    });
  }

  return {
    success: true,
    clueId: clue.id,
    message: 'Clue logged! This helps narrow the search.',
    nextAction: {
      type: 'CONTINUE_SEARCH',
      prompt: 'Keep looking nearby - the pet may be close!',
    }
  };
}

/**
 * Mark area as searched (nothing found)
 */
async function markAreaSearched(session, data) {
  const { thoroughness = 'STANDARD', notes } = data;

  if (session.gridCellId) {
    await prisma.gridCell.update({
      where: { id: session.gridCellId },
      data: {
        status: thoroughness === 'QUICK' ? 'NEEDS_REVISIT' : 'SEARCHED',
        searchedById: session.participant.userId,
        searchedAt: new Date(),
        searchCount: { increment: 1 },
        notes,
        claimedById: null,
        claimedAt: null,
      }
    });
  }

  // Update participant stats
  await prisma.caseParticipant.update({
    where: { id: session.participantId },
    data: { areasMarked: { increment: 1 } }
  });

  // Get next suggested area
  const participant = session.participant;
  const currentLocation = session.currentLocation
    ? JSON.parse(session.currentLocation)
    : null;

  return {
    success: true,
    message: 'Area marked! Thank you for searching.',
    stats: {
      areasSearched: participant.areasMarked + 1,
    },
    nextAction: {
      type: 'GET_NEXT_AREA',
      prompt: 'Search another area?',
      currentLocation,
    }
  };
}

/**
 * Request help from other volunteers
 */
async function requestHelp(session, data) {
  const { helpType, message, location } = data;

  // Create help request
  await prisma.helpRequest.create({
    data: {
      sessionId: session.id,
      caseId: session.participant.assignment.caseId,
      requesterId: session.participant.userId,
      helpType: helpType || 'GENERAL', // FOUND_PET, INJURED_ANIMAL, NEED_BACKUP, GENERAL
      message: message || 'Volunteer needs assistance',
      latitude: location?.lat,
      longitude: location?.lng,
      status: 'ACTIVE',
    }
  });

  // Notify squad leaders and nearby volunteers
  await notifyHelpRequest(session);

  return {
    success: true,
    message: 'Help request sent! Someone will respond shortly.',
  };
}

/**
 * Pause search session
 */
async function pauseSession(session, data) {
  const { reason } = data;

  await prisma.searchSession.update({
    where: { id: session.id },
    data: {
      status: 'PAUSED',
      pausedAt: new Date(),
      pauseReason: reason,
    }
  });

  // Release cell claim so others can search
  if (session.gridCellId) {
    await prisma.gridCell.update({
      where: { id: session.gridCellId },
      data: {
        claimedById: null,
        claimedAt: null,
        status: 'UNSEARCHED', // Return to unsearched
      }
    });
  }

  return {
    success: true,
    message: 'Session paused. Take your time!',
    canResume: true,
  };
}

/**
 * Resume paused session
 */
async function resumeSession(session, data) {
  await prisma.searchSession.update({
    where: { id: session.id },
    data: {
      status: 'ACTIVE',
      pausedAt: null,
      pauseReason: null,
    }
  });

  return {
    success: true,
    message: 'Welcome back! Ready to continue searching.',
  };
}

/**
 * End search session
 */
async function endSession(session, data) {
  const { reason, totalMinutes } = data;

  // Calculate search time
  const startTime = session.startedAt || session.createdAt;
  const searchMinutes = totalMinutes ||
    Math.round((Date.now() - new Date(startTime).getTime()) / 60000);

  await prisma.searchSession.update({
    where: { id: session.id },
    data: {
      status: 'COMPLETED',
      endedAt: new Date(),
      endReason: reason || 'Volunteer ended session',
      totalMinutes: searchMinutes,
    }
  });

  // Update participant search hours
  await prisma.caseParticipant.update({
    where: { id: session.participantId },
    data: {
      searchHours: { increment: searchMinutes / 60 }
    }
  });

  // Release any claimed cell
  if (session.gridCellId) {
    await prisma.gridCell.update({
      where: { id: session.gridCellId },
      data: {
        claimedById: null,
        claimedAt: null,
      }
    });
  }

  return {
    success: true,
    message: 'Thanks for helping! Every search makes a difference.',
    sessionSummary: {
      searchMinutes,
      areasMarked: session.participant.areasMarked,
      sightingsReported: session.participant.sightingsReported,
    },
    nextAction: {
      type: 'VIEW_IMPACT',
      prompt: 'See your impact',
      url: `/search/${session.participant.assignment.caseId}/impact`,
    }
  };
}

// Push notification helpers
async function notifyOwnerPetFound(caseData, sighting) {
  try {
    if (!caseData?.reporterId) {
      console.log('No reporter ID for case, cannot notify owner');
      return;
    }

    const payload = PUSH_TEMPLATES.SIGHTING_ALERT(
      caseData.petName || 'Your pet',
      sighting?.location?.address || 'a location',
      caseData.id
    );

    // Make it more urgent for potential find
    payload.title = '🎉 Possible Pet Sighting!';
    payload.body = `Someone may have spotted ${caseData.petName}! Tap to view details and location.`;
    payload.requireInteraction = true;
    payload.vibrate = [200, 100, 200];

    await sendPushToUser(prisma, caseData.reporterId, payload);
    console.log(`✅ Owner notified for potential pet find: ${caseData.petName}`);
  } catch (error) {
    console.error('Error notifying owner of pet found:', error);
  }
}

async function notifyNearbyVolunteers(caseId, sighting) {
  try {
    // Get case assignment to find squad members
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        petName: true,
        caseNumber: true,
        assignment: {
          select: {
            participants: {
              where: { isActive: true },
              select: { userId: true }
            }
          }
        }
      }
    });

    if (!caseData?.assignment?.participants) return;

    const userIds = caseData.assignment.participants.map(p => p.userId).filter(Boolean);
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

    const payload = PUSH_TEMPLATES.SIGHTING_ALERT(
      caseData.petName || 'Pet',
      sighting?.location?.address || 'nearby',
      caseId
    );
    payload.url = `/cases/${caseData.caseNumber}`;

    const result = await sendPushToMany(formattedSubs, payload);
    console.log(`✅ Nearby volunteers notified: ${result.sent} sent`);
  } catch (error) {
    console.error('Error notifying nearby volunteers:', error);
  }
}

async function notifyHelpRequest(session) {
  try {
    if (!session?.participant?.assignment) return;

    // Get squad leaders for this assignment
    const assignment = await prisma.caseAssignment.findUnique({
      where: { id: session.participant.assignment.id },
      select: {
        rescueSquad: {
          select: {
            members: {
              where: {
                role: { in: ['FOUNDER', 'LEADER', 'COORDINATOR'] },
                isActive: true
              },
              select: { userId: true }
            }
          }
        },
        case: {
          select: { petName: true, caseNumber: true }
        }
      }
    });

    if (!assignment?.rescueSquad?.members) return;

    const leaderIds = assignment.rescueSquad.members.map(m => m.userId).filter(Boolean);
    if (leaderIds.length === 0) return;

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: { in: leaderIds }, isActive: true },
      select: { id: true, subscription: true }
    });

    if (subscriptions.length === 0) return;

    const formattedSubs = subscriptions.map(sub => ({
      id: sub.id,
      subscription: JSON.parse(sub.subscription),
    }));

    const volunteerName = session.participant?.user?.firstName || 'A volunteer';
    const payload = PUSH_TEMPLATES.GENERIC(
      '🆘 Help Requested',
      `${volunteerName} needs assistance during search for ${assignment.case?.petName || 'pet'}`,
      `/cases/${assignment.case?.caseNumber}`
    );
    payload.tag = `help-${session.id}`;
    payload.requireInteraction = true;

    const result = await sendPushToMany(formattedSubs, payload);
    console.log(`✅ Help request sent to ${result.sent} leaders`);
  } catch (error) {
    console.error('Error sending help request notification:', error);
  }
}

export default {
  startFieldMode,
  updateLocation,
  handleFieldAction,
  getFieldActions,
};
