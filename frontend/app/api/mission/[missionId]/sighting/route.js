/**
 * Sighting Response API
 * POST: Report sighting, verify, stand down
 * GET: Get sightings for mission
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import {
  reportSighting,
  confirmPerimeterPosition,
  verifySighting,
  standDownContainment,
  handleConflictingSightings,
} from '@/app/lib/missionControl/sightingResponse';
import { ensureMissionControl } from '@/app/lib/missionControl/ensure';

export async function GET(request, { params }) {
  try {
    const { missionId } = params;
    const { searchParams } = new URL(request.url);
    const verifiedOnly = searchParams.get('verified') === 'true';

    const mission = await prisma.missionControl.findUnique({
      where: { caseId: missionId },
      select: { id: true }
    });

    if (!mission) {
      return NextResponse.json(
        { error: 'Mission not found' },
        { status: 404 }
      );
    }

    const sightings = await prisma.missionSighting.findMany({
      where: {
        missionId: mission.id,
        ...(verifiedOnly ? { verified: true } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Check for conflicts
    const conflicts = await handleConflictingSightings(mission.id);

    return NextResponse.json({
      sightings: sightings.map(s => ({
        id: s.id,
        time: s.createdAt,
        location: { lat: s.latitude, lng: s.longitude },
        priority: s.priority,
        confidence: s.confidence,
        verified: s.verified,
        status: s.status,
        photoUrl: s.photoUrl,
        notes: s.notes,
        reporter: s.reporterName,
      })),
      conflicts,
    });
  } catch (error) {
    console.error('Error getting sightings:', error);
    return NextResponse.json(
      { error: 'Failed to get sightings' },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { missionId } = params;
    const body = await request.json();
    const { action, volunteerId, ...data } = body;

    // Find-or-create: an open case accepts sightings even if nobody has
    // opened its Mission Control board yet.
    const mission = await ensureMissionControl(missionId);

    if (!mission) {
      return NextResponse.json(
        { error: 'Mission not found' },
        { status: 404 }
      );
    }

    let result;

    switch (action) {
      case 'REPORT':
        if (!volunteerId) {
          return NextResponse.json(
            { error: 'Volunteer ID required' },
            { status: 400 }
          );
        }
        result = await reportSighting(volunteerId, {
          location: data.location,
          confidence: data.confidence,
          photoUrl: data.photoUrl,
          notes: data.notes,
          direction: data.direction,
        });
        break;

      case 'CONFIRM_PERIMETER':
        result = await confirmPerimeterPosition(volunteerId);
        break;

      case 'VERIFY':
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
          return NextResponse.json(
            { error: 'Authentication required for verification' },
            { status: 401 }
          );
        }
        result = await verifySighting(data.sightingId, data.verified, session.user.id);
        break;

      case 'STAND_DOWN':
        result = await standDownContainment(mission.id, data.reason);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error with sighting action:', error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}
