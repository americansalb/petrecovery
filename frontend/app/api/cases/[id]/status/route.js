// /api/cases/[id]/status/route.js
// Update case status

import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { requireStaff, PermissionError } from '@/app/lib/permissions';
import { logEvent } from '@/app/lib/logging';
import { sendCaseStatusUpdate } from '@/app/lib/notifications';
import prisma from '@/app/lib/prisma';

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    requireStaff(session, 'update case status');

    const { id } = params;
    const body = await request.json();
    const { status } = body;

    const validStatuses = ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED', 'REUNITED', 'CLOSED_OTHER'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const existingCase = await prisma.case.findUnique({
      where: { id },
      select: {
        id: true,
        caseNumber: true,
        status: true,
        ownerEmail: true,
        ownerName: true,
        petName: true,
      },
    });

    if (!existingCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const oldStatus = existingCase.status;

    const updatedCase = await prisma.case.update({
      where: { id },
      data: {
        status,
        resolvedAt: ['REUNITED', 'CLOSED_OTHER'].includes(status) ? new Date() : null,
      },
    });

    logEvent('case.status_changed', {
      caseId: id,
      caseNumber: existingCase.caseNumber,
      oldStatus,
      newStatus: status,
      changedBy: session.user.id,
    });

    // Send notification if status changed (non-blocking)
    if (oldStatus !== status) {
      sendCaseStatusUpdate(
        {
          caseNumber: existingCase.caseNumber,
          petName: existingCase.petName,
          ownerName: existingCase.ownerName,
          ownerEmail: existingCase.ownerEmail,
        },
        oldStatus,
        status
      ).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      case: {
        id: updatedCase.id,
        caseNumber: updatedCase.caseNumber,
        status: updatedCase.status,
        oldStatus,
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logEvent('case.status_change_failed', { error: error.message });
    console.error('Status change error:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
