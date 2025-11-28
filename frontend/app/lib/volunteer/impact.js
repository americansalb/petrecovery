/**
 * Phase 8: Impact Feed
 *
 * Shows volunteers their contribution and its effect on the search.
 * "Your search helped narrow the area. Max was found 2 blocks from where you looked!"
 */

import prisma from '@/app/lib/prisma';

/**
 * Get personalized impact summary for a volunteer
 */
export async function getImpactSummary(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      rescueLevel: true,
      totalAcreageSearched: true,
      successfulReunions: true,
      honorsReceived: true,
      createdAt: true,
    }
  });

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Get all participations
  const participations = await prisma.caseParticipant.findMany({
    where: { userId },
    include: {
      assignment: {
        include: {
          case: {
            select: {
              id: true,
              petName: true,
              petSpecies: true,
              petPhotoUrl: true,
              status: true,
              createdAt: true,
              foundAt: true,
              foundById: true,
            }
          },
          rescueSquad: {
            select: { name: true }
          }
        }
      }
    }
  });

  // Calculate stats
  let totalSearchHours = 0;
  let totalAreasSearched = 0;
  let totalSightings = 0;
  let casesHelped = participations.length;
  let reunionsContributed = 0;
  let petDirectlyFound = 0;

  const caseDetails = [];

  for (const p of participations) {
    totalSearchHours += p.searchHours;
    totalAreasSearched += p.areasMarked;
    totalSightings += p.sightingsReported;

    const caseData = p.assignment.case;

    if (caseData.status === 'REUNITED' || caseData.status === 'FOUND') {
      reunionsContributed++;

      if (caseData.foundById === userId) {
        petDirectlyFound++;
      }
    }

    caseDetails.push({
      caseId: caseData.id,
      petName: caseData.petName,
      petSpecies: caseData.petSpecies,
      petPhotoUrl: caseData.petPhotoUrl,
      status: caseData.status,
      squadName: p.assignment.rescueSquad?.name,
      myContribution: {
        searchHours: p.searchHours,
        areasMarked: p.areasMarked,
        sightingsReported: p.sightingsReported,
      },
      wasITheFinder: caseData.foundById === userId,
      helpedReunite: caseData.status === 'REUNITED' || caseData.status === 'FOUND',
    });
  }

  // Calculate impact score (gamified metric)
  const impactScore = calculateImpactScore({
    searchHours: totalSearchHours,
    areasSearched: totalAreasSearched,
    sightings: totalSightings,
    reunions: reunionsContributed,
    petsFound: petDirectlyFound,
  });

  // Get recent impact stories
  const impactStories = await getImpactStories(userId, participations);

  return {
    success: true,
    user: {
      name: user.firstName,
      rescueLevel: user.rescueLevel,
      memberSince: user.createdAt,
    },
    lifetime: {
      searchHours: Math.round(totalSearchHours * 10) / 10,
      areasSearched: totalAreasSearched,
      sightingsReported: totalSightings,
      casesHelped,
      reunionsContributed,
      petsDirectlyFound: petDirectlyFound,
      impactScore,
    },
    cases: caseDetails,
    stories: impactStories,
    nextMilestone: getNextMilestone(impactScore),
  };
}

/**
 * Calculate impact score
 */
function calculateImpactScore(stats) {
  // Weighted scoring system
  const weights = {
    searchHours: 10,      // 10 points per hour
    areasSearched: 5,     // 5 points per area
    sightings: 25,        // 25 points per sighting
    reunions: 100,        // 100 points per reunion helped
    petsFound: 500,       // 500 points for directly finding pet
  };

  return Math.round(
    stats.searchHours * weights.searchHours +
    stats.areasSearched * weights.areasSearched +
    stats.sightings * weights.sightings +
    stats.reunions * weights.reunions +
    stats.petsFound * weights.petsFound
  );
}

/**
 * Get next milestone for user
 */
function getNextMilestone(currentScore) {
  const milestones = [
    { score: 100, name: 'First Steps', badge: '🐾' },
    { score: 500, name: 'Helping Hand', badge: '🤝' },
    { score: 1000, name: 'Dedicated Searcher', badge: '🔍' },
    { score: 2500, name: 'Community Hero', badge: '🦸' },
    { score: 5000, name: 'Rescue Veteran', badge: '⭐' },
    { score: 10000, name: 'Elite Rescuer', badge: '🏆' },
    { score: 25000, name: 'Legend', badge: '👑' },
  ];

  for (const milestone of milestones) {
    if (currentScore < milestone.score) {
      return {
        name: milestone.name,
        badge: milestone.badge,
        pointsNeeded: milestone.score - currentScore,
        progress: Math.round((currentScore / milestone.score) * 100),
      };
    }
  }

  return {
    name: 'Legend',
    badge: '👑',
    achieved: true,
    progress: 100,
  };
}

/**
 * Generate personalized impact stories
 */
