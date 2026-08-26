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
import { ensureMissionControl } from '@/app/lib/missionControl/ensure';

export async function GET(request, { params }) {
  try {
    const mission = await prisma.case.findFirst({
      where: missionWhere(params.missionId),
      select: {
        id: true,
        status: true,
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

    // A wizard-created case has no MissionControl row, but an open case is
    // a live search: create the row now rather than telling the volunteer
    // the search ended (the old fallback did exactly that).
    let mc = mission.missionControl;
    if (!mc) {
      const created = await ensureMissionControl(mission.id);
      if (created) mc = { ...created, zones: [], activeVolunteers: [] };
    }
    const mode =
      mc?.mode || (mission.status === 'REUNITED' ? 'RESOLVED' : 'CLOSED');

    return NextResponse.json({
      mode,
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
