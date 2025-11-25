/**
 * Case Coordinator Assignment API
 * Phase 22-24: Roles, Permissions & Case Assignment MVP (TASK-R04)
 *
 * POST /api/cases/[id]/assign-coordinator - Assign or unassign coordinator
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { requireStaffOrAdmin, PermissionError } from '@/app/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cases/[id]/assign-coordinator
 *
 * Body: { coordinatorId: string | null }
 *
 * - Assigns or unassigns the primary coordinator for a case.
 * - Requires STAFF or ADMIN (MVP: primarily ADMIN).
 * - Emits case.assignment_changed events.
 */
export async function POST(request, { params }) {
  const caseId = params.id;
  const startTime = Date.now();

  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { coordinatorId } = await request.json();

    // Permission check (Phase 22-24: ADMIN/MODERATOR only)
    try {
      await requireStaffOrAdmin(session, {
        resource_type: 'case',
        resource_id: caseId,
        action: 'assign_coordinator',
        metadata: {
          api_route: `/api/cases/${caseId}/assign-coordinator`,
          method: 'POST',
        },
      });
    } catch (error) {
      if (error instanceof PermissionError) {
        return NextResponse.json(
          {
            error: 'Permission denied',
            code: 'PERMISSION_DENIED',
            message: error.message,
          },
          { status: 403 }
        );
      }
      throw error;
    }

    // Fetch existing case (to compare old assignment)
    const existing = await prisma.lostPetCase.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        caseNumber: true,
        coordinatorId: true,
        squadId: true,
      },
    });

    if (!existing) {
      await logEvent({
        event_type: 'case.assignment_changed',
        resource_type: 'case',
        resource_id: caseId,
        action: 'update',
        result: 'failure',
        error_code: 'CASE_NOT_FOUND',
        error_message: 'Case not found: ' + caseId,
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: {
          type: 'coordinator',
          case_id: caseId,
        },
      });

      return NextResponse.json(
        { error: 'Case not found', code: 'CASE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const oldCoordinatorId = existing.coordinatorId;

    // Allow unassign via null/empty string
    const newCoordinatorId =
      coordinatorId && coordinatorId.trim() !== '' ? coordinatorId : null;

    // If no change, short-circuit
    if (oldCoordinatorId === newCoordinatorId) {
      return NextResponse.json({
        success: true,
        case: existing,
        noChange: true,
        message: 'Coordinator unchanged',
      });
    }

    // Optional: validate that the user exists and has appropriate role
    let newCoordinator = null;
    if (newCoordinatorId) {
      newCoordinator = await prisma.user.findUnique({
        where: { id: newCoordinatorId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      });

      if (!newCoordinator) {
        await logEvent({
          event_type: 'case.assignment_changed',
          resource_type: 'case',
          resource_id: caseId,
          action: 'update',
          result: 'failure',
          error_code: 'COORDINATOR_NOT_FOUND',
          error_message: 'Coordinator user not found: ' + newCoordinatorId,
          actor_user_id: session.user.id,
          actor_role: session.user.role || 'USER',
          metadata: {
            type: 'coordinator',
            case_number: existing.caseNumber,
            coordinator_id: newCoordinatorId,
          },
        });

        return NextResponse.json(
          { error: 'Coordinator not found', code: 'COORDINATOR_NOT_FOUND' },
          { status: 400 }
        );
      }

      // Validate coordinator has ADMIN or MODERATOR role
      if (newCoordinator.role !== 'ADMIN' && newCoordinator.role !== 'MODERATOR') {
        await logEvent({
          event_type: 'case.assignment_changed',
          resource_type: 'case',
          resource_id: caseId,
          action: 'update',
          result: 'failure',
          error_code: 'INVALID_COORDINATOR_ROLE',
          error_message: `User ${newCoordinatorId} has role ${newCoordinator.role}, must be ADMIN or MODERATOR`,
          actor_user_id: session.user.id,
          actor_role: session.user.role || 'USER',
          metadata: {
            type: 'coordinator',
            case_number: existing.caseNumber,
            coordinator_id: newCoordinatorId,
            coordinator_role: newCoordinator.role,
          },
        });

        return NextResponse.json(
          {
            error: 'Invalid coordinator role',
            code: 'INVALID_COORDINATOR_ROLE',
            message: 'Coordinator must have ADMIN or MODERATOR role',
          },
          { status: 400 }
        );
      }
    }

    // Update case
    const updated = await prisma.lostPetCase.update({
      where: { id: caseId },
      data: {
        coordinatorId: newCoordinatorId,
      },
      select: {
        id: true,
        caseNumber: true,
        coordinatorId: true,
        squadId: true,
        coordinator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const responseTime = Date.now() - startTime;

    // Emit assignment change event
    await logEvent({
      event_type: 'case.assignment_changed',
      resource_type: 'case',
      resource_id: updated.id,
      action: 'update',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: session.user.role || 'USER',
      metadata: {
        type: 'coordinator',
        case_number: updated.caseNumber,
        old_coordinator_id: oldCoordinatorId,
        new_coordinator_id: newCoordinatorId,
        new_coordinator_role: newCoordinator?.role || null,
        response_time_ms: responseTime,
      },
    });

    return NextResponse.json({
      success: true,
      case: updated,
      message: newCoordinatorId
        ? 'Coordinator assigned successfully'
        : 'Coordinator unassigned successfully',
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json(
        {
          error: 'Permission denied',
          code: 'PERMISSION_DENIED',
          message: error.message,
        },
        { status: 403 }
      );
    }

    console.error('Error assigning coordinator:', error);
    await logEvent({
      event_type: 'case.assignment_changed',
      resource_type: 'case',
      resource_id: params.id,
      action: 'update',
      result: 'failure',
      error_code: 'ASSIGNMENT_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || 'USER',
      metadata: {
        type: 'coordinator',
        error_stack: error.stack?.substring(0, 500),
      },
    });

    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR', message: error.message },
      { status: 500 }
    );
  }
}
