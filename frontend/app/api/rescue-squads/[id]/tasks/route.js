import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// GET /api/rescue-squads/[id]/tasks?missionId=xyz
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');

    const squadId = params.id;

    // Verify user is a member of this squad
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true
      }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a squad member' }, { status: 403 });
    }

    // Fetch tasks
    const tasks = await prisma.squadTask.findMany({
      where: {
        rescueSquadId: squadId,
        ...(missionId && { missionId })
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        completedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // Open tasks first
        { priority: 'desc' }, // Urgent first
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json({ tasks });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

// POST /api/rescue-squads/[id]/tasks
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const squadId = params.id;
    const body = await request.json();
    const { missionId, title, description, type, priority, assignedTo } = body;

    // Verify user is a leader in this squad
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
        role: {
          in: ['FOUNDER', 'LEADER']
        }
      }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not authorized to create tasks' }, { status: 403 });
    }

    // Validate required fields
    if (!title || !type || !priority) {
      return NextResponse.json({ error: 'Title, type, and priority are required' }, { status: 400 });
    }

    // Create task
    const task = await prisma.squadTask.create({
      data: {
        rescueSquadId: squadId,
        missionId: missionId || null,
        title,
        description: description || null,
        type,
        priority,
        status: 'OPEN',
        assignedToId: assignedTo || null,
        createdById: session.user.id
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Create activity log
    await prisma.squadActivity.create({
      data: {
        rescueSquadId: squadId,
        missionId: missionId || null,
        type: 'TASK_CREATED',
        message: `New task: ${title}`,
        details: `${type} task with ${priority} priority`,
        actorId: session.user.id
      }
    });

    return NextResponse.json({ task });

  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
