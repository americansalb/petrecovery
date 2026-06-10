/**
 * Live Missions API for Rescue Forces
 * Returns active Mission Control operations for squad's cases
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export async function GET(request, { params }) {
  try {
    const squadId = params.id;

    // Get active case assignments for this squad
    const assignments = await prisma.caseAssignment.findMany({
      where: {
        rescueSquadId: squadId,
        status: { in: ['ACCEPTED', 'ACTIVE'] },
      },
      select: { missionId: true }
    });

    if (assignments.length === 0) {
      return NextResponse.json({ missions: [] });
    }

    const missionIds = assignments.map(a => a.missionId);

    // Get active missions for these cases
    const missions = await prisma.missionControl.findMany({
      where: {
        caseId: { in: missionIds },
        mode: { in: ['LIVE_SEARCH', 'CONTAINMENT', 'TRAP_OPS'] },
      },
      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            petName: true,
            petPhotoUrl: true,
            petSpecies: true,
            lastSeenAddress: true,
            lastSeenLatitude: true,
            lastSeenLongitude: true,
          }
        },
        volunteers: {
          where: { status: 'ACTIVE' },
          select: { id: true }
        },
        zones: {
          select: {
            id: true,
            status: true
          }
        },
        sightings: {
          where: { verified: true },
          select: { id: true }
        }
      },
      orderBy: [
        { mode: 'asc' }, // CONTAINMENT first (most urgent)
        { activatedAt: 'desc' }
      ]
    });

    // Format response
    const formattedMissions = missions.map(mission => ({
      id: mission.id,
      missionId: mission.missionId,
      missionNumber: mission.case?.caseNumber,
      mode: mission.mode,
      startedAt: mission.activatedAt,
      pet: {
        name: mission.case?.petName,
        photoUrl: mission.case?.petPhotoUrl,
        species: mission.case?.petSpecies,
      },
      lastSeen: {
        address: mission.case?.lastSeenAddress,
        lat: mission.case?.lastSeenLatitude,
        lng: mission.case?.lastSeenLongitude,
      },
      activeVolunteers: mission.volunteers?.length || 0,
      totalZones: mission.zones?.length || 0,
      zonesSearched: mission.zones?.filter(z => z.status === 'SEARCHED').length || 0,
      sightings: mission.sightings?.length || 0,
    }));

    return NextResponse.json({ missions: formattedMissions });
  } catch (error) {
    console.error('Error fetching live missions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live missions' },
      { status: 500 }
    );
  }
}
