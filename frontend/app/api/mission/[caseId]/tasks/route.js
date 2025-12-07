/**
 * Tasks List API
 *
 * GET /api/mission/[caseId]/tasks - List all tasks with status and progress
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export async function GET(request, { params }) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId } = await params;
    const { searchParams } = new URL(request.url);
    const categoryFilter = searchParams.get('category');

    // Get current user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify case exists and get owner
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        reporterId: true,
        pet: {
          select: { species: true },
        },
      },
    });

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const isOwner = caseRecord.reporterId === user.id;
    const petType = caseRecord.pet?.species || 'DOG';

    // Get squad tasks for this case
    const squadTasks = await prisma.squadTask.findMany({
      where: { caseId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true },
            },
          },
        },
        completedBy: {
          select: { id: true, firstName: true },
        },
      },
    });

    // Get flyer count
    const flyerCount = await prisma.flyerPosting.count({
      where: { caseId },
    });

    // Get search session stats
    const searchStats = await prisma.searchSession.aggregate({
      where: { caseId, status: 'COMPLETED' },
      _sum: { distanceMiles: true },
      _count: true,
    });

    // Build simple task list
    const tasks = squadTasks.map((squadTask) => ({
      id: squadTask.id,
      taskType: squadTask.taskType,
      title: squadTask.title,
      status: squadTask.status,
      ownerRequested: squadTask.ownerRequested || false,
      ownerRequestedHelp: squadTask.ownerRequestedHelp || false,
      ownerRequestedAt: squadTask.ownerRequestedAt,
      ownerRequestedMessage: squadTask.ownerRequestedMessage,
      participants: squadTask.participants.map((p) => ({
        userId: p.user.id,
        name: p.user.firstName,
        joinedAt: p.joinedAt,
      })),
      completedAt: squadTask.completedAt,
      completedBy: squadTask.completedBy,
    }));

    return NextResponse.json({
      tasks,
      summary: {
        totalTasks: tasks.length,
        searchMiles: searchStats._sum.distanceMiles || 0,
        flyersPosted: flyerCount,
      },
      isOwner,
    });
  } catch (error) {
    console.error('Tasks GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
