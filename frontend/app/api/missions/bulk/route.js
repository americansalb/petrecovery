/**
 * Bulk Cases API
 *
 * POST /api/missions/bulk - Bulk operations on cases (admin only)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

export const dynamic = 'force-dynamic';

/**
 * POST /api/missions/bulk - Bulk operations
 * Body: { action: 'delete' | 'updateStatus', ids: string[], status?: string }
 */
export async function POST(request) {
  let session = null;

  try {
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin only
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, ids, status } = body;

    if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Invalid request: action and ids required' }, { status: 400 });
    }

    if (ids.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 cases per bulk operation' }, { status: 400 });
    }

    let result = { success: true, affected: 0 };

    if (action === 'delete') {
      // Bulk delete
      await prisma.$transaction(async (tx) => {
        // Get the petIds associated with these cases (for cleanup)
        const casesWithPets = await tx.case.findMany({
          where: { id: { in: ids } },
          select: { petId: true }
        });
        const petIds = [...new Set(casesWithPets.map(c => c.petId).filter(Boolean))];

        // Delete related records first
        await tx.caseParticipant.deleteMany({
          where: { assignment: { missionId: { in: ids } } }
        });

        await tx.caseAssignment.deleteMany({
          where: { missionId: { in: ids } }
        });

        await tx.caseUpdate.deleteMany({
          where: { missionId: { in: ids } }
        });

        await tx.sighting.deleteMany({
          where: { missionId: { in: ids } }
        });

        await tx.alert.deleteMany({
          where: { missionId: { in: ids } }
        });

        // Delete cases
        const deleted = await tx.case.deleteMany({
          where: { id: { in: ids } }
        });

        result.affected = deleted.count;

        // Soft-delete any pets that now have no cases
        if (petIds.length > 0) {
          // Find pets with no remaining cases
          const petsWithCases = await tx.pet.findMany({
            where: { id: { in: petIds }, isDeleted: false },
            include: { cases: { select: { id: true } } }
          });

          const orphanedPetIds = petsWithCases
            .filter(p => p.cases.length === 0)
            .map(p => p.id);

          if (orphanedPetIds.length > 0) {
            await tx.pet.updateMany({
              where: { id: { in: orphanedPetIds } },
              data: { isDeleted: true, deletedAt: new Date() }
            });
            result.petsDeleted = orphanedPetIds.length;
          }
        }
      });

      await logEvent({
        event_type: 'case.bulk_deleted',
        resource_type: 'mission',
        action: 'delete',
        result: 'success',
        actor_user_id: session.user.id,
        actor_role: 'ADMIN',
        metadata: {
          missionIds: ids,
          deletedCount: result.affected
        }
      });

    } else if (action === 'updateStatus') {
      if (!status) {
        return NextResponse.json({ error: 'Status required for updateStatus action' }, { status: 400 });
      }

      const validStatuses = ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED', 'REUNITED', 'CLOSED_OTHER'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }

      const updated = await prisma.case.updateMany({
        where: { id: { in: ids } },
        data: { status }
      });

      result.affected = updated.count;

      await logEvent({
        event_type: 'case.bulk_status_updated',
        resource_type: 'mission',
        action: 'update',
        result: 'success',
        actor_user_id: session.user.id,
        actor_role: 'ADMIN',
        metadata: {
          missionIds: ids,
          newStatus: status,
          updatedCount: result.affected
        }
      });

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Bulk operation error:', error);

    await logEvent({
      event_type: 'case.bulk_operation_failed',
      resource_type: 'mission',
      action: 'bulk',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || 'USER',
    });

    return NextResponse.json({
      error: 'Bulk operation failed',
      message: error.message
    }, { status: 500 });
  }
}
