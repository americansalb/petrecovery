/**
 * Lost Pet Case Detail API
 * Phase 13-14: Lost Pet Missions MVP (TASK-C02)
 *
 * GET /api/missions/[id] - Get single case with notes
 * DELETE /api/missions/[id] - Delete a case (admin only)
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
 * GET /api/missions/[id] - Get case detail with notes
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
        resource_type: 'mission',
        resource_id: params.missionId,
        action: 'read',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'Attempted to view case without authentication',
        metadata: { missionId: params.missionId }
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch case FIRST so we can check ownership before waiver gate
    // Support both ID (UUID or CUID) and case number lookup
    // UUID: 8-4-4-4-12 hex with dashes, CUID: starts with 'c', 25 alphanumeric chars
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.missionId);
    const isCuid = /^c[a-z0-9]{24}$/i.test(params.missionId);
    const isId = isUuid || isCuid;

    const missionData = await prisma.case.findFirst({
      where: isId
        ? { id: params.missionId }
        : { caseNumber: params.missionId },
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

    if (!missionData) {
      await logEvent({
        event_type: 'case.detail_failed',
        resource_type: 'mission',
        resource_id: params.missionId,
        action: 'read',
        result: 'failure',
        error_code: 'NOT_FOUND',
        error_message: 'Mission not found: ' + params.missionId,
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { missionId: params.missionId }
      });

      return NextResponse.json({
        error: 'Mission not found'
      }, { status: 404 });
    }

    // Check waiver acceptance — skip for case owners
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { waiverAcceptedAt: true }
    });

    if (!user?.waiverAcceptedAt && missionData.reporterId !== session.user.id) {
      await logEvent({
        event_type: 'case.detail_failed',
        resource_type: 'mission',
        resource_id: params.missionId,
        action: 'read',
        result: 'failure',
        error_code: 'WAIVER_NOT_ACCEPTED',
        error_message: 'User attempted to view case without accepting liability waiver',
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { missionId: params.missionId }
      });

      const encodedReturnUrl = encodeURIComponent('/admin/missions/' + params.missionId);
      return NextResponse.json({
        error: 'Liability waiver required',
        code: 'WAIVER_NOT_ACCEPTED',
        message: 'You must accept the liability waiver before viewing cases.',
        redirectTo: '/legal/consent?returnUrl=' + encodedReturnUrl
      }, { status: 403 });
    }

    const responseTime = Date.now() - startTime;

    await logEvent({
      event_type: 'case.detail_viewed',
      resource_type: 'mission',
      resource_id: missionData.id,
      action: 'read',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: session.user.role || 'USER',
      metadata: {
        missionId: missionData.id,
        missionNumber: missionData.caseNumber,
        status: missionData.status,
        updates_count: missionData.updates?.length || 0,
        sightings_count: missionData.sightings?.length || 0,
        response_time_ms: responseTime
      }
    });

    // Owner contact details are PII. This platform's whole contact model routes
    // finder↔owner through the brokered relay (lib/relay.js) precisely so raw
    // phone/email is never exposed until both sides opt in — so a case-detail
    // read must not hand the owner's phone/email (or the reporter's email) to
    // every waiver-accepting volunteer who can guess a case id. Only the case
    // owner and admins see contact info; everyone else gets the operational
    // case (pet, location, sightings, assignments) with contact PII stripped.
    const isOwner = missionData.reporterId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN';
    const canSeeContact = isOwner || isAdmin;

    // Normalize photo URL before returning
    const normalizedCase = {
      ...missionData,
      petPhotoUrl: normalizePhotoUrl(missionData.petPhotoUrl)
    };

    if (!canSeeContact) {
      normalizedCase.ownerPhone = null;
      normalizedCase.ownerEmail = null;
      if (normalizedCase.reporter) {
        normalizedCase.reporter = {
          id: normalizedCase.reporter.id,
          firstName: normalizedCase.reporter.firstName,
        };
      }
    }

    // Return case data directly (without wrapping in { case: ... })
    return NextResponse.json(normalizedCase);

  } catch (error) {
    console.error('Error fetching case:', error);

    await logEvent({
      event_type: 'case.detail_failed',
      resource_type: 'mission',
      resource_id: params.missionId,
      action: 'read',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || 'USER',
      metadata: {
        missionId: params.missionId,
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
 * DELETE /api/missions/[id] - Delete a case (admin only)
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
        resource_type: 'mission',
        resource_id: params.missionId,
        action: 'delete',
        result: 'failure',
        error_code: 'FORBIDDEN',
        error_message: 'Non-admin attempted to delete case',
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
      });
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Check if case exists and get associated pet
    const existingCase = await prisma.case.findUnique({
      where: { id: params.missionId },
      select: { id: true, caseNumber: true, petName: true, petId: true }
    });

    if (!existingCase) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Delete related records first (cascade doesn't always work)
    await prisma.$transaction(async (tx) => {
      // Delete case participants
      await tx.caseParticipant.deleteMany({
        where: { assignment: { missionId: params.missionId } }
      });

      // Delete case assignments
      await tx.caseAssignment.deleteMany({
        where: { missionId: params.missionId }
      });

      // Delete case updates
      await tx.caseUpdate.deleteMany({
        where: { missionId: params.missionId }
      });

      // Delete sightings
      await tx.caseSighting.deleteMany({
        where: { missionId: params.missionId }
      });

      // Delete alerts
      await tx.alert.deleteMany({
        where: { missionId: params.missionId }
      });

      // Finally delete the case
      await tx.case.delete({
        where: { id: params.missionId }
      });

      // Soft-delete associated pet if it has no other active cases
      if (existingCase.petId) {
        const otherActiveCases = await tx.case.count({
          where: {
            petId: existingCase.petId,
            id: { not: params.missionId },
            status: { in: ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'] }
          }
        });

        if (otherActiveCases === 0) {
          await tx.pet.update({
            where: { id: existingCase.petId },
            data: {
              isDeleted: true,
              deletedAt: new Date()
            }
          });
        }
      }
    });

    await logEvent({
      event_type: 'case.deleted',
      resource_type: 'mission',
      resource_id: params.missionId,
      action: 'delete',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: 'ADMIN',
      metadata: {
        missionNumber: existingCase.caseNumber,
        petName: existingCase.petName
      }
    });

    return NextResponse.json({ success: true, deleted: existingCase.caseNumber });

  } catch (error) {
    console.error('Error deleting case:', error);

    await logEvent({
      event_type: 'case.delete_failed',
      resource_type: 'mission',
      resource_id: params.missionId,
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
