import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';

// NOTE: Requires Prisma to be set up (see SETUP.md)

export async function GET(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        patrolProfile: true,
        cases: {
          where: {
            status: 'ACTIVE',
            reportType: 'LOST' // Only fetch LOST reports for Owner View
          },
          select: {
            id: true,
            caseNumber: true,
            petName: true,
            petSpecies: true,
            petPhotoUrl: true,
            lastSeenAt: true,
            lastSeenAddress: true,
            status: true,
            pet: true,
          }
        },
        profile: true,
        // Include rescue force memberships
        rescueForceMemberships: {
          where: { isActive: true },
          include: {
            rescueForce: {
              select: {
                id: true,
                name: true,
                city: true,
                state: true,
                logoUrl: true,
                photoUrl: true,
                rescueForceLevel: true,
                totalCasesCompleted: true,
                successfulReunions: true,
                isActive: true,
                _count: {
                  select: {
                    members: { where: { isActive: true } },
                  }
                }
              }
            },
            division: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        // Include case participations (active searches user is helping with)
        caseParticipations: {
          where: { isActive: true },
          include: {
            assignment: {
              include: {
                case: {
                  select: {
                    id: true,
                    petName: true,
                    petSpecies: true,
                    lastSeenAddress: true,
                    status: true,
                    lastSeenAt: true,
                    caseNumber: true,
                  }
                },
                rescueForce: {
                  select: {
                    id: true,
                    name: true,
                  }
                },
                _count: {
                  select: {
                    participants: { where: { isActive: true } }
                  }
                }
              }
            }
          }
        },
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('📊 Dashboard: User found:', user.id, user.email);
    console.log('📊 Dashboard: Raw memberships:', JSON.stringify(user.rescueForceMemberships || [], null, 2));

    // Get sighting counts for each case
    const missionIds = user.cases.map(c => c.id);
    const sightingCounts = await prisma.caseSighting.groupBy({
      by: ['missionId'],
      where: { missionId: { in: missionIds } },
      _count: { id: true }
    });
    const sightingMap = Object.fromEntries(
      sightingCounts.map(s => [s.missionId, s._count.id])
    );

    // Get Mission Control status for each case
    const missionStatuses = await prisma.missionControl.findMany({
      where: { caseId: { in: missionIds } },
      select: {
        caseId: true,
        mode: true,
        activatedAt: true,
        activeVolunteers: {
          where: { status: 'ACTIVE' },
          select: { id: true }
        }
      }
    });
    const missionMap = Object.fromEntries(
      missionStatuses.map(m => [m.caseId, {
        isLive: ['LIVE_SEARCH', 'CONTAINMENT', 'TRAP_OPS'].includes(m.mode),
        mode: m.mode,
        activeVolunteers: m.activeVolunteers?.length || 0,
        activatedAt: m.activatedAt
      }])
    );

    // Build unified missions list (cases user owns OR is participating in)
    const ownedCaseIds = new Set(user.cases.map(c => c.id));
    const participatingCaseIds = new Set(
      user.caseParticipations
        .filter(p => p.assignment?.case)
        .map(p => p.assignment.case.id)
    );

    // Get all unique case IDs user is involved with
    const allInvolvedCaseIds = [...new Set([...ownedCaseIds, ...participatingCaseIds])];

    // Fetch force assignments for all involved cases
    const caseAssignments = await prisma.caseAssignment.findMany({
      where: {
        missionId: { in: allInvolvedCaseIds },
        status: 'ACCEPTED'
      },
      include: {
        rescueForce: {
          select: {
            id: true,
            name: true,
          }
        },
        _count: {
          select: {
            participants: { where: { isActive: true } }
          }
        }
      }
    });

    // Group assignments by case
    const assignmentsByCaseId = {};
    for (const assignment of caseAssignments) {
      if (!assignmentsByCaseId[assignment.missionId]) {
        assignmentsByCaseId[assignment.missionId] = [];
      }
      assignmentsByCaseId[assignment.missionId].push({
        forceId: assignment.rescueForce.id,
        forceName: assignment.rescueForce.name,
        volunteerCount: assignment._count.participants,
      });
    }

    // Build missions from owned cases
    console.log('📊 Dashboard: User cases:', user.cases.map(c => ({ id: c.id, caseNumber: c.caseNumber, petName: c.petName })));
    const missions = user.cases.map(caseItem => {
      const hoursMissing = caseItem.lastSeenAt
        ? Math.floor((Date.now() - new Date(caseItem.lastSeenAt).getTime()) / 3600000)
        : 0;
      const mission = missionMap[caseItem.id] || { isLive: false, activeVolunteers: 0 };
      const squadsHelping = assignmentsByCaseId[caseItem.id] || [];

      return {
        id: caseItem.id,
        missionNumber: caseItem.caseNumber,
        petName: caseItem.petName,
        petSpecies: caseItem.petSpecies,
        petPhotoUrl: caseItem.petPhotoUrl,
        lastSeen: formatTime(caseItem.lastSeenAt),
        hoursMissing,
        sightings: sightingMap[caseItem.id] || 0,
        status: caseItem.status,
        isLive: mission.isLive,
        activeVolunteers: mission.activeVolunteers,
        missionMode: mission.mode,
        isOwner: true,
        squadsHelping,
        totalVolunteers: squadsHelping.reduce((sum, s) => sum + s.volunteerCount, 0),
      };
    });

    // Add cases user is participating in but doesn't own
    for (const participation of user.caseParticipations) {
      if (!participation.assignment?.case) continue;
      const caseItem = participation.assignment.case;

      // Skip if already in missions (user owns it)
      if (ownedCaseIds.has(caseItem.id)) continue;

      const hoursMissing = caseItem.lastSeenAt
        ? Math.floor((Date.now() - new Date(caseItem.lastSeenAt).getTime()) / 3600000)
        : 0;
      const squadsHelping = assignmentsByCaseId[caseItem.id] || [];

      missions.push({
        id: caseItem.id,
        missionNumber: caseItem.caseNumber,
        petName: caseItem.petName,
        petSpecies: caseItem.petSpecies,
        petPhotoUrl: null,
        lastSeen: formatTime(caseItem.lastSeenAt),
        hoursMissing,
        sightings: 0,
        status: caseItem.status,
        isLive: false,
        activeVolunteers: 0,
        missionMode: null,
        isOwner: false,
        squadsHelping,
        totalVolunteers: squadsHelping.reduce((sum, s) => sum + s.volunteerCount, 0),
        mySquad: participation.assignment.rescueForce?.name,
      });
    }

    // Legacy format for backwards compatibility
    const reports = user.cases.map(caseItem => {
      const hoursMissing = caseItem.lastSeenAt
        ? Math.floor((Date.now() - new Date(caseItem.lastSeenAt).getTime()) / 3600000)
        : 0;
      const mission = missionMap[caseItem.id] || { isLive: false, activeVolunteers: 0 };

      return {
        id: caseItem.id,
        missionNumber: caseItem.caseNumber,
        petName: caseItem.petName,
        petSpecies: caseItem.petSpecies,
        petPhotoUrl: caseItem.petPhotoUrl,
        lastSeen: formatTime(caseItem.lastSeenAt),
        hoursMissing,
        sightings: sightingMap[caseItem.id] || 0,
        status: caseItem.status,
        isLive: mission.isLive,
        activeVolunteers: mission.activeVolunteers,
        missionMode: mission.mode,
      };
    });

    // If patrol member, find nearby alerts and user's found pets
    let nearbyAlerts = [];
    let foundByMe = [];
    if (user.patrolProfile && user.profile) {
      const { latitude, longitude } = user.profile;
      const { radiusMiles } = user.patrolProfile;

      // Get user's FOUND reports
      const myFoundReports = await prisma.case.findMany({
        where: {
          status: 'ACTIVE',
          reporterId: user.id,
          reportType: 'FOUND', // Pets I found
        },
      });

      foundByMe = myFoundReports.map(caseItem => ({
        id: caseItem.id,
        petName: caseItem.petName,
        species: caseItem.petSpecies.toLowerCase(),
        foundAt: formatTime(caseItem.lastSeenAt),
      }));

      // Get all active LOST reports including own (REAL data from database)
      const allReports = await prisma.case.findMany({
        where: {
          status: 'ACTIVE',
          reportType: 'LOST', // Only show LOST pets to help find
        },
      });

      // Filter by distance - show REAL count (0 if none nearby)
      nearbyAlerts = allReports
        .map(caseItem => {
          const distance = calculateDistance(
            latitude, longitude,
            caseItem.lastSeenLatitude, caseItem.lastSeenLongitude
          );
          return { ...caseItem, distance };
        })
        .filter(caseItem => caseItem.distance <= radiusMiles)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10)
        .map(caseItem => ({
          id: caseItem.id,
          petName: caseItem.petName,
          species: caseItem.petSpecies.toLowerCase(),
          lastSeen: formatTime(caseItem.lastSeenAt),
          distance: `${caseItem.distance.toFixed(1)} miles`,
        }));
    }

    // Format force memberships - filter out inactive forces and null values
    console.log('📊 Dashboard: rescueForceMemberships count:', user.rescueForceMemberships?.length || 0);
    if (user.rescueForceMemberships?.length > 0) {
      console.log('📊 Dashboard: First membership:', JSON.stringify(user.rescueForceMemberships[0], null, 2));
    }

    const forces = user.rescueForceMemberships
      .filter(membership => membership.rescueForce && membership.rescueForce.isActive)
      .map(membership => ({
        id: membership.rescueForce.id,
        name: membership.rescueForce.name,
        city: membership.rescueForce.city,
        state: membership.rescueForce.state,
        logoUrl: membership.rescueForce.logoUrl,
        photoUrl: membership.rescueForce.photoUrl,
        level: membership.rescueForce.rescueForceLevel,
        memberCount: membership.rescueForce._count.members,
        totalCasesCompleted: membership.rescueForce.totalCasesCompleted,
        successfulReunions: membership.rescueForce.successfulReunions,
        myRole: membership.role,
        division: membership.division,
        joinedAt: membership.joinedAt,
        // Personal stats within this force
        casesParticipated: membership.casesParticipated,
        searchHours: membership.searchHours,
        areasMarked: membership.areasMarked,
    }));

    // Format active case participations
    const activeMissions = user.caseParticipations
      .filter(p => p.assignment?.case)
      .map(participation => ({
        id: participation.assignment.case.id,
        missionNumber: participation.assignment.case.caseNumber,
        petName: participation.assignment.case.petName,
        petSpecies: participation.assignment.case.petSpecies,
        location: participation.assignment.case.lastSeenAddress,
        status: participation.assignment.case.status,
        lastSeenAt: participation.assignment.case.lastSeenAt,
        assignmentId: participation.assignment.id,
        forceName: participation.assignment.rescueForce?.name,
        activeVolunteers: participation.assignment._count.participants,
        myContribution: {
          areasMarked: participation.areasMarked,
          sightingsReported: participation.sightingsReported,
          searchHours: participation.searchHours,
        }
      }));

    // First, cleanup any stale GPS sessions (older than 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    await prisma.searchSession.updateMany({
      where: {
        userId: user.id,
        status: { in: ['READY', 'ACTIVE'] },
        startedAt: { lt: thirtyMinutesAgo },
      },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
        endReason: 'AUTO_CLEANUP',
      },
    });

    // Fetch ONLY recent active GPS search sessions (started within last 30 min)
    const activeSearchSessions = await prisma.searchSession.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        startedAt: { gte: thirtyMinutesAgo },
      },
      select: {
        id: true,
        missionId: true,
        status: true,
        startedAt: true,
        validatedDistanceMiles: true,
      },
    });

    // Get case details for active searches
    const activeSearchCaseIds = activeSearchSessions.map(s => s.missionId);
    const activeSearchCases = activeSearchCaseIds.length > 0
      ? await prisma.case.findMany({
          where: { id: { in: activeSearchCaseIds } },
          select: {
            id: true,
            petName: true,
            petSpecies: true,
            caseNumber: true,
          },
        })
      : [];

    const activeSearchCaseMap = Object.fromEntries(
      activeSearchCases.map(c => [c.id, c])
    );

    const activeSearches = activeSearchSessions.map(session => ({
      id: session.id,
      missionId: session.missionId,
      petName: activeSearchCaseMap[session.missionId]?.petName || 'Unknown',
      petSpecies: activeSearchCaseMap[session.missionId]?.petSpecies || 'PET',
      caseNumber: activeSearchCaseMap[session.missionId]?.caseNumber,
      startedAt: session.startedAt,
      durationMinutes: Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 60000),
      distanceMiles: session.validatedDistanceMiles || 0,
    }));

    // Admin: Fetch all registered members
    let allMembers = [];
    const isAdmin = user.role === 'ADMIN';

    if (isAdmin) {
      const allUsers = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          rescueLevel: true,
          createdAt: true,
          lastLoginAt: true,
          emailVerified: true,
          profileImage: true,
          forcesJoinedCount: true,
          areasMarkedCount: true,
          successfulReunions: true,
          _count: {
            select: {
              cases: true,
              rescueForceMemberships: { where: { isActive: true } },
            }
          }
        }
      });

      allMembers = allUsers.map(u => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        rescueLevel: u.rescueLevel,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        emailVerified: !!u.emailVerified,
        profileImage: u.profileImage,
        forcesJoinedCount: u.forcesJoinedCount || u._count.rescueForceMemberships,
        areasMarkedCount: u.areasMarkedCount || 0,
        successfulReunions: u.successfulReunions || 0,
        casesCount: u._count.cases,
        squadsCount: u._count.rescueForceMemberships,
      }));
    }

    return NextResponse.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        rescueLevel: user.rescueLevel,
        forcesJoinedCount: user.forcesJoinedCount,
        areasMarkedCount: user.areasMarkedCount,
        totalAcreageSearched: user.totalAcreageSearched,
        successfulReunions: user.successfulReunions,
        honorsReceived: user.honorsReceived,
        hasPatrolProfile: !!user.patrolProfile,
        hasReports: reports.length > 0,
      },
      hasPatrolProfile: !!user.patrolProfile,
      reports, // LOST pets I reported - Will be [] if no reports
      nearbyAlerts, // Nearby LOST pets from others - Will be [] if none
      foundByMe, // FOUND pets I reported - Will be [] if none
      forces, // Forces user belongs to
      activeMissions, // Cases user is actively helping with
      missions, // Unified list: all cases user is involved with (owner or volunteer)
      activeSearches, // Active GPS search sessions
      // Admin-only data
      ...(isAdmin && { allMembers }),
    });

  } catch (error) {
    console.error('❌ Dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard', details: error.message },
      { status: 500 }
    );
  }
}

function formatTime(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return 'Less than an hour ago';
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
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
