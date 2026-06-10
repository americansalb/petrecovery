import { NextResponse } from 'next/server';

/**
 * GET /api/rescue-forces/[id]/announcements
 * Fetch announcements for a squad
 *
 * POST /api/rescue-forces/[id]/announcements
 * Create a new announcement (leads/admins only)
 */

export async function GET(request, { params }) {
  try {
    let prisma, getServerSession, authOptions;
    try {
      prisma = (await import('@/app/lib/prisma')).default;
      const nextAuth = await import('next-auth');
      getServerSession = nextAuth.getServerSession;
      const authModule = await import('@/app/lib/auth');
      authOptions = authModule.authOptions;
    } catch (importError) {
      console.error('Database not available:', importError.message);
      return NextResponse.json(
        { error: 'Database not available', fallbackToMock: true },
        { status: 503 }
      );
    }

    const squadId = params.id;
    const { searchParams } = new URL(request.url);
    const divisionId = searchParams.get('divisionId');

    // Build where clause
    const where = {
      rescueSquadId: squadId,
      type: 'ANNOUNCEMENT',
    };

    // Filter by division if specified
    if (divisionId) {
      // Need to handle divisionId in details JSON
      // For now, fetch all and filter
    }

    const announcementActivities = await prisma.squadActivity.findMany({
      where,
      include: {
        actor: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
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

    // Filter by divisionId if specified
    const filtered = divisionId
      ? announcements.filter(a => !a.divisionId || a.divisionId === divisionId)
      : announcements;

    return NextResponse.json({ announcements: filtered });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch announcements' },
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
      console.error('Database not available:', importError.message);
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
    const { title, content, divisionId, isPinned } = await request.json();

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    // Check user's membership and role
    const membership = await prisma.rescueForceMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a rescue force member' }, { status: 403 });
    }

    // Only leads and admins can post announcements
    const canPost = ['DIVISION_LEAD', 'SQUAD_LEAD', 'ADMIN'].includes(membership.role);
    if (!canPost) {
      return NextResponse.json(
        { error: 'Only leads and admins can post announcements' },
        { status: 403 }
      );
    }

    // If division lead, they can only post to their own division
    if (membership.role === 'DIVISION_LEAD' && divisionId && divisionId !== membership.divisionId) {
      return NextResponse.json(
        { error: 'Division leads can only post to their own division' },
        { status: 403 }
      );
    }

    // Create announcement as SquadActivity
    const announcement = await prisma.squadActivity.create({
      data: {
        rescueSquadId: squadId,
        type: 'ANNOUNCEMENT',
        message: content.trim(),
        actorId: session.user.id,
        details: JSON.stringify({
          title: title.trim(),
          divisionId: divisionId || null,
          isPinned: isPinned || false,
        }),
      },
      include: {
        actor: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    const details = JSON.parse(announcement.details || '{}');

    return NextResponse.json({
      announcement: {
        id: announcement.id,
        authorId: announcement.actorId,
        authorName: announcement.actor
          ? `${announcement.actor.firstName} ${announcement.actor.lastName?.[0] || ''}.`
          : 'Unknown',
        title: details.title,
        content: announcement.message,
        createdAt: announcement.createdAt.toISOString(),
        isPinned: details.isPinned || false,
        divisionId: details.divisionId || null,
      },
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    return NextResponse.json(
      { error: 'Failed to create announcement' },
      { status: 500 }
    );
  }
}
