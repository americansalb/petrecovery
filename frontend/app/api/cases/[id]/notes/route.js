/**
 * Lost Pet Case Notes API
 * Phase 13-14: Lost Pet Cases MVP (TASK-C02)
 *
 * POST /api/cases/[id]/notes - Add note to case
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/cases/[id]/notes - Add note to case
 * Admin or squad member (MVP: admin-only for simplicity)
 */
export async function POST(request, { params }) {
  const startTime = Date.now();
  let session = null;

  try {
    // Authentication check
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      await logEvent({
        event_type: 'case.note_add_failed',
        resource_type: 'case',
        resource_id: params.id,
        action: 'create',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'Attempted to add case note without authentication',
        metadata: { caseId: params.id }
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check waiver acceptance
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        waiverAcceptedAt: true,
        role: true
      }
    });

    if (!user?.waiverAcceptedAt) {
      await logEvent({
        event_type: 'case.note_add_failed',
        resource_type: 'case',
        resource_id: params.id,
        action: 'create',
        result: 'failure',
        error_code: 'WAIVER_NOT_ACCEPTED',
        error_message: 'User attempted to add case note without accepting liability waiver',
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { caseId: params.id }
      });

      const encodedReturnUrl = encodeURIComponent('/admin/cases/' + params.id);
      return NextResponse.json({
        error: 'Liability waiver required',
        code: 'WAIVER_NOT_ACCEPTED',
        message: 'You must accept the liability waiver before adding case notes.',
        redirectTo: '/legal/consent?returnUrl=' + encodedReturnUrl
      }, { status: 403 });
    }

    // MVP: Admin only (could extend to squad members later)
    if (user.role !== 'ADMIN') {
      await logEvent({
        event_type: 'case.note_add_failed',
        resource_type: 'case',
        resource_id: params.id,
        action: 'create',
        result: 'failure',
        error_code: 'PERMISSION_DENIED',
        error_message: 'User attempted to add case note without admin role',
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { caseId: params.id }
      });
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { content, type } = body;

    // Validate content
    if (!content || content.trim().length === 0) {
      await logEvent({
        event_type: 'case.note_add_failed',
        resource_type: 'case',
        resource_id: params.id,
        action: 'create',
        result: 'failure',
        error_code: 'VALIDATION_ERROR',
        error_message: 'Note content is required',
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { caseId: params.id }
      });
      return NextResponse.json({
        error: 'Note content is required'
      }, { status: 400 });
    }

    // Verify case exists
    const caseExists = await prisma.lostPetCase.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        caseNumber: true,
        status: true
      }
    });

    if (!caseExists) {
      await logEvent({
        event_type: 'case.note_add_failed',
        resource_type: 'case',
        resource_id: params.id,
        action: 'create',
        result: 'failure',
        error_code: 'NOT_FOUND',
        error_message: 'Case not found: ' + params.id,
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { caseId: params.id }
      });
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Create note
    const note = await prisma.lostPetCaseNote.create({
      data: {
        caseId: params.id,
        authorId: session.user.id,
        type: type || 'NOTE',
        content: content.trim()
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

    // Emit success event
    await logEvent({
      event_type: 'case.note_added',
      resource_type: 'case',
      resource_id: params.id,
      action: 'create',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: session.user.role || 'USER',
      metadata: {
        caseId: params.id,
        caseNumber: caseExists.caseNumber,
        noteId: note.id,
        noteType: note.type,
        contentLength: note.content.length,
        response_time_ms: responseTime
      }
    });

    return NextResponse.json({
      note,
      message: 'Note added successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error adding case note:', error);

    await logEvent({
      event_type: 'case.note_add_failed',
      resource_type: 'case',
      resource_id: params.id,
      action: 'create',
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
      error: 'Failed to add note',
      message: error.message
    }, { status: 500 });
  }
}
