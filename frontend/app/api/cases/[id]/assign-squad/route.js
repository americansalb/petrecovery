/**
 * Case Squad Assignment API
 *
 * GET /api/cases/[id]/assign-squad - Get current squad assignment(s) for a case
 * POST /api/cases/[id]/assign-squad - Assign a rescue squad to a case
 * DELETE /api/cases/[id]/assign-squad - Remove a squad assignment (admin only)
 *
 * Uses CaseAssignment model (not direct squadId on Case)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/cases/[id]/assign-squad
 * Get current squad assignments for a case
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const caseId = params.id;

    const assignments = await prisma.caseAssignment.findMany({
      where: { caseId },
      include: {
        rescueSquad: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            isActive: true,
            isDeleted: true,
          },
        },
      },
      orderBy: { acceptedAt: 'desc' },
    });

    return NextResponse.json({
      assignments,
      count: assignments.length,
    });
  } catch (error) {
    console.error('Error fetching squad assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

/**
 * DELETE /api/cases/[id]/assign-squad
 * Remove a squad assignment (admin only, or to reassign)
 * Body: { squadId: string } - which squad to remove, or omit to remove all
 */
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin only for removing assignments
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'MODERATOR';
    if (!isAdmin) {
      return NextResponse.json({
        error: 'Permission denied',
        message: 'Only admins can remove squad assignments'
      }, { status: 403 });
    }

    const caseId = params.id;
    let squadId = null;

    try {
      const body = await request.json();
      squadId = body.squadId;
    } catch {
      // No body or invalid JSON - will remove all assignments
    }

    const whereClause = squadId
      ? { caseId, rescueSquadId: squadId }
      : { caseId };

    const deleted = await prisma.caseAssignment.deleteMany({
      where: whereClause,
    });

    await logEvent({
      event_type: 'case.squad_unassigned',
      resource_type: 'case',
      resource_id: caseId,
      action: 'delete',
      result: 'success',
      actor_user_id: session.user.id,
      metadata: {
        squadId: squadId || 'all',
        deletedCount: deleted.count,
      },
    });

    return NextResponse.json({
      success: true,
      message: squadId
        ? 'Squad assignment removed'
        : 'All squad assignments removed',
      deletedCount: deleted.count,
    });
  } catch (error) {
    console.error('Error removing squad assignment:', error);
    return NextResponse.json({ error: 'Failed to remove assignment' }, { status: 500 });
  }
}

/**
 * POST /api/cases/[id]/assign-squad
 * Body: { squadId: string }
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

    const caseId = params.id;
    const body = await request.json();
    const { squadId } = body;

    if (!squadId) {
      return NextResponse.json({
        error: 'Squad ID required',
        message: 'Please provide a squadId in the request body'
      }, { status: 400 });
    }

    // Check case exists
    const existingCase = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        caseNumber: true,
        reporterId: true,
        status: true,
      },
    });

    if (!existingCase) {
      return NextResponse.json(
        { error: 'Case not found', code: 'CASE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check squad exists and is active
    const squad = await prisma.rescueSquad.findUnique({
      where: { id: squadId },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        isActive: true,
      },
    });

    if (!squad) {
      return NextResponse.json(
        { error: 'Squad not found', code: 'SQUAD_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (!squad.isActive) {
      return NextResponse.json(
        { error: 'Squad is not active', code: 'SQUAD_NOT_ACTIVE' },
        { status: 400 }
      );
    }

    // Permission check: must be admin/staff OR case owner
    const isOwner = existingCase.reporterId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'MODERATOR';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({
        error: 'Permission denied',
        message: 'Only case owner or admin can assign squads'
      }, { status: 403 });
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.caseAssignment.findFirst({
      where: {
        caseId: caseId,
        rescueSquadId: squadId,
      },
    });

    if (existingAssignment) {
      return NextResponse.json({
        success: true,
        message: 'Squad already assigned to this case',
        assignment: existingAssignment,
      });
    }

    // Create new assignment
    const assignment = await prisma.caseAssignment.create({
      data: {
        caseId: caseId,
        rescueSquadId: squadId,
        status: 'ACCEPTED',
        acceptedById: session.user.id,
      },
      include: {
        rescueSquad: {
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
      event_type: 'case.squad_assigned',
      resource_type: 'case',
      resource_id: caseId,
      action: 'update',
      result: 'success',
      actor_user_id: session.user.id,
      metadata: {
        caseNumber: existingCase.caseNumber,
        squadId: squadId,
        squadName: squad.name,
        assignmentId: assignment.id,
        response_time_ms: responseTime,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Squad assigned successfully',
      assignment: assignment,
    });

  } catch (error) {
    console.error('Error assigning squad:', error);

    await logEvent({
      event_type: 'case.squad_assignment_failed',
      resource_type: 'case',
      resource_id: params.id,
      action: 'update',
      result: 'failure',
      error_code: 'ASSIGNMENT_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      metadata: {
        error_stack: error.stack?.substring(0, 500),
      },
    });

    return NextResponse.json({
      error: 'Failed to assign squad',
      message: error.message
    }, { status: 500 });
  }
}
