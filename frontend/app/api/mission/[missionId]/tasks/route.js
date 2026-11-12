/**
 * Tasks List API
 *
 * GET /api/mission/[missionId]/tasks - List all tasks with status and progress
 *
 * Who is on each task of one pet's search: for the owner, an active member
 * of a force looking for the pet, and staff (`mayKnowThePeople`,
 * app/lib/missionControl/guard.js). It answered any account with each
 * person's account id. A person is a first name here, and `mine` marks the
 * reader's own.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { mayKnowThePeople } from '@/app/lib/missionControl/guard';
import { firstWord } from '@/app/lib/searchText';
import { withRateLimitAsync, rateLimitResponse, RateLimitPresets } from '@/app/lib/rateLimit';

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await withRateLimitAsync(request, RateLimitPresets.SEARCH_READ, 'case:tasks-read');
    if (!limited.success) return rateLimitResponse(limited);

    const { missionId } = await params;
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
    const missionRecord = await prisma.case.findUnique({
      where: { id: missionId },
      select: {
        id: true,
        reporterId: true,
        pet: {
          select: { species: true },
        },
      },
    });

    if (!missionRecord) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    const who = await mayKnowThePeople(request, missionRecord.id);
    if (!who.allowed) {
      return NextResponse.json({ error: 'Only the owner and the forces looking for this pet can see this.', code: 'NOT_ALLOWED' }, { status: who.status });
    }

    const isOwner = missionRecord.reporterId === user.id;
    const petType = missionRecord.pet?.species || 'DOG';

    // Get squad tasks for this case
    const squadTasks = await prisma.squadTask.findMany({
      where: { caseId: missionId }, // SquadTask's field is caseId (no @map); missionId var = the case id

      include: {
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true },
            },
          },
        },
        completedBy: {
          select: { firstName: true },
        },
      },
    });

    // Get flyer count
    const flyerCount = await prisma.flyerPosting.count({
      where: { missionId },
    });

    // Get search session stats
    const searchStats = await prisma.searchSession.aggregate({
      where: { missionId, status: 'COMPLETED' },
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
      // A first name, and whether it is the reader. The account id is read to say that and is not sent.
      participants: squadTask.participants.map((p) => ({
        name: firstWord(p.user?.firstName) || 'A helper',
        mine: p.user?.id === user.id,
        joinedAt: p.joinedAt,
      })),
      completedAt: squadTask.completedAt,
      completedBy: squadTask.completedBy ? { firstName: firstWord(squadTask.completedBy.firstName) || 'A helper' } : null,
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
