/**
 * Lost Pet Case Detail API
 * Phase 13-14: Lost Pet Cases MVP (TASK-C02)
 *
 * GET /api/cases/[id] - Get single case with notes
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

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
    // Support both UUID (id) and case number lookup
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);

    const caseData = await prisma.case.findFirst({
      where: isUuid
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
            reporter: {
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

    // Return case data directly (without wrapping in { case: ... })
    return NextResponse.json(caseData);

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
