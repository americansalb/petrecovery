import { NextResponse } from 'next/server';

/**
 * GET /api/rescue-squads/[id]/chat
 * Returns chat messages for the squad
 *
 * POST /api/rescue-squads/[id]/chat
 * Sends a new chat message
 */

export async function GET(request, { params }) {
  try {
    // Dynamic imports to handle missing Prisma
    let prisma, getServerSession, authOptions;
    try {
      prisma = (await import('@/app/lib/prisma')).default;
      const nextAuth = await import('next-auth');
      getServerSession = nextAuth.getServerSession;
      const authModule = await import('@/app/api/auth/[...nextauth]/route');
      authOptions = authModule.authOptions;
    } catch (importError) {
      return NextResponse.json(
        { error: 'Database not available', messages: [] },
        { status: 503 }
      );
    }

    const squadId = params.id;
    const { searchParams } = new URL(request.url);
    const divisionId = searchParams.get('divisionId');
    const missionId = searchParams.get('missionId');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get chat messages (stored as SquadActivity with type CHAT_MESSAGE)
    const whereClause = {
      rescueSquadId: squadId,
      type: 'CHAT_MESSAGE',
    };

    if (missionId) {
      whereClause.missionId = missionId;
    }

    const activities = await prisma.squadActivity.findMany({
      where: whereClause,
      include: {
        actor: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Get member roles for each author
    const authorIds = [...new Set(activities.map(a => a.actorId).filter(Boolean))];
    const memberships = await prisma.rescueSquadMember.findMany({
      where: {
        rescueSquadId: squadId,
        userId: { in: authorIds },
        isActive: true,
      },
      select: { userId: true, role: true, divisionId: true },
    });

    const membershipMap = new Map(memberships.map(m => [m.userId, m]));

    // Transform to chat message format
    const messages = activities
      .map(a => {
        const details = JSON.parse(a.details || '{}');
        const membership = membershipMap.get(a.actorId);

        // Filter by division if specified
        if (divisionId && details.divisionId && details.divisionId !== divisionId) {
          return null;
        }

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
      .filter(Boolean)
      .reverse(); // Oldest first for display

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages', messages: [] },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    // Dynamic imports
    let prisma, getServerSession, authOptions;
    try {
      prisma = (await import('@/app/lib/prisma')).default;
      const nextAuth = await import('next-auth');
      getServerSession = nextAuth.getServerSession;
      const authModule = await import('@/app/api/auth/[...nextauth]/route');
      authOptions = authModule.authOptions;
    } catch (importError) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const squadId = params.id;
    const { content, divisionId, missionId } = await request.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 });
    }

    // Verify user is a squad member
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a rescue force member' }, { status: 403 });
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, lastName: true },
    });

    // Create chat message as SquadActivity
    const message = await prisma.squadActivity.create({
      data: {
        rescueSquadId: squadId,
        type: 'CHAT_MESSAGE',
        message: content.trim(),
        actorId: session.user.id,
        missionId: missionId || null,
        details: JSON.stringify({
          divisionId: divisionId || null,
        }),
      },
    });

    return NextResponse.json({
      message: {
        id: message.id,
        authorId: session.user.id,
        authorName: user ? `${user.firstName} ${user.lastName?.[0] || ''}.` : 'You',
        authorRole: membership.role,
        content: message.message,
        createdAt: message.createdAt.toISOString(),
        divisionId: divisionId || null,
        missionId: missionId || null,
      },
    });
  } catch (error) {
    console.error('Error sending chat message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
