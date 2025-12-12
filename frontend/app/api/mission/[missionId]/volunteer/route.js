/**
 * Volunteer Operations API
 * POST: Quick join (zero-friction)
 * PATCH: Update location, status, resources
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import {
  quickJoin,
  updateLocation,
  flagResources,
  sendSignal,
  checkIn,
  checkOut,
} from '@/app/lib/missionControl/volunteerOps';

export async function POST(request, { params }) {
  try {
    const { missionId } = params;
    const body = await request.json();
    const { action, deviceId, location, name, ...data } = body;

    // Get mission ID from case
    const mission = await prisma.missionControl.findUnique({
      where: { missionId },
      select: { id: true, mode: true }
    });

    if (!mission) {
      return NextResponse.json(
        { error: 'No active mission for this case' },
        { status: 404 }
      );
    }

    // Check for authenticated user (optional)
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    let result;

    switch (action) {
      case 'JOIN':
        result = await quickJoin(mission.id, {
          deviceId,
          location,
          name,
          userId,
        });
        break;

      case 'CHECK_IN':
        result = await checkIn(data.volunteerId, data.estimatedMinutes);
        break;

      case 'CHECK_OUT':
        result = await checkOut(data.volunteerId);
        break;

      case 'SIGNAL':
        result = await sendSignal(data.volunteerId, data.signalType, location);
        break;

      case 'FLAG_RESOURCES':
        result = await flagResources(data.volunteerId, data.resources);
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
    console.error('Error with volunteer action:', error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const body = await request.json();
    const { volunteerId, location } = body;

    if (!volunteerId || !location) {
      return NextResponse.json(
        { error: 'Missing volunteerId or location' },
        { status: 400 }
      );
    }

    const result = await updateLocation(volunteerId, location);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating volunteer location:', error);
    return NextResponse.json(
      { error: 'Failed to update location' },
      { status: 500 }
    );
  }
}
