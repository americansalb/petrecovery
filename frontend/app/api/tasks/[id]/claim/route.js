import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const taskId = params.id;

    // Fetch task
    const task = await prisma.squadTask.findUnique({
      where: { id: taskId },
      include: {
        rescueSquad: true
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Verify user is a member of the squad
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: task.rescueSquadId,
        userId: session.user.id,
        isActive: true
      }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a squad member' }, { status: 403 });
    }

    // Check if task is already assigned
    if (task.assignedToId && task.assignedToId !== session.user.id) {
      return NextResponse.json({ error: 'Task is already assigned to someone else' }, { status: 400 });
    }

    // Claim task
    const updatedTask = await prisma.squadTask.update({
      where: { id: taskId },
      data: {
        assignedToId: session.user.id,
        status: 'IN_PROGRESS'
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Create activity log
    await prisma.squadActivity.create({
      data: {
        rescueSquadId: task.rescueSquadId,
        missionId: task.missionId,
        type: 'TASK_ASSIGNED',
        message: `${session.user.firstName} ${session.user.lastName} claimed: ${task.title}`,
        actorId: session.user.id
      }
    });

    return NextResponse.json({ task: updatedTask });

  } catch (error) {
    console.error('Error claiming task:', error);
    return NextResponse.json(
      { error: 'Failed to claim task' },
      { status: 500 }
    );
  }
}
