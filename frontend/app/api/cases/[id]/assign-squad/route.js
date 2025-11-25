// /api/cases/[id]/assign-squad/route.js
// Assign a primary squad to a case

import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { requireStaff, PermissionError } from '@/app/lib/permissions';
import { logEvent } from '@/app/lib/logging';
import prisma from '@/app/lib/prisma';

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    requireStaff(session, 'assign squad');

    const { id } = params;
    const body = await request.json();
    const { squadId } = body;

    // Validate case exists
    const existingCase = await prisma.case.findUnique({
      where: { id },
      select: { id: true, caseNumber: true, primarySquadId: true, status: true },
    });

    if (!existingCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (['REUNITED', 'CLOSED_OTHER'].includes(existingCase.status)) {
      return NextResponse.json({ error: 'Cannot assign to closed case' }, { status: 400 });
    }

    // Validate squad exists and is active
    if (squadId) {
      const squad = await prisma.rescueSquad.findUnique({
        where: { id: squadId },
        select: { id: true, name: true, isActive: true },
      });

      if (!squad) {
        return NextResponse.json({ error: 'Squad not found' }, { status: 400 });
      }

      if (!squad.isActive) {
        return NextResponse.json({ error: 'Squad is not active' }, { status: 400 });
      }
    }

    const oldSquadId = existingCase.primarySquadId;

    // Update case
    const updatedCase = await prisma.case.update({
      where: { id },
      data: { primarySquadId: squadId || null },
      include: {
        primarySquad: {
          select: { id: true, name: true, city: true, state: true },
        },
      },
    });

    logEvent('case.assignment_changed', {
      caseId: id,
      caseNumber: existingCase.caseNumber,
      field: 'primarySquad',
      oldValue: oldSquadId,
      newValue: squadId,
      changedBy: session.user.id,
    });

    return NextResponse.json({
      success: true,
      case: {
        id: updatedCase.id,
        caseNumber: updatedCase.caseNumber,
        primarySquadId: updatedCase.primarySquadId,
        primarySquad: updatedCase.primarySquad,
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logEvent('case.assign_squad_failed', { error: error.message });
    console.error('Assign squad error:', error);
    return NextResponse.json({ error: 'Failed to assign squad' }, { status: 500 });
  }
}
