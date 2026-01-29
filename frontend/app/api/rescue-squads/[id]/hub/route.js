import { NextResponse } from 'next/server';
import { normalizePhotoUrl } from '@/app/lib/utils';

/**
 * Check if a point is inside a GeoJSON polygon using ray casting algorithm
 * @param {number} lat - Latitude of the point
 * @param {number} lng - Longitude of the point
 * @param {Object} geoJson - GeoJSON polygon object
 * @returns {boolean} - True if point is inside polygon
 */
function isPointInPolygon(lat, lng, geoJson) {
  if (!geoJson || geoJson.type !== 'Polygon' || !geoJson.coordinates?.[0]) {
    return false;
  }

  const polygon = geoJson.coordinates[0];
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1]; // GeoJSON is [lng, lat]
    const yi = polygon[i][0];
    const xj = polygon[j][1];
    const yj = polygon[j][0];

    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculate distance between two lat/lng points using Haversine formula
 * @returns {number} - Distance in miles
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Assign a case to the most appropriate division based on location
 * @param {Object} missionData - Case with lastSeenLatitude and lastSeenLongitude
 * @param {Array} divisions - Array of division objects
 * @returns {string|null} - Division ID or null
 */
function assignCaseToDivision(missionData, divisions) {
  const caseLat = missionData.lastSeenLatitude;
  const caseLng = missionData.lastSeenLongitude;

  if (!caseLat || !caseLng || !divisions || divisions.length === 0) {
    return divisions[0]?.id || null;
  }

  // First, try to find a division with a polygon boundary that contains the point
  for (const division of divisions) {
    if (division.customBoundary) {
      try {
        const boundary = typeof division.customBoundary === 'string'
          ? JSON.parse(division.customBoundary)
          : division.customBoundary;

        if (isPointInPolygon(caseLat, caseLng, boundary)) {
          return division.id;
        }
      } catch (e) {
        console.error('Error parsing division boundary:', e);
      }
    }
  }

  // Fallback: find nearest division by center point and check if within radius
  let nearestDivision = null;
  let minDistance = Infinity;

  for (const division of divisions) {
    if (division.centerLatitude && division.centerLongitude) {
      const distance = calculateDistance(
        caseLat,
        caseLng,
        division.centerLatitude,
        division.centerLongitude
      );

      const radiusMiles = division.radiusMiles || 3;
      if (distance <= radiusMiles && distance < minDistance) {
        minDistance = distance;
        nearestDivision = division;
      }
    }
  }

  // Return nearest division within radius, or first division as last resort
  return nearestDivision?.id || divisions[0]?.id || null;
}

/**
 * GET /api/rescue-squads/[id]/hub
 *
 * Returns all data needed for the Squad Hub in a single API call.
 * This aggregates squad info, membership, divisions, cases, chat, etc.
 */
