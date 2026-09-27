/**
 * GET /api/rescue-forces/[id]/needs/options?caseId=
 *
 * What the "Add a need" sheet offers for one of the force's pets
 * (app/lib/needOptions.js): the places the pet has been, the shelters near
 * it, ready-made needs (each saying whether the pet already has it), and
 * the times to choose from. Members of the force only, like adding a need.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { OPEN_NEED_STATUSES } from '@/app/lib/forceNeeds';
import { needOptions } from '@/app/lib/needOptions';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  try {
    const { id } = await params;
    const caseId = new URL(request.url).searchParams.get('caseId');
    const [membership, assignment] = await Promise.all([
      prisma.rescueForceMember.findFirst({ where: { rescueSquadId: id, userId: session.user.id, isActive: true }, select: { id: true } }),
      caseId
        ? prisma.caseAssignment.findFirst({
            where: { rescueSquadId: id, missionId: caseId },
            select: {
              case: {
                select: {
                  id: true,
                  reportType: true,
                  petName: true,
                  petSpecies: true,
                  lastSeenAddress: true,
                  lastSeenLatitude: true,
                  lastSeenLongitude: true,
                },
              },
            },
          })
        : null,
    ]);
    if (!membership) return NextResponse.json({ error: 'Join this Rescue Force to add a need.' }, { status: 403 });
    if (!assignment?.case) return NextResponse.json({ error: 'That pet is not one this Rescue Force is looking for.' }, { status: 404 });

    const open = await prisma.squadTask.findMany({
      where: { rescueSquadId: id, caseId: assignment.case.id, status: { in: OPEN_NEED_STATUSES }, role: { not: 'OWNER' } },
      select: { id: true, title: true, shelterId: true },
    });
    return NextResponse.json(await needOptions(assignment.case, open));
  } catch (error) {
    console.error('Need options failed:', error);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}
