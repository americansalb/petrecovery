/**
 * Public join-info for the zero-friction share link (/join/[missionId]).
 *
 * The full mission-state GET above requires auth because it exposes exact
 * last-seen coordinates and live volunteer GPS. The anonymous join page
 * must render without any of that, so this endpoint returns a fixed
 * whitelist - pet identity, coarse mode, public counters, and the
 * assigned force id for the post-join redirect. Add a field here only if
 * it is safe to show anyone holding the link.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { missionWhere } from '@/app/lib/shareMetadata';

export async function GET(request, { params }) {
  try {
    const mission = await prisma.case.findFirst({
      where: missionWhere(params.missionId),
      select: {
        id: true,
        caseNumber: true,
        petName: true,
        petSpecies: true,
        petBreed: true,
        petColor: true,
        petPhotoUrl: true,
        missionControl: {
          select: {
            id: true,
            mode: true,
            zones: { select: { status: true } },
            activeVolunteers: {
              where: { status: { not: 'OFFLINE' } },
              select: { id: true },
            },
          },
        },
        assignments: {
          where: { status: 'ACTIVE' },
          select: { rescueSquad: { select: { id: true } } },
          take: 1,
        },
      },
    });

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    const mc = mission.missionControl;
    return NextResponse.json({
      mode: mc?.mode || 'INACTIVE',
      pet: {
        name: mission.petName,
        species: mission.petSpecies,
        breed: mission.petBreed,
        color: mission.petColor,
        photoUrl: mission.petPhotoUrl,
      },
      stats: {
        activeVolunteers: mc?.activeVolunteers.length || 0,
        zonesSearched: mc?.zones.filter((z) => z.status === 'SEARCHED').length || 0,
      },
      case: {
        caseNumber: mission.caseNumber,
        assignments: mission.assignments,
      },
    });
  } catch (error) {
    console.error('Error getting join info:', error);
    return NextResponse.json({ error: 'Failed to get join info' }, { status: 500 });
  }
}
