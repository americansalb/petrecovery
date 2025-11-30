import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/rescue-squads/[id]/requests/[requestId]/help
 *
 * Adds the current user as a helper on this request.
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: squadId, requestId } = params;

    // Check if user is a squad member
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a squad member' }, { status: 403 });
    }

    // Find the task
    const task = await prisma.squadTask.findFirst({
      where: {
        id: requestId,
        rescueSquadId: squadId,
        type: 'REQUEST',
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Update task with assignee (simple single-helper model for now)
    await prisma.squadTask.update({
      where: { id: requestId },
      data: {
        assigneeId: session.user.id,
        status: 'IN_PROGRESS',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error helping on request:', error);
    return NextResponse.json(
      { error: 'Failed to help on request' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rescue-squads/[id]/requests/[requestId]/help
 *
 * Removes the current user as a helper (leave request).
 */
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId } = params;

    // Find the task
    const task = await prisma.squadTask.findFirst({
      where: {
        id: requestId,
        assigneeId: session.user.id,
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Request not found or not helping' }, { status: 404 });
    }

    // Remove assignee
    await prisma.squadTask.update({
      where: { id: requestId },
      data: {
        assigneeId: null,
        status: 'PENDING',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error leaving request:', error);
    return NextResponse.json(
      { error: 'Failed to leave request' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/rescue-squads/[id]/requests/[requestId]/help
 *
 * Marks the request as complete.
 */
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId } = params;

    // Find the task
    const task = await prisma.squadTask.findFirst({
      where: {
        id: requestId,
        assigneeId: session.user.id,
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Request not found or not helping' }, { status: 404 });
    }

    // Mark as completed
    await prisma.squadTask.update({
      where: { id: requestId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error completing request:', error);
    return NextResponse.json(
      { error: 'Failed to complete request' },
      { status: 500 }
    );
  }
}
