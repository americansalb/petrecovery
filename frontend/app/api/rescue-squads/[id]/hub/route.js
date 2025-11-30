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
          isOnDuty: userMembership.isOnDuty || false,
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
      orderBy: { lastActiveAt: 'desc' },
    });

    const onDutyMembers = allMembers
      .filter(m => m.isOnDuty)
      .map(m => ({
        id: m.id,
        name: `${m.user.firstName} ${m.user.lastName?.[0] || ''}.`,
        role: m.role,
        divisionId: m.divisionId,
        divisionName: m.division?.name,
        isOnDuty: true,
        lastActiveAt: m.lastActiveAt?.toISOString(),
      }));

    const recentlyActiveMembers = allMembers
      .filter(m => !m.isOnDuty && m.lastActiveAt)
      .slice(0, 10)
      .map(m => ({
        id: m.id,
        name: `${m.user.firstName} ${m.user.lastName?.[0] || ''}.`,
        role: m.role,
        divisionId: m.divisionId,
        divisionName: m.division?.name,
        isOnDuty: false,
        lastActiveAt: m.lastActiveAt?.toISOString(),
      }));

    // Get recent activities
    const activities = await prisma.squadActivity.findMany({
      where: { rescueSquadId: squadId },
      include: {
        actor: {
          select: { firstName: true, lastName: true },
        },
        case: {
          select: { petName: true, caseNumber: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const recentEvents = activities.map(a => ({
      id: a.id,
      type: a.type.toLowerCase(),
      createdAt: a.createdAt.toISOString(),
      payload: {
        memberName: a.actor ? `${a.actor.firstName} ${a.actor.lastName?.[0] || ''}.` : null,
        petName: a.case?.petName,
        caseNumber: a.case?.caseNumber,
        ...JSON.parse(a.details || '{}'),
      },
    }));

    // Get chat messages (SquadMessage model if exists, otherwise empty)
    // For now, return empty - can be enhanced later
    const chatMessages = [];

    // Get announcements (can be stored in SquadActivity with type ANNOUNCEMENT)
    const announcements = [];

    // Get help requests (SquadTask with type REQUEST)
    const tasks = await prisma.squadTask.findMany({
      where: {
        rescueSquadId: squadId,
        type: 'REQUEST',
      },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true },
        },
        assignee: {
          select: { id: true, firstName: true, lastName: true },
        },
        case: {
          select: { id: true, caseNumber: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const requests = tasks.map(t => ({
      id: t.id,
      title: t.title,
      body: t.description || '',
      divisionId: t.divisionId,
      caseId: t.caseId,
      caseCode: t.case?.caseNumber,
      authorId: t.creatorId,
      authorName: t.creator ? `${t.creator.firstName} ${t.creator.lastName?.[0] || ''}.` : 'Unknown',
      createdAt: t.createdAt.toISOString(),
      helpersCount: t.assigneeId ? 1 : 0,
      helpers: t.assignee ? [{ id: t.assignee.id, name: `${t.assignee.firstName} ${t.assignee.lastName?.[0] || ''}.` }] : [],
      isUserHelper: session?.user?.id ? t.assigneeId === session.user.id : false,
      status: t.status === 'COMPLETED' ? 'COMPLETED' : t.assigneeId ? 'IN_PROGRESS' : 'OPEN',
    }));

    // Count on-duty members
    const onDutyCount = await prisma.rescueSquadMember.count({
      where: {
        rescueSquadId: squadId,
        isActive: true,
        isOnDuty: true,
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
