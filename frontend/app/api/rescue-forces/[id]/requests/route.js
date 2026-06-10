import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/rescue-forces/[id]/requests
 *
 * Creates a new help request.
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const squadId = params.id;
    const { title, body, divisionId, missionId } = await request.json();

    if (!title || !body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    // Check if user is a squad member
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

    // Create the request as a SquadTask
    const task = await prisma.squadTask.create({
      data: {
        rescueSquadId: squadId,
        title,
        description: body,
        type: 'REQUEST',
        status: 'PENDING',
        priority: 'NORMAL',
        creatorId: session.user.id,
        divisionId: divisionId || null,
        missionId: missionId || null,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        case: {
          select: { id: true, caseNumber: true },
        },
      },
    });

    const lastName = task.createdBy.lastName || '';
    const lastInitial = lastName.charAt(0) || '';

    return NextResponse.json({
      request: {
        id: task.id,
        title: task.title,
        body: task.description,
        divisionId: task.divisionId,
        missionId: task.missionId,
        caseCode: task.case?.caseNumber || null,
        authorId: task.creatorId,
        authorName: `${task.createdBy.firstName} ${lastInitial}.`,
        createdAt: task.createdAt.toISOString(),
        helpersCount: 0,
        helpers: [],
        isUserHelper: false,
        status: 'OPEN',
      },
    });
  } catch (error) {
    console.error('Error creating request:', error);
    return NextResponse.json(
      { error: 'Failed to create request' },
      { status: 500 }
    );
  }
}
