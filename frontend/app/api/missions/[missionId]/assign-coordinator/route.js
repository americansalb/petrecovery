/**
 * Case Coordinator Assignment API
 *
 * POST /api/missions/[id]/assign-coordinator
 *
 * DEPRECATED: The Case model no longer has a coordinatorId field.
 * Coordinator assignment is now handled through Mission Control.
 * Use POST /api/missions/[id]/coordinate to activate Mission Control.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const missionId = params.missionId;

    // Check case exists
    const existingCase = await prisma.case.findUnique({
      where: { id: missionId },
      select: { id: true, caseNumber: true },
    });

    if (!existingCase) {
      return NextResponse.json(
        { error: 'Mission not found', code: 'CASE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Return deprecation notice
    return NextResponse.json({
      error: 'Endpoint deprecated',
      code: 'DEPRECATED',
      message: 'The Case model no longer has a coordinatorId field. Coordinator assignment is now handled through Mission Control. Use POST /api/missions/[id]/coordinate to activate Mission Control for a case.',
      missionNumber: existingCase.caseNumber,
      alternativeEndpoint: `/api/missions/${missionId}/coordinate`,
    }, { status: 410 }); // 410 Gone

  } catch (error) {
    console.error('Error in assign-coordinator:', error);
    return NextResponse.json({
      error: 'Internal error',
      message: error.message
    }, { status: 500 });
  }
}
