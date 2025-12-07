/**
 * Tasks List API
 *
 * GET /api/mission/[caseId]/tasks - List all tasks with status and progress
 *
 * See docs/Actions_Guide.md for full specification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import {
  TASK_DEFINITIONS,
  getTasksByCategory,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
} from '@/lib/actions';

// =============================================================================
// TYPES
// =============================================================================

interface TaskProgress {
  taskId: string;
  completedCount: number;
  participantCount: number;
  lastActivity?: Date;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /api/mission/[caseId]/tasks
 *
 * List all tasks with status, participants, and progress
 *
 * Query params:
 * - category: Filter by category (SEARCH, OUTREACH, AT_HOME, OTHER)
 */
export async function GET(
  request,
  { params }
) {
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
    const petType = caseRecord.pet?.type || 'DOG';

    // Get squad tasks for this case (owner-requested tasks)
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

    // Get progress data from verified actions
    const actionCounts = await prisma.verifiedAction.groupBy({
      by: ['actionType'],
      where: { caseId },
      _count: true,
    });

    const actionCountMap = new Map(
      actionCounts.map((ac) => [ac.actionType, ac._count])
    );

    // Get shelter contact progress
    const shelterProgress = await prisma.shelterContact.groupBy({
      by: ['status'],
      where: { caseId },
      _count: true,
    });

    const totalShelters = shelterProgress.reduce((sum, s) => sum + s._count, 0);
    const contactedShelters = shelterProgress
      .filter((s) => s.status !== 'NOT_CONTACTED')
      .reduce((sum, s) => sum + s._count, 0);

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

    // Build task list from definitions
    const taskDefinitions = categoryFilter
      ? getTasksByCategory(categoryFilter as any)
      : Object.values(TASK_DEFINITIONS);

    // Filter by pet type and role
    const filteredTasks = taskDefinitions.filter((task) => {
      // Filter by pet type
      if (task.petType !== 'BOTH' && task.petType !== petType) {
        return false;
      }
      // Filter by role (OWNER tasks only shown to owner)
      if (task.role === 'OWNER' && !isOwner) {
        return false;
      }
      return true;
    });

    // Find squad task overrides
    const squadTaskMap = new Map(
      squadTasks.map((st) => [st.taskType, st])
    );

    // Build response
    const tasks = filteredTasks.map((taskDef) => {
      const squadTask = squadTaskMap.get(taskDef.id);

      // Calculate progress based on task type
      let progress = {
        completed: 0,
        total: 0,
        percentage: 0,
        label: '',
      };

      switch (taskDef.id) {
        case 'search_area':
          progress = {
            completed: searchStats._count || 0,
            total: 0, // No fixed target
            percentage: 0,
            label: `${(searchStats._sum.distanceMiles || 0).toFixed(1)} mi searched`,
          };
          break;
        case 'contact_shelters':
        case 'contact_vets':
        case 'contact_animal_control':
          progress = {
            completed: contactedShelters,
            total: totalShelters,
            percentage: totalShelters > 0 ? Math.round((contactedShelters / totalShelters) * 100) : 0,
            label: `${contactedShelters}/${totalShelters} contacted`,
          };
          break;
        case 'post_flyers':
          progress = {
            completed: flyerCount,
            total: 0,
            percentage: 0,
            label: `${flyerCount} posted`,
          };
          break;
        default:
          const count = actionCountMap.get(taskDef.id as any) || 0;
          progress = {
            completed: count,
            total: 0,
            percentage: 0,
            label: count > 0 ? `${count} completed` : 'Not started',
          };
      }

      return {
        id: taskDef.id,
        displayName: taskDef.displayName,
        description: taskDef.description,
        category: taskDef.category,
        icon: taskDef.icon,
        basePoints: taskDef.basePoints,
        verificationMethod: taskDef.verificationMethod,
        tips: taskDef.tips,
        progress,
        // Squad task overrides
        ownerRequested: squadTask?.ownerRequested || false,  // For +25% point bonus
        ownerRequestedHelp: squadTask?.ownerRequestedHelp || false,
        ownerRequestedAt: squadTask?.ownerRequestedAt,
        ownerRequestedMessage: squadTask?.ownerRequestedMessage,
        participants: squadTask?.participants.map((p) => ({
          userId: p.user.id,
          name: p.user.firstName,
          joinedAt: p.joinedAt,
        })) || [],
        status: squadTask?.status || 'AVAILABLE',
        completedAt: squadTask?.completedAt,
        completedBy: squadTask?.completedBy,
      };
    });

    // Group by category
    const categories = ['SEARCH', 'OUTREACH', 'AT_HOME', 'OTHER'].map((cat) => ({
      key: cat,
      label: CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS],
      icon: CATEGORY_ICONS[cat as keyof typeof CATEGORY_ICONS],
      tasks: tasks.filter((t) => t.category === cat),
      taskCount: tasks.filter((t) => t.category === cat).length,
    }));

    return NextResponse.json({
      tasks,
      categories,
      summary: {
        totalTasks: tasks.length,
        searchMiles: searchStats._sum.distanceMiles || 0,
        sheltersContacted: contactedShelters,
        sheltersTotal: totalShelters,
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
