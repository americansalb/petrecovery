import { NextResponse } from 'next/server';

/**
 * GET /api/missions/[missionId]/chat
 * Returns chat messages for the mission
 *
 * POST /api/missions/[missionId]/chat
 * Sends a new chat message (any authenticated user can participate)
 */

export async function GET(request, { params }) {
  try {
    let prisma;
    try {
      prisma = (await import('@/app/lib/prisma')).default;
    } catch (importError) {
      return NextResponse.json(
        { error: 'Database not available', messages: [] },
        { status: 503 }
      );
    }

    const missionId = params.missionId;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get chat messages for this mission
    const activities = await prisma.squadActivity.findMany({
      where: {
        caseId: missionId,
        type: 'CHAT_MESSAGE',
      },
      include: {
        actor: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Transform to chat message format
    const messages = activities
      .map(a => {
        return {
          id: a.id,
          userId: a.actorId,
          userName: a.actor ? `${a.actor.firstName} ${a.actor.lastName?.[0] || ''}.` : 'Unknown',
          text: a.message,
          timestamp: a.createdAt.toISOString(),
        };
      })
      .reverse(); // Oldest first for display

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching mission chat:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages', messages: [] },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    let prisma, getServerSession, authOptions;
    try {
      prisma = (await import('@/app/lib/prisma')).default;
      const nextAuth = await import('next-auth');
      getServerSession = nextAuth.getServerSession;
      const authModule = await import('@/app/lib/auth');
      authOptions = authModule.authOptions;
    } catch (importError) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Please sign in to chat' }, { status: 401 });
    }

    const missionId = params.missionId;
    const { content } = await request.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 });
    }

    // Verify mission exists (Case has no direct squad field — the case↔force
    // link is the CaseAssignment join table, so we only check existence here)
    const mission = await prisma.case.findUnique({
      where: { id: missionId },
      select: { id: true },
    });

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, lastName: true },
    });

    // Chat is stored as SquadActivity, which requires a RescueForce. If a
    // force is already assigned to this case, use it; otherwise attach the
    // messages to a hidden per-mission workspace force. The workspace is
    // keyed on a unique, mission-specific name via upsert so two near-
    // simultaneous first messages can't collide on the unique-name
    // constraint. (The old code selected a nonexistent Case.rescueSquadId
    // field and created a force with an invalid `caseId` + constant name,
    // so chat 500'd on every case — most visibly freshly reported ones.)
    // NB: CaseAssignment's field is `missionId` (mapped to the legacy
    // `caseId` column) — the Case→Mission rename renamed the field here even
    // though SquadActivity kept `caseId`. Using the wrong one is a validation
    // error, so this must stay `missionId`.
    const assignment = await prisma.caseAssignment.findFirst({
      where: { missionId: missionId },
      select: { rescueSquadId: true },
      orderBy: { id: 'asc' },
    });
    let rescueSquadId = assignment?.rescueSquadId;
    if (!rescueSquadId) {
      const workspace = await prisma.rescueForce.upsert({
        where: { name: `Mission Workspace ${missionId}` },
        update: {},
        create: {
          name: `Mission Workspace ${missionId}`,
          isActive: false,
          isAcceptingCases: false,
        },
      });
      rescueSquadId = workspace.id;
    }

    // Create chat message as SquadActivity
    const message = await prisma.squadActivity.create({
      data: {
        rescueSquadId: rescueSquadId,
        type: 'CHAT_MESSAGE',
        message: content.trim(),
        actorId: session.user.id,
        caseId: missionId,
        details: JSON.stringify({}),
      },
    });

    return NextResponse.json({
      message: {
        id: message.id,
        userId: session.user.id,
        userName: user ? `${user.firstName} ${user.lastName?.[0] || ''}.` : 'You',
        text: message.message,
        timestamp: message.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error sending mission chat:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
