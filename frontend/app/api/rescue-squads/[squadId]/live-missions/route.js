/**
 * Live Missions API for Rescue Squads
 * Returns all active Mission Control operations for a squad's cases
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export async function GET(request, { params }) {
  try {
    const { squadId } = params;

    // Get all active case assignments for this squad
    const assignments = await prisma.caseAssignment.findMany({
      where: {
        rescueSquadId: squadId,
        status: { in: ['ACCEPTED', 'ACTIVE'] },
      },
      select: {
        caseId: true,
        case: {
          select: {
            id: true,
            caseNumber: true,
            petName: true,
            petPhotoUrl: true,
            petSpecies: true,
            petBreed: true,
            petColor: true,
            lastSeenAt: true,
            lastSeenAddress: true,
          },
        },
      },
    });

    if (assignments.length === 0) {
      return NextResponse.json({ missions: [] });
    }

    // Get case IDs
    const caseIds = assignments.map(a => a.caseId);

    // Get active missions for these cases
    const missions = await prisma.missionControl.findMany({
      where: {
        caseId: { in: caseIds },
        mode: { in: ['LIVE_SEARCH', 'CONTAINMENT', 'TRAP_OPS'] },
      },
      select: {
        id: true,
        caseId: true,
        mode: true,
        startedAt: true,
        zones: {
          select: {
            id: true,
            status: true,
          },
        },
        volunteers: {
          where: {
            status: 'ACTIVE',
          },
          select: {
            id: true,
          },
        },
        sightings: {
          where: {
            verified: true,
          },
          select: {
            id: true,
          },
        },
      },
    });

    // Build response with mission details
    const liveMissions = missions.map(mission => {
      const assignment = assignments.find(a => a.caseId === mission.caseId);
      const zones = mission.zones || [];
      const searchedZones = zones.filter(z => z.status === 'SEARCHED').length;

      return {
        id: mission.id,
        caseId: mission.caseId,
        caseNumber: assignment?.case?.caseNumber,
        mode: mission.mode,
        startedAt: mission.startedAt,
        pet: {
          name: assignment?.case?.petName,
          photoUrl: assignment?.case?.petPhotoUrl,
          species: assignment?.case?.petSpecies,
          breed: assignment?.case?.petBreed,
          color: assignment?.case?.petColor,
        },
        lastSeen: {
          at: assignment?.case?.lastSeenAt,
          address: assignment?.case?.lastSeenAddress,
        },
        activeVolunteers: mission.volunteers?.length || 0,
        totalZones: zones.length,
        zonesSearched: searchedZones,
        sightings: mission.sightings?.length || 0,
      };
    });

    // Sort by mode priority (containment first, then by active volunteers)
    liveMissions.sort((a, b) => {
      if (a.mode === 'CONTAINMENT' && b.mode !== 'CONTAINMENT') return -1;
      if (b.mode === 'CONTAINMENT' && a.mode !== 'CONTAINMENT') return 1;
      return (b.activeVolunteers || 0) - (a.activeVolunteers || 0);
    });

    return NextResponse.json({ missions: liveMissions });
  } catch (error) {
    console.error('Error fetching live missions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live missions' },
      { status: 500 }
    );
  }
}
