import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { createBulkNotifications } from '@/app/lib/notifications-inapp';

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

    if (targets.length > 500) {
      return NextResponse.json({ error: 'Too many targets. Maximum 500 per request.' }, { status: 400 });
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

      case 'cleanup_orphaned_pets':
        result = await cleanupOrphanedPets();
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

async function bulkCloseCases(missionIds, params) {
  const result = await prisma.case.updateMany({
    where: { id: { in: missionIds } },
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
  // Batch all queries instead of 4 queries per user
  const [reunionsByReporter, reunionsByFinder, squadCounts, areaCounts, acreageSums] = await Promise.all([
    // Reunions as reporter
    prisma.case.groupBy({
      by: ['reporterId'],
      where: { status: 'REUNITED', reporterId: { in: userIds } },
      _count: true,
    }),
    // Reunions as finder
    prisma.case.groupBy({
      by: ['foundById'],
      where: { status: 'REUNITED', foundById: { in: userIds } },
      _count: true,
    }),
    // Squads joined
    prisma.rescueSquadMember.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _count: true,
    }),
    // Areas marked
    prisma.searchArea.groupBy({
      by: ['markedById'],
      where: { markedById: { in: userIds } },
      _count: true,
    }),
    // Total acreage
    prisma.searchArea.groupBy({
      by: ['markedById'],
      where: { markedById: { in: userIds } },
      _sum: { acreage: true },
    }),
  ]);

  // Build lookup maps
  const reporterMap = Object.fromEntries(reunionsByReporter.map(r => [r.reporterId, r._count]));
  const finderMap = Object.fromEntries(reunionsByFinder.map(r => [r.foundById, r._count]));
  const squadMap = Object.fromEntries(squadCounts.map(r => [r.userId, r._count]));
  const areaMap = Object.fromEntries(areaCounts.map(r => [r.markedById, r._count]));
  const acreageMap = Object.fromEntries(acreageSums.map(r => [r.markedById, r._sum.acreage || 0]));

  // Update users in batches of 50
  let synced = 0;
  const batchSize = 50;

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const updates = batch.map(userId =>
      prisma.user.update({
        where: { id: userId },
        data: {
          successfulReunions: (reporterMap[userId] || 0) + (finderMap[userId] || 0),
          squadsJoinedCount: squadMap[userId] || 0,
          areasMarkedCount: areaMap[userId] || 0,
          totalAcreageSearched: acreageMap[userId] || 0,
        },
      }).catch(e => {
        console.error(`Error syncing stats for user ${userId}:`, e);
        return null;
      })
    );
    const results = await Promise.all(updates);
    synced += results.filter(Boolean).length;
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

async function cleanupOrphanedPets() {
  // Find pets that have no associated cases and are not already deleted
  const orphanedPets = await prisma.pet.findMany({
    where: {
      isDeleted: false,
      cases: { none: {} }
    },
    select: { id: true, name: true }
  });

  if (orphanedPets.length === 0) {
    return { deleted: 0, message: 'No orphaned pets found' };
  }

  // Soft-delete all orphaned pets
  const result = await prisma.pet.updateMany({
    where: {
      id: { in: orphanedPets.map(p => p.id) }
    },
    data: {
      isDeleted: true,
      deletedAt: new Date()
    }
  });

  return {
    deleted: result.count,
    petNames: orphanedPets.map(p => p.name)
  };
}
