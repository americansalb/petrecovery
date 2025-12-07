/**
 * Individual Task API
 *
 * GET /api/tasks/[id] - Get task details
 * PATCH /api/tasks/[id] - Update task (start, complete, cancel)
 * DELETE /api/tasks/[id] - Delete task
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

// GET task details
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const task = await prisma.squadTask.findUnique({
      where: { id },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        completedBy: {
          select: {
            id: true,
            firstName: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

// PATCH - Update task (start, complete, cancel, reassign)
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { action, assigneeId, notes } = body;

    // Find the task
    const task = await prisma.squadTask.findUnique({
      where: { id },
      include: {
        rescueSquad: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check permissions
    const isAssignee = task.assigneeId === session.user.id;
    const isCreator = task.creatorId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'MODERATOR';

    const squadMembership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: task.rescueSquadId,
        userId: session.user.id,
        isActive: true,
      },
    });

    const isCoordinator = squadMembership?.role === 'LEADER' || squadMembership?.role === 'COORDINATOR';

    let updateData = {};
    let logMessage = '';

    switch (action) {
      case 'start':
        // Anyone assigned can start
        if (!isAssignee && !isCoordinator && !isAdmin) {
          return NextResponse.json(
            { error: 'Only the assignee can start this task' },
            { status: 403 }
          );
        }
        if (task.status !== 'OPEN') {
          return NextResponse.json(
            { error: 'Task has already been started' },
            { status: 400 }
          );
        }
        updateData = {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          // If no assignee, assign to current user
          assigneeId: task.assigneeId || session.user.id,
        };
        logMessage = `Task "${task.title}" started`;
        break;

      case 'complete':
        if (!isAssignee && !isCoordinator && !isAdmin) {
          return NextResponse.json(
            { error: 'Only the assignee can complete this task' },
            { status: 403 }
          );
        }
        if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
          return NextResponse.json(
            { error: 'Task is already closed' },
            { status: 400 }
          );
        }
        updateData = {
          status: 'COMPLETED',
          completedAt: new Date(),
          completedById: session.user.id,
          notes: notes || task.notes,
        };
        logMessage = `Task "${task.title}" completed`;
        break;

      case 'cancel':
        if (!isCreator && !isCoordinator && !isAdmin) {
          return NextResponse.json(
            { error: 'Only coordinators can cancel tasks' },
            { status: 403 }
          );
        }
        if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
          return NextResponse.json(
            { error: 'Task is already closed' },
            { status: 400 }
          );
        }
        updateData = {
          status: 'CANCELLED',
        };
        logMessage = `Task "${task.title}" cancelled`;
        break;

      case 'reassign':
        if (!isCreator && !isCoordinator && !isAdmin) {
          return NextResponse.json(
            { error: 'Only coordinators can reassign tasks' },
            { status: 403 }
          );
        }
        updateData = {
          assigneeId: assigneeId || null,
        };
        logMessage = assigneeId
          ? `Task "${task.title}" reassigned`
          : `Task "${task.title}" unassigned`;
        break;

      case 'reopen':
        if (!isCreator && !isCoordinator && !isAdmin) {
          return NextResponse.json(
            { error: 'Only coordinators can reopen tasks' },
            { status: 403 }
          );
        }
        updateData = {
          status: 'OPEN',
          startedAt: null,
          completedAt: null,
          completedById: null,
        };
        logMessage = `Task "${task.title}" reopened`;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Update task
    const updatedTask = await prisma.squadTask.update({
      where: { id },
      data: updateData,
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create activity log if there's a case
    if (task.caseId && logMessage) {
      await prisma.caseUpdate.create({
        data: {
          caseId: task.caseId,
          authorId: session.user.id,
          content: logMessage,
          isUpdate: true,
        },
      });
    }

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

// DELETE - Delete task
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    const task = await prisma.squadTask.findUnique({
      where: { id },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Only creator, coordinator, or admin can delete
    const isCreator = task.creatorId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'MODERATOR';

    const squadMembership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: task.rescueSquadId,
        userId: session.user.id,
        isActive: true,
      },
    });

    const isCoordinator = squadMembership?.role === 'LEADER' || squadMembership?.role === 'COORDINATOR';

    if (!isCreator && !isCoordinator && !isAdmin) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    await prisma.squadTask.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
