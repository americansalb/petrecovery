/**
 * Case Squad Assignment API
 * Phase 22-24: Roles, Permissions & Case Assignment MVP (TASK-R04)
 *
 * POST /api/cases/[id]/assign-squad - Assign or unassign owning squad
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { requireStaffOrAdmin, PermissionError } from '@/app/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cases/[id]/assign-squad
 *
 * Body: { squadId: string | null }
 *
 * - Assigns or unassigns the owning squad for a case.
 * - Requires STAFF or ADMIN (MVP: owned by admin).
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

    const { squadId } = await request.json();

    // Permission check (Phase 22-24: ADMIN/MODERATOR only)
    try {
      await requireStaffOrAdmin(session, {
        resource_type: 'case',
        resource_id: caseId,
        action: 'assign_squad',
        metadata: {
          api_route: `/api/cases/${caseId}/assign-squad`,
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

    const existing = await prisma.lostPetCase.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        caseNumber: true,
        squadId: true,
        coordinatorId: true,
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
          type: 'squad',
          case_id: caseId,
        },
      });

      return NextResponse.json(
        { error: 'Case not found', code: 'CASE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const oldSquadId = existing.squadId;
    const newSquadId = squadId && squadId.trim() !== '' ? squadId : null;

    if (oldSquadId === newSquadId) {
      return NextResponse.json({
        success: true,
        case: existing,
        noChange: true,
        message: 'Squad unchanged',
      });
    }

    // Validate squad if assigning
    let newSquad = null;
    if (newSquadId) {
      newSquad = await prisma.rescueSquad.findUnique({
        where: { id: newSquadId },
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          isActive: true,
        },
      });

      if (!newSquad) {
        await logEvent({
          event_type: 'case.assignment_changed',
          resource_type: 'case',
          resource_id: caseId,
          action: 'update',
          result: 'failure',
          error_code: 'SQUAD_NOT_FOUND',
          error_message: 'Squad not found: ' + newSquadId,
          actor_user_id: session.user.id,
          actor_role: session.user.role || 'USER',
          metadata: {
            type: 'squad',
            case_number: existing.caseNumber,
            squad_id: newSquadId,
          },
        });

        return NextResponse.json(
          { error: 'Squad not found', code: 'SQUAD_NOT_FOUND' },
          { status: 400 }
        );
      }

      // Validate squad is active
      if (!newSquad.isActive) {
        await logEvent({
          event_type: 'case.assignment_changed',
          resource_type: 'case',
          resource_id: caseId,
          action: 'update',
          result: 'failure',
          error_code: 'SQUAD_NOT_ACTIVE',
          error_message: 'Cannot assign inactive squad: ' + newSquadId,
          actor_user_id: session.user.id,
          actor_role: session.user.role || 'USER',
          metadata: {
            type: 'squad',
            case_number: existing.caseNumber,
            squad_id: newSquadId,
            squad_name: newSquad.name,
          },
        });

        return NextResponse.json(
          {
            error: 'Inactive squad',
            code: 'SQUAD_NOT_ACTIVE',
            message: 'Cannot assign inactive squad',
          },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.lostPetCase.update({
      where: { id: caseId },
      data: {
        squadId: newSquadId,
      },
      select: {
        id: true,
        caseNumber: true,
        squadId: true,
        coordinatorId: true,
        squad: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
          },
        },
      },
    });

    const responseTime = Date.now() - startTime;

    await logEvent({
      event_type: 'case.assignment_changed',
      resource_type: 'case',
      resource_id: updated.id,
      action: 'update',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: session.user.role || 'USER',
      metadata: {
        type: 'squad',
        case_number: updated.caseNumber,
        old_squad_id: oldSquadId,
        new_squad_id: newSquadId,
        new_squad_name: newSquad?.name || null,
        new_squad_city: newSquad?.city || null,
        new_squad_state: newSquad?.state || null,
        response_time_ms: responseTime,
      },
    });

    return NextResponse.json({
      success: true,
      case: updated,
      message: newSquadId
        ? 'Squad assigned successfully'
        : 'Squad unassigned successfully',
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

    console.error('Error assigning squad:', error);
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
        type: 'squad',
        error_stack: error.stack?.substring(0, 500),
      },
    });

    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR', message: error.message },
      { status: 500 }
    );
  }
}
