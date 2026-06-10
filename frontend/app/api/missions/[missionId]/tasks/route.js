/**
 * Mission Tasks API
 *
 * GET /api/missions/[id]/tasks - Get all tasks for a case
 * POST /api/missions/[id]/tasks - Create a new task
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

// GET all tasks for this case
export async function GET(request, { params }) {
  try {
    const { id } = params;

    // Support both UUID and case number
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const missionData = await prisma.case.findFirst({
      where: isUuid ? { id } : { caseNumber: id },
      include: {
        assignments: {
          take: 1,
          include: {
            rescueSquad: true,
          },
        },
      },
    });

    if (!missionData) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    const rescueSquadId = missionData.assignments[0]?.rescueSquadId;

    if (!rescueSquadId) {
      return NextResponse.json({ tasks: [] });
    }

    const tasks = await prisma.squadTask.findMany({
      where: {
        rescueSquadId,
        caseId: missionData.id, // SquadTask field is caseId (no @map)
      },
      include: {
        assignedTo: {
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
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
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

// POST - Create a new task
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const {
      title,
      description,
      type,
      priority,
      assigneeId,
      latitude,
      longitude,
      address,
      status,
      completionNotes
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Get the case and its assignment
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const missionData = await prisma.case.findFirst({
      where: isUuid ? { id } : { caseNumber: id },
      include: {
        assignments: {
          take: 1,
          include: {
            rescueSquad: true,
          },
        },
      },
    });

    if (!missionData) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    const rescueSquadId = missionData.assignments[0]?.rescueSquadId;

    if (!rescueSquadId) {
      return NextResponse.json(
        { error: 'No rescue force assigned to this case' },
        { status: 400 }
      );
    }

    // Verify user is coordinator (owner, admin, or squad leader)
    const isOwner = missionData.reporterId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'MODERATOR';

    const squadMembership = await prisma.rescueForceMember.findFirst({
      where: {
        rescueSquadId,
        userId: session.user.id,
        isActive: true,
      },
    });

    const isSquadLeader = squadMembership?.role === 'LEADER' || squadMembership?.role === 'COORDINATOR';

    if (!isOwner && !isAdmin && !isSquadLeader) {
      return NextResponse.json(
        { error: 'Only coordinators can create tasks' },
        { status: 403 }
      );
    }

    // Create the task
    const isCompleted = status === 'COMPLETED';
    const task = await prisma.squadTask.create({
      data: {
        rescueSquadId,
        caseId: missionData.id, // SquadTask field is caseId (no @map)
        title: title.trim(),
        description: description?.trim() || null,
        type: type || 'OTHER',
        priority: priority || 'MEDIUM',
        status: status || 'AVAILABLE', // 'OPEN' is not a valid status (enum: AVAILABLE/IN_PROGRESS/NEEDS_HELP/COMPLETED/BLOCKED)
        assignedToId: assigneeId || session.user.id || null, // field is assignedToId, not assigneeId
        createdById: session.user.id, // field is createdById, not creatorId
        latitude: latitude || null,
        longitude: longitude || null,
        address: address || null,
        // If already completed, set completion fields
        completedById: isCompleted ? session.user.id : null,
        completedAt: isCompleted ? new Date() : null,
        completionNotes: completionNotes || null,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create activity log
    const activityMessage = isCompleted
      ? `✅ Completed task: "${title}"`
      : `Task created: "${title}"${assigneeId ? ' (assigned)' : ''}`;

    await prisma.caseUpdate.create({
      data: {
        caseId: missionData.id, // CaseUpdate field is caseId (no missionId)
        authorId: session.user.id,
        content: activityMessage,
        isUpdate: true,
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
