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

    // Parse request body
    const body = await request.json();
    const { content, isPinned } = body;

    // Validate content
    if (!content || content.trim().length === 0) {
      return NextResponse.json({
        error: 'Note content is required'
      }, { status: 400 });
    }

    // Verify case exists and check permissions
    const existingCase = await prisma.case.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        missionNumber: true,
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
        missionId: params.id,
        authorId: session.user.id,
        content: content.trim(),
        isUpdate: true,
        isPinned: isPinned || false,
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
      resource_id: params.id,
      action: 'create',
      result: 'success',
      actor_user_id: session.user.id,
      metadata: {
        missionId: params.id,
        missionNumber: existingCase.missionNumber,
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
      resource_id: params.id,
      action: 'create',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      metadata: {
        missionId: params.id,
        error_stack: error.stack?.substring(0, 500)
      }
    });

    return NextResponse.json({
      error: 'Failed to add note',
      message: error.message
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

    // Get case updates/notes
    const updates = await prisma.caseUpdate.findMany({
      where: { missionId: params.id },
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
    });

    return NextResponse.json({
      updates,
      count: updates.length
    });

  } catch (error) {
    console.error('Error fetching case notes:', error);
    return NextResponse.json({
      error: 'Failed to fetch notes',
      message: error.message
    }, { status: 500 });
  }
}
