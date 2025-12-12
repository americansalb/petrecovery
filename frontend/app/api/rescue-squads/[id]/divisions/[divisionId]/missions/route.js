/**
 * Division Missions API
 * Get active missions in a division's coverage area
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export async function GET(request, { params }) {
  try {
    const squadId = params.id;
    const { divisionId } = params;

    // Get the division
    const division = await prisma.division.findFirst({
      where: {
        id: divisionId,
        rescueSquadId: squadId,
        isActive: true,
      },
      include: {
        members: {
          where: { isActive: true },
          select: { userId: true }
        }
      }
    });

    if (!division) {
      return NextResponse.json(
        { error: 'Division not found' },
        { status: 404 }
      );
    }

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

    // Get missions - in a real implementation, you'd filter by
    // the division's coverage area using geo-matching
    const missions = await prisma.missionControl.findMany({
      where: {
        missionId: { in: missionIds },
        mode: { in: ['LIVE_SEARCH', 'CONTAINMENT', 'TRAP_OPS'] },
      },
      include: {
        case: {
          select: {
            id: true,
            missionNumber: true,
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
        sightings: {
          where: { verified: true },
          select: { id: true }
        }
      }
    });

    // Format response
    const formattedMissions = missions.map(mission => ({
      id: mission.id,
      missionId: mission.missionId,
      missionNumber: mission.case?.missionNumber,
      mode: mission.mode,
      startedAt: mission.startedAt,
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
      sightings: mission.sightings?.length || 0,
    }));

    return NextResponse.json({ missions: formattedMissions });
  } catch (error) {
    console.error('Error fetching division missions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch missions' },
      { status: 500 }
    );
  }
}
