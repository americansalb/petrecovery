/**
 * Lost Pet Case Status Update API
 * Phase 13-14: Lost Pet Cases MVP (TASK-C02)
 *
 * POST /api/cases/[id]/status - Update case status
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { sendCaseStatusUpdate } from '@/app/lib/notifications';
import { requireStaffOrAdmin, PermissionError } from '@/app/lib/permissions';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/cases/[id]/status - Update case status
 * Admin only (MVP)
 */
export async function POST(request, { params }) {
  const startTime = Date.now();
  let session = null;

  try {
    // Authentication check
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      await logEvent({
        event_type: 'case.status_change_failed',
        resource_type: 'case',
        resource_id: params.id,
        action: 'update',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'Attempted to update case status without authentication',
        metadata: { caseId: params.id }
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check (Phase 22-24: ADMIN/MODERATOR only)
    try {
      await requireStaffOrAdmin(session, {
        resource_type: 'case',
        resource_id: params.id,
        action: 'update_status',
        metadata: {
          api_route: `/api/cases/${params.id}/status`,
          method: 'POST'
        }
      });
    } catch (error) {
      if (error instanceof PermissionError) {
        return NextResponse.json({
          error: 'Permission denied',
          code: 'PERMISSION_DENIED',
          message: error.message
        }, { status: 403 });
      }
      throw error;
    }

    // Check waiver acceptance
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { waiverAcceptedAt: true }
    });

    if (!user?.waiverAcceptedAt) {
      await logEvent({
        event_type: 'case.status_change_failed',
        resource_type: 'case',
        resource_id: params.id,
        action: 'update',
        result: 'failure',
        error_code: 'WAIVER_NOT_ACCEPTED',
        error_message: 'Admin attempted to update case status without accepting liability waiver',
        actor_user_id: session.user.id,
        actor_role: null,
        metadata: { caseId: params.id }
      });

      const encodedReturnUrl = encodeURIComponent('/admin/cases/' + params.id);
      return NextResponse.json({
        error: 'Liability waiver required',
        code: 'WAIVER_NOT_ACCEPTED',
        message: 'You must accept the liability waiver before updating case status.',
        redirectTo: '/legal/consent?returnUrl=' + encodedReturnUrl
      }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { status, statusReason } = body;

    // Validate status
    const validStatuses = ['OPEN', 'ACTIVE_SEARCH', 'RESOLVED', 'CLOSED_OTHER'];
    if (!status || !validStatuses.includes(status)) {
      await logEvent({
        event_type: 'case.status_change_failed',
        resource_type: 'case',
        resource_id: params.id,
        action: 'update',
        result: 'failure',
        error_code: 'VALIDATION_ERROR',
        error_message: 'Invalid status value: ' + status,
        actor_user_id: session.user.id,
        actor_role: null,
        metadata: { caseId: params.id, status, validStatuses }
      });
      return NextResponse.json({
        error: 'Invalid status. Must be OPEN, ACTIVE_SEARCH, RESOLVED, or CLOSED_OTHER'
      }, { status: 400 });
    }

    // Fetch current case
    const currentCase = await prisma.lostPetCase.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        caseNumber: true,
        status: true,
        city: true,
        state: true
      }
    });

    if (!currentCase) {
      await logEvent({
        event_type: 'case.status_change_failed',
        resource_type: 'case',
        resource_id: params.id,
        action: 'update',
        result: 'failure',
        error_code: 'NOT_FOUND',
        error_message: 'Case not found: ' + params.id,
        actor_user_id: session.user.id,
        actor_role: null,
        metadata: { caseId: params.id }
      });
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const oldStatus = currentCase.status;

    // Validate status transitions (basic MVP logic)
    const validTransitions = {
      'OPEN': ['ACTIVE_SEARCH', 'RESOLVED', 'CLOSED_OTHER'],
      'ACTIVE_SEARCH': ['RESOLVED', 'CLOSED_OTHER'],
      'RESOLVED': [],
      'CLOSED_OTHER': []
    };

    if (oldStatus === status) {
      return NextResponse.json({
        message: 'Status unchanged',
        case: currentCase
      });
    }

    if (!validTransitions[oldStatus].includes(status)) {
      await logEvent({
        event_type: 'case.status_change_failed',
        resource_type: 'case',
        resource_id: params.id,
        action: 'update',
        result: 'failure',
        error_code: 'INVALID_TRANSITION',
        error_message: 'Invalid status transition from ' + oldStatus + ' to ' + status,
        actor_user_id: session.user.id,
        actor_role: null,
        metadata: {
          caseId: params.id,
          oldStatus,
          newStatus: status,
          validTransitions: validTransitions[oldStatus]
        }
      });
      return NextResponse.json({
        error: 'Invalid status transition from ' + oldStatus + ' to ' + status,
        validTransitions: validTransitions[oldStatus]
      }, { status: 400 });
    }

    // Update case and create status change note in transaction
    const updatedCase = await prisma.$transaction(async (tx) => {
      // Update case status
      const updated = await tx.lostPetCase.update({
        where: { id: params.id },
        data: {
          status,
          statusReason: statusReason || null
        },
        // Need these fields for notifications
        select: {
          id: true,
          caseNumber: true,
          petName: true,
          contactName: true,
          contactEmail: true,
          city: true,
          state: true,
          zipCode: true,
          statusReason: true,
          isPublic: true,
          createdAt: true,
          updatedAt: true,
          petSpecies: true,
          petBreed: true,
          petColor: true,
          petDescription: true,
          lastSeenLandmark: true,
          lastSeenAt: true,
          status: true,
          isUrgent: true,
          contactPhone: true,
          publicContactOk: true,
          source: true,
          createdById: true,
          squadId: true,
          squad: {
            select: {
              id: true,
              name: true,
              city: true,
              state: true
            }
          }
        }
      });

      // Create status change note
      await tx.lostPetCaseNote.create({
        data: {
          caseId: params.id,
          authorId: session.user.id,
          type: 'STATUS_CHANGE',
          content: 'Status changed from ' + oldStatus + ' to ' + status + (statusReason ? '. Reason: ' + statusReason : '.'),
          metadata: JSON.stringify({
            oldStatus,
            newStatus: status,
            statusReason
          })
        }
      });

      return updated;
    });

    const responseTime = Date.now() - startTime;

    // Emit success event
    await logEvent({
      event_type: 'case.status_changed',
      resource_type: 'case',
      resource_id: params.id,
      action: 'update',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: null,
      metadata: {
        caseId: params.id,
        caseNumber: currentCase.caseNumber,
        oldStatus,
        newStatus: status,
        statusReason,
        response_time_ms: responseTime
      }
    });

    // NEW (Phase 25-26): Send status update notification (non-blocking)
    const notifiableStatuses = ['ACTIVE_SEARCH', 'RESOLVED', 'CLOSED_OTHER'];
    const shouldNotify = notifiableStatuses.includes(status)
                         && updatedCase.contactEmail
                         && oldStatus !== status;

    if (shouldNotify) {
      try {
        await sendCaseStatusUpdate({
          caseNumber: updatedCase.caseNumber,
          petName: updatedCase.petName,
          contactName: updatedCase.contactName,
          contactEmail: updatedCase.contactEmail,
          city: updatedCase.city,
          state: updatedCase.state,
          statusReason: updatedCase.statusReason,
          isPublic: updatedCase.isPublic
        }, oldStatus, status);
      } catch (notificationError) {
        // Log error but don't break the API response
        console.error('❌ Status notification error:', notificationError);
        await logEvent({
          event_type: 'notification.send_failed',
          resource_type: 'notification',
          resource_id: updatedCase.caseNumber,
          action: 'create',
          result: 'failure',
          error_code: 'NOTIFICATION_EXCEPTION',
          error_message: notificationError.message,
          metadata: {
            case_number: updatedCase.caseNumber,
            old_status: oldStatus,
            new_status: status,
            error_stack: notificationError.stack?.substring(0, 500)
          }
        });
      }
    }

    return NextResponse.json({
      case: updatedCase,
      message: 'Status updated successfully'
    });

  } catch (error) {
    console.error('Error updating case status:', error);

    await logEvent({
      event_type: 'case.status_change_failed',
      resource_type: 'case',
      resource_id: params.id,
      action: 'update',
      result: 'failure',
      error_code: 'DB_WRITE_FAILED',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || 'USER',
      metadata: {
        caseId: params.id,
        error_stack: error.stack?.substring(0, 500)
      }
    });

    return NextResponse.json({
      error: 'Failed to update case status',
      message: error.message
    }, { status: 500 });
  }
}
