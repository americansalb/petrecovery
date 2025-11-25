// /api/cases/[id]/assign-coordinator/route.js
// Assign a coordinator to a case

import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { requireStaff, PermissionError } from '@/app/lib/permissions';
import { logEvent } from '@/app/lib/logging';
import { sendCoordinatorAssignmentNotification } from '@/app/lib/notifications';
import prisma from '@/app/lib/prisma';

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    requireStaff(session, 'assign coordinator');

    const { id } = params;
    const body = await request.json();
    const { coordinatorId } = body;

    // Validate case exists
    const existingCase = await prisma.case.findUnique({
      where: { id },
      select: {
        id: true,
        caseNumber: true,
        coordinatorId: true,
        status: true,
        petName: true,
        petSpecies: true,
        lastSeenAddress: true,
      },
    });

    if (!existingCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (['REUNITED', 'CLOSED_OTHER'].includes(existingCase.status)) {
      return NextResponse.json({ error: 'Cannot assign to closed case' }, { status: 400 });
    }

    // Validate coordinator exists and has appropriate role
    let coordinator = null;
    if (coordinatorId) {
      coordinator = await prisma.user.findUnique({
        where: { id: coordinatorId },
        select: { id: true, role: true, firstName: true, lastName: true, email: true },
      });

      if (!coordinator) {
        return NextResponse.json({ error: 'Coordinator not found' }, { status: 400 });
      }

      if (!['ADMIN', 'MODERATOR', 'PATROL'].includes(coordinator.role)) {
        return NextResponse.json(
          { error: 'Coordinator must have PATROL or higher role' },
          { status: 400 }
        );
      }
    }

    const oldCoordinatorId = existingCase.coordinatorId;

    // Update case
    const updatedCase = await prisma.case.update({
      where: { id },
      data: { coordinatorId: coordinatorId || null },
      include: {
        coordinator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    logEvent('case.assignment_changed', {
      caseId: id,
      caseNumber: existingCase.caseNumber,
      field: 'coordinator',
      oldValue: oldCoordinatorId,
      newValue: coordinatorId,
      changedBy: session.user.id,
    });

    // Send notification to new coordinator (non-blocking)
    if (coordinator && coordinatorId !== oldCoordinatorId) {
      sendCoordinatorAssignmentNotification(
        {
          id: existingCase.id,
          caseNumber: existingCase.caseNumber,
          petName: existingCase.petName,
          petSpecies: existingCase.petSpecies,
          lastSeenAddress: existingCase.lastSeenAddress,
        },
        coordinator
      ).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      case: {
        id: updatedCase.id,
        caseNumber: updatedCase.caseNumber,
        coordinatorId: updatedCase.coordinatorId,
        coordinator: updatedCase.coordinator,
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logEvent('case.assign_coordinator_failed', { error: error.message });
    console.error('Assign coordinator error:', error);
    return NextResponse.json({ error: 'Failed to assign coordinator' }, { status: 500 });
  }
}
