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
          include: {
            pet: true,
          }
        },
        profile: true,
        // Include rescue squad memberships
        rescueSquadMemberships: {
          where: { isActive: true },
          include: {
            rescueSquad: {
              select: {
                id: true,
                name: true,
                city: true,
                state: true,
                rescueSquadLevel: true,
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
                rescueSquad: {
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

    // Get sighting counts for each case
    const caseIds = user.cases.map(c => c.id);
    const sightingCounts = await prisma.caseSighting.groupBy({
      by: ['caseId'],
      where: { caseId: { in: caseIds } },
      _count: { id: true }
    });
    const sightingMap = Object.fromEntries(
      sightingCounts.map(s => [s.caseId, s._count.id])
    );

    // Format reports for display - show REAL count (0 if none)
    const reports = user.cases.map(caseItem => ({
      id: caseItem.id,
      petName: caseItem.petName,
      species: caseItem.petSpecies.toLowerCase(),
      lastSeen: formatTime(caseItem.lastSeenAt),
      sightings: sightingMap[caseItem.id] || 0,
      status: caseItem.status,
    }));

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

    // Format squad memberships
    const squads = user.rescueSquadMemberships.map(membership => ({
      id: membership.rescueSquad.id,
      name: membership.rescueSquad.name,
      city: membership.rescueSquad.city,
      state: membership.rescueSquad.state,
      level: membership.rescueSquad.rescueSquadLevel,
      memberCount: membership.rescueSquad._count.members,
      totalCasesCompleted: membership.rescueSquad.totalCasesCompleted,
      successfulReunions: membership.rescueSquad.successfulReunions,
      myRole: membership.role,
      division: membership.division,
      joinedAt: membership.joinedAt,
      // Personal stats within this squad
      casesParticipated: membership.casesParticipated,
      searchHours: membership.searchHours,
      areasMarked: membership.areasMarked,
    }));

    // Format active case participations
    const activeCases = user.caseParticipations
      .filter(p => p.assignment?.case)
      .map(participation => ({
        id: participation.assignment.case.id,
        caseNumber: participation.assignment.case.caseNumber,
        petName: participation.assignment.case.petName,
        petSpecies: participation.assignment.case.petSpecies,
        location: participation.assignment.case.lastSeenAddress,
        status: participation.assignment.case.status,
        lastSeenAt: participation.assignment.case.lastSeenAt,
        assignmentId: participation.assignment.id,
        squadName: participation.assignment.rescueSquad?.name,
        activeVolunteers: participation.assignment._count.participants,
        myContribution: {
          areasMarked: participation.areasMarked,
          sightingsReported: participation.sightingsReported,
          searchHours: participation.searchHours,
        }
      }));

    return NextResponse.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        rescueLevel: user.rescueLevel,
        squadsJoinedCount: user.squadsJoinedCount,
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
      squads, // Squads user belongs to
      activeCases, // Cases user is actively helping with
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
