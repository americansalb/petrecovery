/**
 * Phase 5: Live Operations View
 *
 * Real-time dashboard showing all volunteer activity, grid coverage,
 * and coordination data for a case.
 */

import prisma from '@/app/lib/prisma';

/**
 * Get complete live operations data for a case
 */
export async function getLiveOpsData(missionId) {
  const missionData = await prisma.case.findUnique({
    where: { id: missionId },
    include: {
      assignments: {
        where: { status: 'ACCEPTED' },
        include: {
          rescueSquad: true,
          participants: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  rescueLevel: true,
                }
              }
            }
          },
        }
      },
      sightings: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    }
  });

  if (!missionData) {
    return { success: false, error: 'Mission not found' };
  }

  // Get search grid
  const grid = await prisma.searchGrid.findFirst({
    where: { missionId },
    include: {
      cells: {
        select: {
          id: true,
          row: true,
          col: true,
          centerLatitude: true,
          centerLongitude: true,
          northLat: true,
          southLat: true,
          eastLng: true,
          westLng: true,
          status: true,
          priority: true,
          claimedById: true,
          searchedAt: true,
        }
      }
    }
  });

  // Get active search sessions with live locations
  const activeSessions = await prisma.searchSession.findMany({
    where: {
      missionId,
      status: 'ACTIVE',
    },
    include: {
      participant: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              rescueLevel: true,
            }
          }
        }
      },
      gridCell: true,
      division: true,
    }
  });

  // Parse locations and format volunteer data
  const activeVolunteers = activeSessions.map(session => {
    const location = session.currentLocation
      ? JSON.parse(session.currentLocation)
      : null;

    return {
      oderId: session.participant.userId,
      odername: session.participant.user.firstName,
      sessionId: session.id,
      location,
      lastUpdate: session.lastLocationUpdate,
      assignedCell: session.gridCell ? {
        id: session.gridCell.id,
        row: session.gridCell.row,
        col: session.gridCell.col,
      } : null,
      division: session.division?.name,
      rescueLevel: session.participant.user.rescueLevel,
      status: session.status,
    };
  });

  // Calculate grid stats
  const gridStats = calculateGridStats(grid?.cells || []);

  // Get recent activity
  const recentActivity = await getRecentActivity(missionId, 20);

  // Calculate time stats
  const timeSinceReport = Date.now() - new Date(missionData.createdAt).getTime();
  const hoursActive = Math.round(timeSinceReport / (1000 * 60 * 60));

  return {
    success: true,
    case: {
      id: missionData.id,
      missionNumber: missionData.missionNumber,
      petName: missionData.petName,
      petSpecies: missionData.petSpecies,
      petPhotoUrl: missionData.petPhotoUrl,
      status: missionData.status,
      lastSeenAt: missionData.lastSeenAt,
      lastSeenLocation: {
        lat: missionData.lastSeenLatitude,
        lng: missionData.lastSeenLongitude,
        address: missionData.lastSeenAddress,
      },
      hoursActive,
    },
    grid: grid ? {
      id: grid.id,
      center: { lat: grid.centerLatitude, lng: grid.centerLongitude },
      radiusMiles: grid.radiusMiles,
      cells: grid.cells,
      stats: gridStats,
    } : null,
    volunteers: {
      active: activeVolunteers,
      total: missionData.assignments.reduce((sum, a) => sum + a.participants.length, 0),
      totalSearchHours: missionData.assignments.reduce((sum, a) =>
        sum + a.participants.reduce((h, p) => h + p.searchHours, 0), 0
      ),
    },
    sightings: missionData.sightings.map(s => ({
      id: s.id,
      location: { lat: s.latitude, lng: s.longitude },
      confidence: s.confidence,
      createdAt: s.createdAt,
      photoUrl: s.photoUrl,
    })),
    recentActivity,
  };
}

/**
 * Calculate grid statistics
 */
function calculateGridStats(cells) {
  const stats = {
    total: cells.length,
    unsearched: 0,
    inProgress: 0,
    searched: 0,
    cluesFound: 0,
    needsRevisit: 0,
    petFound: 0,
  };

  for (const cell of cells) {
    switch (cell.status) {
      case 'UNSEARCHED': stats.unsearched++; break;
      case 'IN_PROGRESS': stats.inProgress++; break;
      case 'SEARCHED': stats.searched++; break;
      case 'CLUE_FOUND': stats.cluesFound++; break;
      case 'NEEDS_REVISIT': stats.needsRevisit++; break;
      case 'PET_FOUND': stats.petFound++; break;
    }
  }

  stats.coveragePercent = stats.total > 0
    ? Math.round(((stats.searched + stats.cluesFound + stats.petFound) / stats.total) * 100)
    : 0;

  return stats;
}

