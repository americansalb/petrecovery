/**
 * Lost Pet Case Detail API
 * Phase 13-14: Lost Pet Missions MVP (TASK-C02)
 *
 * GET /api/missions/[id] - Get single case with notes
 * PATCH /api/missions/[id] - The owner changes the photo, the description, the phone or the
 *   questionnaire (details, reward, breed, how they got out) on the report; the
 *   details token from the create response works for the questionnaire alone
 * DELETE /api/missions/[id] - Delete a case (admin only)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { normalizePhotoUrl } from '@/app/lib/utils';
import { normalizeDetails, needsMedication, healthUrgency, petFieldsFromDetails, HOW_OUT_OPTIONS } from '@/app/lib/caseDetails';
import { verifyDetailsToken, DETAILS_TOKEN_HEADER } from '@/app/lib/detailsToken';
import { scheduleKitRedraw } from '@/app/lib/cascade/redrawLater';

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

    // Mission Control opens for anyone signed in. The safety waiver is asked
    // for at the first search action instead (app/lib/waiver.js; the search,
    // block and join routes refuse without it), so here it only tells the
    // page whether to ask.
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { waiverAcceptedAt: true, role: true }
    });
    const isOwner = missionData.reporterId === session.user.id;
    const isAdmin = user?.role === 'ADMIN';

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

    // Normalize photo URL before returning
    const normalizedCase = {
      ...missionData,
      petPhotoUrl: normalizePhotoUrl(missionData.petPhotoUrl),
      viewer: { isOwner, waiverAccepted: Boolean(user?.waiverAcceptedAt) || isOwner }
    };

    // Helpers see the pet, the search and the team, not how to reach the
    // owner by email or where the owner was when they reported (often
    // home). The phone and first name are on the public page already.
    if (!isOwner && !isAdmin) {
      delete normalizedCase.ownerEmail;
      delete normalizedCase.reporterLatitude;
      delete normalizedCase.reporterLongitude;
      delete normalizedCase.reporterToLastSeenMiles;
      if (normalizedCase.reporter) {
        const { email, ...reporter } = normalizedCase.reporter;
        normalizedCase.reporter = reporter;
      }
    }

    // The witness's hold on a sighting is theirs alone: not even its hash leaves with the row.
    if (Array.isArray(normalizedCase.sightings)) {
      normalizedCase.sightings = normalizedCase.sightings.map(({ witnessKeyHash, ...sighting }) => sighting);
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

/**
 * PATCH /api/missions/[id] - the owner (or an admin) changes what the
 * report says: a better photo, a line about the pet, the phone finders
 * call. Nothing else on the report moves here; where it was lost and when
 * are what the search is built on.
 */
const DESCRIPTION_MAX = 1000;