async function getImpactStories(userId, participations) {
  const stories = [];

  for (const p of participations) {
    const caseData = p.assignment.case;

    // Story: You found the pet!
    if (caseData.foundById === userId && caseData.status === 'REUNITED') {
      stories.push({
        type: 'HERO_MOMENT',
        title: `You found ${caseData.petName}!`,
        body: `Your search efforts led directly to finding ${caseData.petName}. The owner is forever grateful!`,
        petName: caseData.petName,
        petPhotoUrl: caseData.petPhotoUrl,
        timestamp: caseData.foundAt,
        badge: '🏆',
      });
    }

    // Story: Contributed to reunion
    else if (caseData.status === 'REUNITED' && p.areasMarked > 0) {
      stories.push({
        type: 'CONTRIBUTION',
        title: `${caseData.petName} is home!`,
        body: `You searched ${p.areasMarked} areas for ${caseData.petName}. Your effort helped narrow down the search!`,
        petName: caseData.petName,
        petPhotoUrl: caseData.petPhotoUrl,
        timestamp: caseData.foundAt,
        badge: '🎉',
      });
    }

    // Story: Significant search effort
    else if (p.searchHours >= 2) {
      stories.push({
        type: 'DEDICATION',
        title: `${Math.round(p.searchHours)} hours searching`,
        body: `You spent ${Math.round(p.searchHours)} hours looking for ${caseData.petName}. That dedication matters!`,
        petName: caseData.petName,
        petPhotoUrl: caseData.petPhotoUrl,
        timestamp: p.optedInAt,
        badge: '⏱️',
      });
    }

    // Story: Reported a sighting
    if (p.sightingsReported > 0) {
      stories.push({
        type: 'SIGHTING',
        title: 'Your eyes on the ground',
        body: `You reported ${p.sightingsReported} sighting${p.sightingsReported > 1 ? 's' : ''} for ${caseData.petName}. Every lead helps!`,
        petName: caseData.petName,
        petPhotoUrl: caseData.petPhotoUrl,
        timestamp: p.optedInAt,
        badge: '👀',
      });
    }
  }

  // Sort by timestamp, most recent first
  stories.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return stories.slice(0, 10); // Return top 10 stories
}

/**
 * Get case-specific impact for volunteer
 */
export async function getCaseImpact(caseId, userId) {
  const participation = await prisma.caseParticipant.findFirst({
    where: {
      userId,
      assignment: { caseId },
    },
    include: {
      assignment: {
        include: {
          case: true,
          _count: {
            select: { participants: true }
          }
        }
      }
    }
  });

  if (!participation) {
    return { success: false, error: 'Not a participant in this case' };
  }

  const caseData = participation.assignment.case;
  const totalVolunteers = participation.assignment._count.participants;

  // Get grid coverage
  const grid = await prisma.searchGrid.findFirst({
    where: { caseId },
  });

  // Calculate contribution percentage
  const myContributionPercent = grid
    ? Math.round((participation.areasMarked / grid.totalCells) * 100)
    : 0;

  // Check proximity if pet was found
  let proximityInfo = null;
  if (caseData.status === 'FOUND' || caseData.status === 'REUNITED') {
    // Get where pet was found
    const foundSighting = await prisma.caseSighting.findFirst({
      where: { caseId, isPetFound: true },
    });

    if (foundSighting) {
      // Get areas I searched
      const mySearchedCells = await prisma.gridCell.findMany({
        where: {
          grid: { caseId },
          searchedById: userId,
        },
      });

      // Calculate closest distance
      let closestDistance = Infinity;
      for (const cell of mySearchedCells) {
        const distance = haversineDistance(
          foundSighting.latitude,
          foundSighting.longitude,
          cell.centerLatitude,
          cell.centerLongitude
        );
        if (distance < closestDistance) {
          closestDistance = distance;
        }
      }

      if (closestDistance < Infinity) {
        proximityInfo = {
          distance: closestDistance,
          distanceText: closestDistance < 0.1
            ? `${Math.round(closestDistance * 5280)} feet`
            : `${closestDistance.toFixed(1)} miles`,
          wasClose: closestDistance < 0.25, // Within quarter mile
        };
      }
    }
  }

  return {
    success: true,
    case: {
      petName: caseData.petName,
      status: caseData.status,
      isResolved: caseData.status === 'FOUND' || caseData.status === 'REUNITED',
    },
    myContribution: {
      searchHours: participation.searchHours,
      areasMarked: participation.areasMarked,
      sightingsReported: participation.sightingsReported,
      contributionPercent: myContributionPercent,
    },
    teamStats: {
      totalVolunteers,
      gridCoverage: grid ? Math.round((grid.cellsSearched / grid.totalCells) * 100) : 0,
    },
    proximityInfo,
    wasITheFinder: caseData.foundById === userId,
  };
}

/**
 * Get thank you message from owner
 */
export async function getOwnerThankYou(caseId, userId) {
  const thankYou = await prisma.ownerThankYou.findFirst({
    where: {
      caseId,
      OR: [
        { recipientId: userId },
        { recipientId: null }, // General thank you to all volunteers
      ]
    },
    include: {
      case: {
        select: {
          petName: true,
          petPhotoUrl: true,
          ownerName: true,
        }
      }
    }
  });

  if (!thankYou) {
    return null;
  }

  return {
    message: thankYou.message,
    photoUrl: thankYou.photoUrl, // Reunion photo
    petName: thankYou.case.petName,
    petPhotoUrl: thankYou.case.petPhotoUrl,
    ownerName: thankYou.case.ownerName,
    createdAt: thankYou.createdAt,
  };
}

/**
 * Create thank you message from owner
 */
export async function createOwnerThankYou(caseId, ownerId, data) {
  const { message, photoUrl, recipientId } = data;

  // Verify owner
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
  });

  if (caseData.reporterId !== ownerId) {
    return { success: false, error: 'Only the pet owner can send thank yous' };
  }

  const thankYou = await prisma.ownerThankYou.create({
    data: {
      caseId,
      message,
      photoUrl,
      recipientId, // null for all volunteers
    }
  });

  return {
    success: true,
    thankYouId: thankYou.id,
  };
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

export default {
  getImpactSummary,
  getCaseImpact,
  getOwnerThankYou,
  createOwnerThankYou,
};