/**
 * Get recent activity feed for a case
 */
async function getRecentActivity(missionId, limit = 20) {
  const activities = [];

  // Get recent sightings
  const sightings = await prisma.caseSighting.findMany({
    where: { missionId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      reporter: {
        select: { firstName: true }
      }
    }
  });

  for (const s of sightings) {
    activities.push({
      type: s.isPetFound ? 'PET_FOUND' : 'SIGHTING',
      timestamp: s.createdAt,
      user: s.reporter?.firstName || 'Volunteer',
      message: s.isPetFound
        ? `found ${s.description || 'the pet'}!`
        : `reported a possible sighting`,
      confidence: s.confidence,
      location: { lat: s.latitude, lng: s.longitude },
    });
  }

  // Get recent cell completions
  const recentCells = await prisma.gridCell.findMany({
    where: {
      grid: { missionId },
      searchedAt: { not: null },
    },
    orderBy: { searchedAt: 'desc' },
    take: limit,
    include: {
      searchedBy: {
        select: { firstName: true }
      }
    }
  });

  for (const cell of recentCells) {
    if (cell.searchedAt) {
      activities.push({
        type: 'AREA_SEARCHED',
        timestamp: cell.searchedAt,
        user: cell.searchedBy?.firstName || 'Volunteer',
        message: `searched area [${cell.row},${cell.col}]`,
        location: { lat: cell.centerLatitude, lng: cell.centerLongitude },
      });
    }
  }

  // Get recent joins
  const recentJoins = await prisma.caseParticipant.findMany({
    where: {
      assignment: { missionId },
    },
    orderBy: { optedInAt: 'desc' },
    take: limit,
    include: {
      user: {
        select: { firstName: true }
      }
    }
  });

  for (const p of recentJoins) {
    activities.push({
      type: 'VOLUNTEER_JOINED',
      timestamp: p.optedInAt,
      user: p.user?.firstName || 'Volunteer',
      message: 'joined the search',
    });
  }

  // Sort all activities by timestamp
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return activities.slice(0, limit);
}

/**
 * Get real-time volunteer positions for map
 */
export async function getVolunteerPositions(missionId) {
  const sessions = await prisma.searchSession.findMany({
    where: {
      missionId,
      status: 'ACTIVE',
      lastLocationUpdate: {
        gte: new Date(Date.now() - 5 * 60 * 1000), // Active in last 5 min
      }
    },
    select: {
      id: true,
      currentLocation: true,
      lastLocationUpdate: true,
      participant: {
        select: {
          user: {
            select: {
              id: true,
              firstName: true,
            }
          }
        }
      },
      gridCell: {
        select: {
          id: true,
          row: true,
          col: true,
        }
      }
    }
  });

  return sessions.map(s => ({
    oderId: s.participant.user.id,
    name: s.participant.user.firstName,
    location: s.currentLocation ? JSON.parse(s.currentLocation) : null,
    lastUpdate: s.lastLocationUpdate,
    assignedCell: s.gridCell,
  }));
}

/**
 * Get case statistics for dashboard
 */
export async function getCaseStats(missionId) {
  const missionData = await prisma.case.findUnique({
    where: { id: missionId },
    include: {
      _count: {
        select: {
          sightings: true,
        }
      },
      assignments: {
        include: {
          _count: {
            select: {
              participants: { where: { isActive: true } }
            }
          },
          participants: {
            select: {
              searchHours: true,
              areasMarked: true,
              sightingsReported: true,
            }
          }
        }
      }
    }
  });

  if (!missionData) {
    return null;
  }

  // Aggregate stats
  let totalVolunteers = 0;
  let totalSearchHours = 0;
  let totalAreasSearched = 0;
  let totalSightings = 0;

  for (const assignment of missionData.assignments) {
    totalVolunteers += assignment._count.participants;
    for (const p of assignment.participants) {
      totalSearchHours += p.searchHours;
      totalAreasSearched += p.areasMarked;
      totalSightings += p.sightingsReported;
    }
  }

  // Get grid coverage
  const grid = await prisma.searchGrid.findFirst({
    where: { missionId },
  });

  return {
    activeVolunteers: totalVolunteers,
    totalSearchHours: Math.round(totalSearchHours * 10) / 10,
    areasSearched: totalAreasSearched,
    sightingsReported: totalSightings,
    coveragePercent: grid
      ? Math.round((grid.cellsSearched / grid.totalCells) * 100)
      : 0,
    hoursActive: Math.round(
      (Date.now() - new Date(missionData.createdAt).getTime()) / (1000 * 60 * 60)
    ),
  };
}

export default {
  getLiveOpsData,
  getVolunteerPositions,
  getCaseStats,
};
