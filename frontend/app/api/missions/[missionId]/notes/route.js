/**
 * Case Notes/Updates API
 *
 * POST /api/missions/[id]/notes - Add a note/update to a case
 *
 * Uses CaseUpdate model (not missionNote)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { onlyText, hasText, cut, UPDATE_MAX } from '@/app/lib/searchText';
import { withRateLimitAsync, rateLimitResponse } from '@/app/lib/rateLimit';

const NOTE_LIMIT = { windowMs: 60 * 1000, maxRequests: 20, blockDurationMs: 60 * 1000 };

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/missions/[id]/notes - Add note to case
 * Allowed: Mission owner, admin, or squad member assigned to this case
 */
export async function POST(request, { params }) {
  const startTime = Date.now();
  let session = null;

  try {
    // Authentication check
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = await withRateLimitAsync(request, NOTE_LIMIT, 'case:note');
    if (!limit.success) return rateLimitResponse(limit);

    // Parse request body
    const sent = await request.json().catch(() => null);
    const { content, isPinned } = sent && typeof sent === 'object' && !Array.isArray(sent) ? sent : {};

    // An update is text: the person's words with their line breaks, without what is not text, held to a length.
    const text = typeof content === 'string' ? cut(onlyText(content).replace(/\n{3,}/g, '\n\n').trim(), UPDATE_MAX) : '';
    if (!hasText(text)) {
      return NextResponse.json({
        error: 'Note content is required'
      }, { status: 400 });
    }

    // Verify case exists and check permissions
    const existingCase = await prisma.case.findUnique({
      where: { id: params.missionId },
      select: {
        id: true,
        caseNumber: true,
        status: true,
        reporterId: true,
        assignments: {
          select: {
            rescueSquadId: true,
            participants: {
              where: { userId: session.user.id },
              select: { id: true }
            }
          }
        }
      }
    });

    if (!existingCase) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Permission check: owner, admin, or participant in case
    const isOwner = existingCase.reporterId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'MODERATOR';
    const isParticipant = existingCase.assignments.some(a => a.participants.length > 0);

    if (!isOwner && !isAdmin && !isParticipant) {
      return NextResponse.json({
        error: 'Permission denied',
        message: 'You must be the case owner, admin, or a participant to add notes'
      }, { status: 403 });
    }

    // Create update/note
    const update = await prisma.caseUpdate.create({
      data: {
        caseId: params.missionId, // CaseUpdate's field is caseId (no missionId) - was 500ing every note POST
        authorId: session.user.id,
        content: text,
        isUpdate: true,
        isPinned: isPinned === true,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    const responseTime = Date.now() - startTime;

    await logEvent({
      event_type: 'case.note_added',
      resource_type: 'mission',
      resource_id: params.missionId,
      action: 'create',
      result: 'success',
      actor_user_id: session.user.id,
      metadata: {
        missionId: params.missionId,
        missionNumber: existingCase.caseNumber,
        updateId: update.id,
        contentLength: update.content.length,
        isOwner,
        response_time_ms: responseTime
      }
    });

    return NextResponse.json({
      update,
      message: 'Note added successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error adding case note:', error);

    await logEvent({
      event_type: 'case.note_add_failed',
      resource_type: 'mission',
      resource_id: params.missionId,
      action: 'create',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      metadata: {
        missionId: params.missionId,
        error_stack: error.stack?.substring(0, 500)
      }
    });

    // What went wrong is in the log above, and is not sent to whoever asked.
    return NextResponse.json({
      error: 'Failed to add note',
      message: 'That did not post. Try again in a moment.'
    }, { status: 500 });
  }
}

/**
 * GET /api/missions/[id]/notes - Get notes for a case
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check (mirrors POST): only the case owner, admin/moderator, or
    // an assigned participant may read case notes - they aren't public.
    const existingCase = await prisma.case.findUnique({
      where: { id: params.missionId },
      select: {
        id: true,
        reporterId: true,
        assignments: {
          select: {
            participants: {
              where: { userId: session.user.id },
              select: { id: true }
            }
          }
        }
      }
    });

    if (!existingCase) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    const isOwner = existingCase.reporterId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'MODERATOR';
    const isParticipant = existingCase.assignments.some(a => a.participants.length > 0);

    if (!isOwner && !isAdmin && !isParticipant) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Get case updates/notes. The owner and staff see who wrote each in full. A helper sees a first name and
    // whether a note is their own: starting a walk makes anyone a helper, so it is not a way to learn an
    // owner's last name or account id.
    const full = isOwner || isAdmin;
    const rows = await prisma.caseUpdate.findMany({
      where: { caseId: params.missionId }, // CaseUpdate's field is caseId (no @map)
      include: {
        author: {
          select: full ? { id: true, firstName: true, lastName: true } : { firstName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    const updates = full
      ? rows
      : rows.map(({ authorId, ...update }) => ({ ...update, mine: authorId === session.user.id }));

    return NextResponse.json({
      updates,
      count: updates.length
    });

  } catch (error) {
    console.error('Error fetching case notes:', error);
    return NextResponse.json({
      error: 'Failed to fetch notes'
    }, { status: 500 });
  }
}