export async function PATCH(request, { params }) {
  try {
    const id = params.missionId;
    const session = await getServerSession(authOptions);
    // The person who just posted has no session yet; the success screen
    // carries a token for the questionnaire fields of that one case
    // (app/lib/detailsToken.js).
    const token = request.headers.get(DETAILS_TOKEN_HEADER);
    const byToken = !session?.user?.id && Boolean(token) && verifyDetailsToken(token, id);
    if (!session?.user?.id && !byToken) {
      return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
    }
    const existing = await prisma.case.findUnique({
      where: { id },
      select: { id: true, reporterId: true, caseNumber: true, petId: true, priority: true, details: true, hasReward: true, rewardScamAcknowledgedAt: true },
    });
    if (!existing) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    const isOwner = Boolean(session?.user?.id) && existing.reporterId === session.user.id;
    const isAdmin = session?.user?.role === 'ADMIN';
    if (!isOwner && !isAdmin && !byToken) {
      return NextResponse.json({ error: 'Only the owner can change this report.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const QUESTIONNAIRE_FIELDS = ['details', 'hasReward', 'rewardAmount', 'rewardScamAcknowledged', 'petBreed', 'escapeScenario'];
    if (byToken && Object.keys(body).some((k) => !QUESTIONNAIRE_FIELDS.includes(k))) {
      return NextResponse.json({ error: 'Sign in to change that.' }, { status: 403 });
    }
    const data = {};
    let redraw = false;
    let merged = null;
    if (body.petPhotoUrl !== undefined) {
      const url = String(body.petPhotoUrl || '').trim();
      if (!/^https:\/\/[^\s]+$/i.test(url)) {
        return NextResponse.json({ error: 'Upload the photo first, then send its address.' }, { status: 400 });
      }
      data.petPhotoUrl = url;
    }
    if (body.petDescription !== undefined) {
      const text = String(body.petDescription || '').trim();
      if (text.length > DESCRIPTION_MAX) {
        return NextResponse.json({ error: `Keep the description under ${DESCRIPTION_MAX} letters.` }, { status: 400 });
      }
      data.petDescription = text;
    }
    if (body.ownerPhone !== undefined) {
      const digits = String(body.ownerPhone || '').replace(/\D/g, '');
      if (digits.length < 10) {
        return NextResponse.json({ error: 'A phone number needs at least 10 digits.' }, { status: 400 });
      }
      data.ownerPhone = String(body.ownerPhone).trim();
    }
    // The questionnaire (app/lib/caseDetails.js), merged over what is
    // stored, so one answer at a time is fine. Medication raises the
    // priority; it never lowers one.
    if (body.details !== undefined) {
      if (!body.details || typeof body.details !== 'object' || Array.isArray(body.details)) {
        return NextResponse.json({ error: 'Details come as an object of answers.' }, { status: 400 });
      }
      merged = normalizeDetails({ ...(existing.details || {}), ...body.details });
      data.details = merged;
      data.detailsUpdatedAt = new Date();
      data.needsMedication = needsMedication(merged);
      const rank = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 };
      const urgency = healthUrgency(merged);
      if (urgency && rank[urgency] > (rank[existing.priority] ?? 1)) data.priority = urgency;
      if (merged.howOut) data.escapeScenario = merged.howOut;
      redraw = true;
    }
    if (body.escapeScenario !== undefined) {
      const how = String(body.escapeScenario || '');
      if (!HOW_OUT_OPTIONS.some((o) => o.value === how)) {
        return NextResponse.json({ error: 'Pick how they got out from the list.' }, { status: 400 });
      }
      data.escapeScenario = how;
    }
    if (body.petBreed !== undefined) {
      const breed = String(body.petBreed || '').trim();
      if (breed.length > 60) return NextResponse.json({ error: 'Keep the breed under 60 letters.' }, { status: 400 });
      data.petBreed = breed || 'Unknown';
      redraw = true;
    }
    if (body.hasReward !== undefined) {
      const wants = body.hasReward === true;
      const amount = wants && Number.isFinite(Number(body.rewardAmount)) && Number(body.rewardAmount) > 0 ? Math.round(Number(body.rewardAmount)) : null;
      if (wants && body.rewardScamAcknowledged !== true && !existing.rewardScamAcknowledgedAt) {
        return NextResponse.json(
          { error: 'Tick the note about reward scams before offering a reward.', code: 'REWARD_SCAM_ACK_REQUIRED' },
          { status: 400 }
        );
      }
      data.hasReward = wants;
      data.rewardAmount = amount;
      if (wants && body.rewardScamAcknowledged === true) data.rewardScamAcknowledgedAt = new Date();
      redraw = true;
    }
    if (!Object.keys(data).length) {
      return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
    }

    const updated = await prisma.case.update({
      where: { id },
      data,
      select: {
        id: true,
        caseNumber: true,
        petPhotoUrl: true,
        petDescription: true,
        ownerPhone: true,
        petBreed: true,
        escapeScenario: true,
        priority: true,
        details: true,
        hasReward: true,
        rewardAmount: true,
        rewardScamAcknowledgedAt: true,
      },
    });
    // The saved pet keeps its own columns in step with the answers.
    if (merged && existing.petId) {
      const extras = petFieldsFromDetails(merged);
      const petData = Object.fromEntries(Object.entries(extras).filter(([, v]) => v));
      if (Object.keys(petData).length) await prisma.pet.update({ where: { id: existing.petId }, data: petData }).catch(() => {});
    }
    await logEvent({
      event_type: 'case.edited',
      actor_user_id: session?.user?.id || null,
      resource_type: 'case',
      resource_id: id,
      action: 'update',
      result: 'success',
      metadata: { fields: Object.keys(data), via: byToken ? 'details-token' : 'session' },
    }).catch(() => {});
    // The flyers and share images carry the answers: redraw once the edits settle.
    if (redraw) scheduleKitRedraw(id);
    return NextResponse.json({ success: true, case: updated });
  } catch (error) {
    console.error('Case edit failed:', error);
    return NextResponse.json({ error: 'Could not save that. Try again in a moment.' }, { status: 500 });
  }
}
