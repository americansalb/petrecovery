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

    // Verify user is assigned to this task or is a leader
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: task.rescueSquadId,
        userId: session.user.id,
        isActive: true
      }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a rescue force member' }, { status: 403 });
    }

    const isLeader = ['FOUNDER', 'LEADER'].includes(membership.role);
    const isAssigned = task.assignedToId === session.user.id;

    if (!isLeader && !isAssigned) {
      return NextResponse.json({ error: 'Not authorized to complete this task' }, { status: 403 });
    }

    // Complete task
    const updatedTask = await prisma.squadTask.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        completedById: session.user.id,
        completedAt: new Date()
      },
      include: {
        completedBy: {
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
        type: 'TASK_COMPLETED',
        message: `Task completed: ${task.title}`,
        details: `Completed by ${session.user.firstName} ${session.user.lastName}`,
        actorId: session.user.id
      }
    });

    return NextResponse.json({ task: updatedTask });

  } catch (error) {
    console.error('Error completing task:', error);
    return NextResponse.json(
      { error: 'Failed to complete task' },
      { status: 500 }
    );
  }
}
