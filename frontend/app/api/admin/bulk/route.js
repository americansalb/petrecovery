import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { createBulkNotifications } from '@/app/lib/notifications';

// POST - Execute bulk operations
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (admin?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { operation, targets, params } = await request.json();

    if (!operation || !targets || !Array.isArray(targets)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    let result;

    switch (operation) {
      case 'close_cases':
        result = await bulkCloseCases(targets, params);
        break;

      case 'notify_users':
        result = await bulkNotifyUsers(targets, params);
        break;

      case 'update_roles':
        result = await bulkUpdateRoles(targets, params);
        break;

      case 'sync_stats':
        result = await syncUserStats(targets);
        break;

      case 'cleanup_old_cases':
        result = await cleanupOldCases(params);
        break;

      default:
        return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });
    }

    // Log bulk operation
    await prisma.eventLog.create({
      data: {
        event_type: 'admin.bulk_operation',
        timestamp: new Date(),
        correlation_id: `bulk-${Date.now()}`,
        actor_user_id: session.user.id,
        actor_role: 'ADMIN',
        resource_type: 'bulk',
        action: operation,
        result: 'success',
        metadata: JSON.stringify({
          targetCount: targets.length,
          params,
          result,
        }),
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Bulk operation error:', error);
    return NextResponse.json({ error: 'Bulk operation failed' }, { status: 500 });
  }
}

async function bulkCloseCases(caseIds, params) {
  const result = await prisma.case.updateMany({
    where: { id: { in: caseIds } },
    data: {
      status: 'CLOSED_OTHER',
      resolution: params?.resolution || 'SEARCH_CEASED',
      resolutionNotes: params?.notes || 'Closed by admin',
      resolvedAt: new Date(),
    },
  });

  return { updated: result.count };
}

async function bulkNotifyUsers(userIds, params) {
  if (!params?.title || !params?.message) {
    throw new Error('Title and message required');
  }

  const result = await createBulkNotifications(userIds, {
    type: 'SYSTEM',
    title: params.title,
    message: params.message,
    actionUrl: params.actionUrl,
  });

  return result;
}

async function bulkUpdateRoles(userIds, params) {
  if (!params?.role) {
    throw new Error('Role required');
  }

  const result = await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { role: params.role },
  });

  return { updated: result.count };
}

async function syncUserStats(userIds) {
  let synced = 0;

  for (const userId of userIds) {
    try {
      // Count successful reunions
      const reunions = await prisma.case.count({
        where: {
          status: 'REUNITED',
          OR: [
            { reporterId: userId },
            { foundById: userId },
          ],
        },
      });

      // Count squads joined
      const squadsJoined = await prisma.rescueSquadMember.count({
        where: { userId },
      });

      // Count areas marked
      const areasMarked = await prisma.searchArea.count({
        where: { markedById: userId },
      });

      // Calculate total acreage
      const areas = await prisma.searchArea.findMany({
        where: { markedById: userId },
        select: { acreage: true },
      });
      const totalAcreage = areas.reduce((sum, a) => sum + (a.acreage || 0), 0);

      await prisma.user.update({
        where: { id: userId },
        data: {
          successfulReunions: reunions,
          squadsJoinedCount: squadsJoined,
          areasMarkedCount: areasMarked,
          totalAcreageSearched: totalAcreage,
        },
      });

      synced++;
    } catch (e) {
      console.error(`Error syncing stats for user ${userId}:`, e);
    }
  }

  return { synced };
}

async function cleanupOldCases(params) {
  const daysOld = params?.daysOld || 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  // Close old active cases
  const result = await prisma.case.updateMany({
    where: {
      status: { in: ['ACTIVE', 'IN_PROGRESS'] },
      createdAt: { lt: cutoff },
      updatedAt: { lt: cutoff },
    },
    data: {
      status: 'CLOSED_OTHER',
      resolution: 'SEARCH_CEASED',
      resolutionNotes: `Auto-closed after ${daysOld} days of inactivity`,
      resolvedAt: new Date(),
    },
  });

  return { closed: result.count };
}
