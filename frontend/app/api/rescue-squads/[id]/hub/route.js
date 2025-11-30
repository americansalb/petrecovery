import { NextResponse } from 'next/server';

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
      const authModule = await import('@/app/api/auth/[...nextauth]/route');
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
      return NextResponse.json({ error: 'Rescue squad not found' }, { status: 404 });
    }

    // Use the actual squad ID for subsequent queries
    const squadId = squad.id;

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

      if (userMembership) {
        membership = {
          isMember: true,
          isOnDuty: userMembership.availabilityStatus === 'AVAILABLE',
          homeDivisionId: userMembership.divisionId,
          divisionIds: userMembership.divisionId ? [userMembership.divisionId] : [],
          role: userMembership.role,
        };
      }
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
      else if (assignment.status === 'ACTIVE') status = 'IN_PROGRESS';

      return {
        id: c.id,
        caseNumber: c.caseNumber,
        divisionId: squad.divisions.find(d => {
          // Simple assignment: first division for now
          // TODO: Add proper division assignment logic
          return true;
        })?.id || squad.divisions[0]?.id || null,
        petName: c.petName,
        species: c.petSpecies,
        breed: c.petBreed,
        color: c.petColor,
        photoUrl: c.petPhotoUrl,
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
        // Note: caseId is just a String, not a relation - look up case data separately if needed
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Build case lookup map for activity case references
    const activityCaseIds = [...new Set(activities.map(a => a.caseId).filter(Boolean))];
    const activityCases = activityCaseIds.length > 0 ? await prisma.case.findMany({
      where: { id: { in: activityCaseIds } },
      select: { id: true, petName: true, caseNumber: true },
    }) : [];
    const activityCaseMap = new Map(activityCases.map(c => [c.id, c]));

    const recentEvents = activities.map(a => {
      const linkedCase = a.caseId ? activityCaseMap.get(a.caseId) : null;
      return {
        id: a.id,
        type: a.type.toLowerCase(),
        createdAt: a.createdAt.toISOString(),
        payload: {
          memberName: a.actor ? `${a.actor.firstName} ${a.actor.lastName?.[0] || ''}.` : null,
          petName: linkedCase?.petName,
          caseNumber: linkedCase?.caseNumber,
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
          caseId: a.caseId,
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

    const announcements = announcementActivities.map(a => {
      const details = JSON.parse(a.details || '{}');
      return {
        id: a.id,
        authorId: a.actorId,
        authorName: a.actor ? `${a.actor.firstName} ${a.actor.lastName?.[0] || ''}.` : 'Unknown',
        title: details.title || 'Announcement',
        content: a.message,
        createdAt: a.createdAt.toISOString(),
        isPinned: details.isPinned || false,
        divisionId: details.divisionId || null,
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
        // Note: caseId is just a String, not a relation
      },
      orderBy: { createdAt: 'desc' },
    });

    // Look up case codes for tasks with caseIds
    const taskCaseIds = [...new Set(tasks.map(t => t.caseId).filter(Boolean))];
    const taskCases = taskCaseIds.length > 0 ? await prisma.case.findMany({
      where: { id: { in: taskCaseIds } },
      select: { id: true, caseNumber: true },
    }) : [];
    const taskCaseMap = new Map(taskCases.map(c => [c.id, c]));

    const requests = tasks.map(t => {
      const linkedCase = t.caseId ? taskCaseMap.get(t.caseId) : null;
      return {
        id: t.id,
        title: t.title,
        body: t.description || '',
        divisionId: null, // SquadTask doesn't have divisionId field
        caseId: t.caseId,
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
        displayName: squad.name,
        memberCount: squad._count.members,
        onDutyCount,
        centerLat: squad.centerLatitude,
        centerLng: squad.centerLongitude,
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
