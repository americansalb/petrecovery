/**
 * Lost Pet Case Detail API
 * Phase 13-14: Lost Pet Cases MVP (TASK-C02)
 *
 * GET /api/cases/[id] - Get single case with notes
 * DELETE /api/cases/[id] - Delete a case (admin only)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { normalizePhotoUrl } from '@/app/lib/utils';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/cases/[id] - Get case detail with notes
 */
export async function GET(request, { params }) {
  const startTime = Date.now();
  let session = null;

  try {
    // Authentication check
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      await logEvent({
        event_type: 'case.detail_failed',
        resource_type: 'case',
        resource_id: params.id,
        action: 'read',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'Attempted to view case without authentication',
        metadata: { caseId: params.id }
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check waiver acceptance
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { waiverAcceptedAt: true }
    });

    if (!user?.waiverAcceptedAt) {
      await logEvent({
        event_type: 'case.detail_failed',
        resource_type: 'case',
        resource_id: params.id,
        action: 'read',
        result: 'failure',
        error_code: 'WAIVER_NOT_ACCEPTED',
        error_message: 'User attempted to view case without accepting liability waiver',
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { caseId: params.id }
      });

      const encodedReturnUrl = encodeURIComponent('/admin/cases/' + params.id);
      return NextResponse.json({
        error: 'Liability waiver required',
        code: 'WAIVER_NOT_ACCEPTED',
        message: 'You must accept the liability waiver before viewing cases.',
        redirectTo: '/legal/consent?returnUrl=' + encodedReturnUrl
      }, { status: 403 });
    }

    // Fetch case with all related data
    // Using Case model (not the old lostPetCase)
    // Support both ID (UUID or CUID) and case number lookup
    // UUID: 8-4-4-4-12 hex with dashes, CUID: starts with 'c', 25 alphanumeric chars
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);
    const isCuid = /^c[a-z0-9]{24}$/i.test(params.id);
    const isId = isUuid || isCuid;

    const caseData = await prisma.case.findFirst({
      where: isId
        ? { id: params.id }
        : { caseNumber: params.id },
      include: {
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        assignments: {
          include: {
            rescueSquad: {
              select: {
                id: true,
                name: true,
                city: true,
                state: true
              }
            },
            participants: {
              select: {
                id: true,
                userId: true,
                isActive: true,
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        },
        updates: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        sightings: {
          include: {
            reportedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        _count: {
          select: {
            updates: true,
            sightings: true
          }
        }
      }
    });

    if (!caseData) {
      await logEvent({
        event_type: 'case.detail_failed',
        resource_type: 'case',
        resource_id: params.id,
        action: 'read',
        result: 'failure',
        error_code: 'NOT_FOUND',
        error_message: 'Case not found: ' + params.id,
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { caseId: params.id }
      });

      return NextResponse.json({
        error: 'Case not found'
      }, { status: 404 });
    }

    const responseTime = Date.now() - startTime;

    await logEvent({
      event_type: 'case.detail_viewed',
      resource_type: 'case',
      resource_id: caseData.id,
      action: 'read',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: session.user.role || 'USER',
      metadata: {
        caseId: caseData.id,
        caseNumber: caseData.caseNumber,
        status: caseData.status,
        updates_count: caseData.updates?.length || 0,
        sightings_count: caseData.sightings?.length || 0,
        response_time_ms: responseTime
      }
    });

    // Normalize photo URL before returning
    const normalizedCase = {
      ...caseData,
      petPhotoUrl: normalizePhotoUrl(caseData.petPhotoUrl)
    };

    // Return case data directly (without wrapping in { case: ... })
    return NextResponse.json(normalizedCase);

  } catch (error) {
    console.error('Error fetching case:', error);

    await logEvent({
      event_type: 'case.detail_failed',
      resource_type: 'case',
      resource_id: params.id,
      action: 'read',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || 'USER',
      metadata: {
        caseId: params.id,
        error_stack: error.stack?.substring(0, 500)
      }
    });

    return NextResponse.json({
      error: 'Failed to fetch case',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * DELETE /api/cases/[id] - Delete a case (admin only)
 */
export async function DELETE(request, { params }) {
  let session = null;

  try {
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin only
    if (session.user.role !== 'ADMIN') {
      await logEvent({
        event_type: 'case.delete_failed',
        resource_type: 'case',
        resource_id: params.id,
        action: 'delete',
        result: 'failure',
        error_code: 'FORBIDDEN',
        error_message: 'Non-admin attempted to delete case',
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
      });
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Check if case exists
    const existingCase = await prisma.case.findUnique({
      where: { id: params.id },
      select: { id: true, caseNumber: true, petName: true }
    });

    if (!existingCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Delete related records first (cascade doesn't always work)
    await prisma.$transaction(async (tx) => {
      // Delete case participants
      await tx.caseParticipant.deleteMany({
        where: { assignment: { caseId: params.id } }
      });

      // Delete case assignments
      await tx.caseAssignment.deleteMany({
        where: { caseId: params.id }
      });

      // Delete case updates
      await tx.caseUpdate.deleteMany({
        where: { caseId: params.id }
      });

      // Delete sightings
      await tx.sighting.deleteMany({
        where: { caseId: params.id }
      });

      // Delete alerts
      await tx.alert.deleteMany({
        where: { caseId: params.id }
      });

      // Finally delete the case
      await tx.case.delete({
        where: { id: params.id }
      });
    });

    await logEvent({
      event_type: 'case.deleted',
      resource_type: 'case',
      resource_id: params.id,
      action: 'delete',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: 'ADMIN',
      metadata: {
        caseNumber: existingCase.caseNumber,
        petName: existingCase.petName
      }
    });

    return NextResponse.json({ success: true, deleted: existingCase.caseNumber });

  } catch (error) {
    console.error('Error deleting case:', error);

    await logEvent({
      event_type: 'case.delete_failed',
      resource_type: 'case',
      resource_id: params.id,
      action: 'delete',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || 'USER',
    });

    return NextResponse.json({
      error: 'Failed to delete case',
      message: error.message
    }, { status: 500 });
  }
}
