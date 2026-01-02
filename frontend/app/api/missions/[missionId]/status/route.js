/**
 * Mission Status Update API
 *
 * POST /api/missions/[id]/status - Update case status
 *
 * Allows:
 * - Mission owner to update their own case status
 * - Admin/Staff to update any case status
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/missions/[id]/status - Update case status
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
        resource_type: 'mission',
        resource_id: params.missionId,
        action: 'update',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'Attempted to update case status without authentication',
        metadata: { missionId: params.missionId }
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { status, resolution, resolutionNotes } = body;

    // Valid statuses from CaseStatus enum
    const validStatuses = ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED', 'REUNITED', 'CLOSED_OTHER'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({
        error: 'Invalid status',
        message: `Status must be one of: ${validStatuses.join(', ')}`,
        validStatuses
      }, { status: 400 });
    }

    // Valid resolutions from CaseResolution enum
    const validResolutions = ['REUNITED', 'FOUND_BY_OWNER', 'FOUND_AT_SHELTER', 'CAME_HOME', 'DECEASED', 'SEARCH_CEASED'];

    // Fetch current case
    const currentMission = await prisma.case.findUnique({
      where: { id: params.missionId },
      select: {
        id: true,
        caseNumber: true,
        status: true,
        reporterId: true,
        petName: true,
        ownerName: true,
        ownerEmail: true,
      }
    });

    if (!currentMission) {
      await logEvent({
        event_type: 'case.status_change_failed',
        resource_type: 'mission',
        resource_id: params.missionId,
        action: 'update',
        result: 'failure',
        error_code: 'NOT_FOUND',
        error_message: 'Mission not found: ' + params.missionId,
        actor_user_id: session.user.id,
        metadata: { missionId: params.missionId }
      });
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Permission check: must be owner or admin
    const isOwner = currentMission.reporterId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'MODERATOR';

    if (!isOwner && !isAdmin) {
      await logEvent({
        event_type: 'case.status_change_failed',
        resource_type: 'mission',
        resource_id: params.missionId,
        action: 'update',
        result: 'failure',
        error_code: 'PERMISSION_DENIED',
        error_message: 'User is not owner or admin',
        actor_user_id: session.user.id,
        metadata: { missionId: params.missionId, reporterId: currentMission.reporterId }
      });
      return NextResponse.json({
        error: 'Permission denied',
        message: 'You can only update your own cases'
      }, { status: 403 });
    }

    const oldStatus = currentMission.status;

    // Status unchanged
    if (oldStatus === status) {
      return NextResponse.json({
        message: 'Status unchanged',
        case: currentMission
      });
    }

    // Build update data
    const updateData = {
      status,
      updatedAt: new Date(),
    };

    // Handle resolution for terminal statuses
    if (status === 'REUNITED' || status === 'CLOSED_OTHER') {
      updateData.resolvedAt = new Date();

      if (resolution && validResolutions.includes(resolution)) {
        updateData.resolution = resolution;
      } else if (status === 'REUNITED') {
        updateData.resolution = 'REUNITED';
      }

      if (resolutionNotes) {
        updateData.resolutionNotes = resolutionNotes;
      }
    }

    // Update case and create status change note in transaction
    const updatedMission = await prisma.$transaction(async (tx) => {
      // Update case status
      const updated = await tx.case.update({
        where: { id: params.missionId },
        data: updateData,
        select: {
          id: true,
          caseNumber: true,
          petName: true,
          petSpecies: true,
          status: true,
          resolution: true,
          resolutionNotes: true,
          resolvedAt: true,
          ownerName: true,
          ownerEmail: true,
          lastSeenAddress: true,
          updatedAt: true,
        }
      });

      // Create status change note
      await tx.caseUpdate.create({
        data: {
          missionId: params.missionId,
          authorId: session.user.id,
          content: `Status changed from ${oldStatus} to ${status}${resolutionNotes ? '. Notes: ' + resolutionNotes : ''}`,
          isUpdate: true,
        }
      });

      return updated;
    });

    const responseTime = Date.now() - startTime;

    // Log success
    await logEvent({
      event_type: 'case.status_changed',
      resource_type: 'mission',
      resource_id: params.missionId,
      action: 'update',
      result: 'success',
      actor_user_id: session.user.id,
      metadata: {
        missionId: params.missionId,
        missionNumber: currentMission.caseNumber,
        oldStatus,
        newStatus: status,
        resolution,
        isOwner,
        response_time_ms: responseTime
      }
    });

    return NextResponse.json({
      case: updatedMission,
      message: 'Status updated successfully'
    });

  } catch (error) {
    console.error('Error updating case status:', error);

    await logEvent({
      event_type: 'case.status_change_failed',
      resource_type: 'mission',
      resource_id: params.missionId,
      action: 'update',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      metadata: {
        missionId: params.missionId,
        error_stack: error.stack?.substring(0, 500)
      }
    });

    return NextResponse.json({
      error: 'Failed to update case status',
      message: error.message
    }, { status: 500 });
  }
}