export async function GET(request, { params }) {
  try {
    // Dynamic imports to prevent module crash if Prisma not generated
    let prisma, getServerSession, authOptions;
    try {
      prisma = (await import('@/app/lib/prisma')).default;
      const nextAuth = await import('next-auth');
      getServerSession = nextAuth.getServerSession;
      // Import authOptions from the lib file where it's actually exported
      const authModule = await import('@/app/lib/auth');
      authOptions = authModule.authOptions;
    } catch (importError) {
      console.error('Database not available:', importError.message);
      return NextResponse.json(
        { error: 'Database not available', fallbackToMock: true },
        { status: 503 }
      );
    }

    const session = await getServerSession(authOptions);
    const squadIdOrSlug = params.id;

    // Try to find squad by ID first, then by city name (slug)
    let squad = await prisma.rescueSquad.findUnique({
      where: { id: squadIdOrSlug },
      include: {
        divisions: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
        _count: {
          select: {
            members: { where: { isActive: true } },
          },
        },
      },
    });

    // If not found by ID, try to find by city name (case-insensitive)
    if (!squad) {
      const cityName = squadIdOrSlug.replace(/-/g, ' ');
      squad = await prisma.rescueSquad.findFirst({
        where: {
          city: { equals: cityName, mode: 'insensitive' },
          isActive: true,
        },
        include: {
          divisions: {
            where: { isActive: true },
            orderBy: { name: 'asc' },
          },
          _count: {
            select: {
              members: { where: { isActive: true } },
            },
          },
        },
      });
    }

    if (!squad) {
      return NextResponse.json({ error: 'Rescue force not found' }, { status: 404 });
    }

    // Use the actual squad ID for subsequent queries
    const squadId = squad.id;

    console.log('[Hub Debug] Found squad:', { id: squadId, name: squad.name, city: squad.city });
    console.log('[Hub Debug] Session:', { hasSession: !!session, hasUser: !!session?.user, userId: session?.user?.id });

    // Check user's membership status
    let membership = {
      isMember: false,
      isOnDuty: false,
      homeDivisionId: null,
      divisionIds: [],
      role: null,
    };

    if (session?.user?.id) {
      const userMembership = await prisma.rescueSquadMember.findFirst({
        where: {
          rescueSquadId: squadId,
          userId: session.user.id,
          isActive: true,
        },
        include: {
          division: true,
        },
      });

      console.log('[Hub Debug] Membership query result:', {
        squadId,
        userId: session.user.id,
        found: !!userMembership,
        membershipId: userMembership?.id,
        isActive: userMembership?.isActive
      });

      if (userMembership) {
        membership = {
          isMember: true,
          isOnDuty: userMembership.availabilityStatus === 'AVAILABLE',
          homeDivisionId: userMembership.divisionId,
          divisionIds: userMembership.divisionId ? [userMembership.divisionId] : [],
          role: userMembership.role,
        };
      }
    } else {
      console.log('[Hub Debug] No session.user.id - skipping membership check');
    }

    // Get cases assigned to this squad
    const caseAssignments = await prisma.caseAssignment.findMany({
      where: {
        rescueSquadId: squadId,
        status: { in: ['ACCEPTED', 'ACTIVE', 'STANDBY', 'COMPLETED'] },
      },
      include: {
        case: true,
        participants: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { acceptedAt: 'desc' },
    });

    console.log('[Hub Debug] Found caseAssignments:', caseAssignments.length);
    if (caseAssignments.length > 0) {
      console.log('[Hub Debug] Assignment details:');
      caseAssignments.forEach((assignment, idx) => {
        console.log(`  [${idx}] ID: ${assignment.id}, CaseID: ${assignment.missionId}, Status: ${assignment.status}, PetName: ${assignment.case?.petName}, CaseStatus: ${assignment.case?.status}`);
      });
    }

    // Transform cases to hub format
    const cases = caseAssignments.map(assignment => {
      const c = assignment.case;
      const isUserHelper = session?.user?.id
        ? assignment.participants.some(p => p.userId === session.user.id)
        : false;

      // Determine urgency based on time since last seen
      const hoursSinceLastSeen = c.lastSeenAt
        ? Math.floor((Date.now() - new Date(c.lastSeenAt).getTime()) / 3600000)
        : 0;
      let urgency = 'LOW';
      if (hoursSinceLastSeen < 24) urgency = 'HIGH';
      else if (hoursSinceLastSeen < 72) urgency = 'MEDIUM';

      // Map case status to hub status
      let status = 'ACTIVE';
      if (c.status === 'RESOLVED' || c.resolution === 'REUNITED') status = 'REUNITED';
      else if (c.status === 'CLOSED' || c.resolution) status = 'CLOSED_OTHER';
      else if (assignment.status === 'ACCEPTED') status = 'PENDING';
      else if (assignment.status === 'ACTIVE') status = 'IN_PROGRESS';

      // Get photo URL from petPhotoUrl field (Case model doesn't have photoUrls)
      const photoUrl = normalizePhotoUrl(c.petPhotoUrl);

      return {
        id: c.id,
        missionNumber: c.caseNumber,
        divisionId: assignCaseToDivision(c, squad.divisions),
        petName: c.petName,
        species: c.petSpecies,
        breed: c.petBreed,
        color: c.petColor,
        photoUrl,  // Single photo URL from petPhotoUrl field
        status,
        urgency,
        lastSeenAt: c.lastSeenAt?.toISOString(),
        lastSeenLat: c.lastSeenLatitude,
        lastSeenLng: c.lastSeenLongitude,
        lastSeenAddress: c.lastSeenAddress,
        rewardAmount: c.rewardAmount,
        isUserHelper,
        helperCount: assignment.participants.length,
      };
    });

    // Get divisions with active case counts
    const divisions = squad.divisions.map(div => ({
      id: div.id,
      name: div.name,
      slug: div.name.toLowerCase().replace(/\s+/g, '-'),
      activeCaseCount: cases.filter(c =>
        c.divisionId === div.id &&
        c.status !== 'REUNITED' &&
        c.status !== 'CLOSED_OTHER'
      ).length,
      bounds: div.centerLatitude && div.centerLongitude ? {
        north: div.centerLatitude + 0.03,
        south: div.centerLatitude - 0.03,
        east: div.centerLongitude + 0.04,
        west: div.centerLongitude - 0.04,
      } : null,
    }));

    // Get on-duty and recently active members
    const allMembers = await prisma.rescueSquadMember.findMany({
      where: {
        rescueSquadId: squadId,
        isActive: true,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        division: {
          select: { id: true, name: true },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    // Use availabilityStatus === 'AVAILABLE' as "on duty"
    const onDutyMembers = allMembers
      .filter(m => m.availabilityStatus === 'AVAILABLE')
      .map(m => ({
        id: m.id,
        name: `${m.user.firstName} ${m.user.lastName?.[0] || ''}.`,
        role: m.role,
        divisionId: m.divisionId,
        divisionName: m.division?.name,
        isOnDuty: true,
        lastActiveAt: m.joinedAt?.toISOString(),
      }));

    const recentlyActiveMembers = allMembers
      .filter(m => m.availabilityStatus !== 'AVAILABLE')
      .slice(0, 10)
      .map(m => ({
        id: m.id,
        name: `${m.user.firstName} ${m.user.lastName?.[0] || ''}.`,
        role: m.role,
        divisionId: m.divisionId,
        divisionName: m.division?.name,
        isOnDuty: false,
        lastActiveAt: m.joinedAt?.toISOString(),
      }));

    // Get recent activities
    const activities = await prisma.squadActivity.findMany({
      where: { rescueSquadId: squadId },
      include: {
        actor: {
          select: { firstName: true, lastName: true },
        },
        // Note: missionId is just a String, not a relation - look up case data separately if needed
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Build case lookup map for activity case references
    const activityCaseIds = [...new Set(activities.map(a => a.missionId).filter(Boolean))];
    const activityCases = activityCaseIds.length > 0 ? await prisma.case.findMany({
      where: { id: { in: activityCaseIds } },
      select: { id: true, petName: true, caseNumber: true },
    }) : [];
    const activityCaseMap = new Map(activityCases.map(c => [c.id, c]));

    const recentEvents = activities.map(a => {
      const linkedCase = a.missionId ? activityCaseMap.get(a.missionId) : null;
      return {
        id: a.id,
        type: a.type.toLowerCase(),
        createdAt: a.createdAt.toISOString(),
        payload: {
          memberName: a.actor ? `${a.actor.firstName} ${a.actor.lastName?.[0] || ''}.` : null,
          petName: linkedCase?.petName,
          missionNumber: linkedCase?.caseNumber,
          ...JSON.parse(a.details || '{}'),
        },
      };
    });

    // Get chat messages (stored as SquadActivity with type CHAT_MESSAGE)
    const chatActivities = await prisma.squadActivity.findMany({
      where: {
        rescueSquadId: squadId,
        type: 'CHAT_MESSAGE',
      },
      include: {
        actor: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Build member role lookup for chat messages
    const chatAuthorIds = [...new Set(chatActivities.map(a => a.actorId).filter(Boolean))];
    const chatMemberships = chatAuthorIds.length > 0 ? await prisma.rescueSquadMember.findMany({
      where: {
        rescueSquadId: squadId,
        userId: { in: chatAuthorIds },
        isActive: true,
      },
      select: { userId: true, role: true },
    }) : [];
    const chatMembershipMap = new Map(chatMemberships.map(m => [m.userId, m]));

    const chatMessages = chatActivities
      .map(a => {
        const details = JSON.parse(a.details || '{}');
        const membership = chatMembershipMap.get(a.actorId);
        return {
          id: a.id,
          authorId: a.actorId,
          authorName: a.actor ? `${a.actor.firstName} ${a.actor.lastName?.[0] || ''}.` : 'Unknown',
          authorRole: membership?.role || 'MEMBER',
          content: a.message,
          createdAt: a.createdAt.toISOString(),
          divisionId: details.divisionId || null,
          missionId: a.missionId,
        };
      })
      .reverse(); // Oldest first

    // Get announcements (stored as SquadActivity with type ANNOUNCEMENT)
    const announcementActivities = await prisma.squadActivity.findMany({
      where: {
        rescueSquadId: squadId,
        type: 'ANNOUNCEMENT',
      },
      include: {
        actor: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Auto-create welcome announcement if none exists
    if (announcementActivities.length === 0) {
      try {
        // Find or create Sarama system user
        let systemUser = await prisma.user.findFirst({
          where: { email: 'sarama@petrecovery.app' },
        });

        if (!systemUser) {
          systemUser = await prisma.user.create({
            data: {
              email: 'sarama@petrecovery.app',
              firstName: 'Sarama',
              lastName: '',
              role: 'ADMIN',
            },
          });
        }

        // Create welcome announcement
        const welcomeMessage = `Welcome to your local Rescue Force!

We're a community of caring neighbors who work together to help lost pets find their way home.

Here's how you can help:
• Keep an eye out for lost pet alerts in your area
• Share sightings and updates with fellow members
• Join search parties when pets go missing nearby
• Post encouraging messages to support pet owners

Every share, every search, every kind word makes a difference. Together, we bring pets home!`;

        const welcomeAnnouncement = await prisma.squadActivity.create({
          data: {
            rescueSquadId: squadId,
            actorId: systemUser.id,
            type: 'ANNOUNCEMENT',
            message: welcomeMessage,
            details: JSON.stringify({
              title: 'Welcome to Your Rescue Force!',
              isPinned: true,
              isSystemPost: true,
            }),
          },
          include: {
            actor: {
              select: { firstName: true, lastName: true },
            },
          },
        });

        announcementActivities.push(welcomeAnnouncement);
      } catch (seedError) {
        console.error('Failed to auto-seed welcome announcement:', seedError);
        // Don't fail the request, just continue without the announcement
      }
    }

    const announcements = announcementActivities.map(a => {
      const details = JSON.parse(a.details || '{}');
      const isSystemPost = details.isSystemPost || a.actor?.firstName === 'Sarama';
      return {
        id: a.id,
        authorId: a.actorId,
        authorName: isSystemPost ? 'Sarama' : (a.actor ? `${a.actor.firstName} ${a.actor.lastName?.[0] || ''}.` : 'Unknown'),
        title: details.title || 'Announcement',
        content: a.message,
        createdAt: a.createdAt.toISOString(),
        isPinned: details.isPinned || false,
        divisionId: details.divisionId || null,
        isSystemPost,
      };
    });

    // Get help requests (SquadTask with type REQUEST)
    const tasks = await prisma.squadTask.findMany({
      where: {
        rescueSquadId: squadId,
        type: 'REQUEST',
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
        // Note: missionId is just a String, not a relation
      },
      orderBy: { createdAt: 'desc' },
    });

    // Look up case codes for tasks with missionIds
    const taskCaseIds = [...new Set(tasks.map(t => t.missionId).filter(Boolean))];
    const taskCases = taskCaseIds.length > 0 ? await prisma.case.findMany({
      where: { id: { in: taskCaseIds } },
      select: { id: true, caseNumber: true },
    }) : [];
    const taskCaseMap = new Map(taskCases.map(c => [c.id, c]));

    const requests = tasks.map(t => {
      const linkedCase = t.missionId ? taskCaseMap.get(t.missionId) : null;
      return {
        id: t.id,
        title: t.title,
        body: t.description || '',
        divisionId: null, // SquadTask doesn't have divisionId field
        missionId: t.missionId,
        caseCode: linkedCase?.caseNumber,
        authorId: t.createdById,
        authorName: t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName?.[0] || ''}.` : 'Unknown',
        createdAt: t.createdAt.toISOString(),
        helpersCount: t.assignedToId ? 1 : 0,
        helpers: t.assignedTo ? [{ id: t.assignedTo.id, name: `${t.assignedTo.firstName} ${t.assignedTo.lastName?.[0] || ''}.` }] : [],
        isUserHelper: session?.user?.id ? t.assignedToId === session.user.id : false,
        status: t.status === 'COMPLETED' ? 'COMPLETED' : t.assignedToId ? 'IN_PROGRESS' : 'OPEN',
      };
    });

    // Count on-duty members (AVAILABLE status = on duty)
    const onDutyCount = await prisma.rescueSquadMember.count({
      where: {
        rescueSquadId: squadId,
        isActive: true,
        availabilityStatus: 'AVAILABLE',
      },
    });

    // Build response in mock data format
    const hubData = {
      squad: {
        id: squad.id,
        citySlug: squad.city?.toLowerCase().replace(/\s+/g, '-') || squad.id,
        cityName: squad.city || 'Unknown City',
        state: squad.state || '',
        country: squad.country || 'US',
        displayName: squad.name,
        description: squad.description,
        photoUrl: squad.photoUrl,
        slogan: squad.slogan,
        zipCode: squad.zipCode,
        memberCount: squad._count.members,
        onDutyCount,
        centerLat: squad.centerLatitude,
        centerLng: squad.centerLongitude,
        customBoundary: squad.customBoundary,
      },
      membership,
      divisions,
      cases,
      activityPreview: {
        recentEvents,
      },
      chat: {
        messages: chatMessages,
      },
      announcements,
      requests,
      members: {
        onDuty: onDutyMembers,
        recentlyActive: recentlyActiveMembers,
      },
    };

    return NextResponse.json(hubData);
  } catch (error) {
    console.error('Error fetching squad hub data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch squad hub data', details: error.message },
      { status: 500 }
    );
  }
}
