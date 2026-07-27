/**
 * Mission Control API
 * GET: Get mission state
 * POST: Activate mission
 * PATCH: Update mission mode
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { getMissionState } from '@/app/lib/missionControl/state';
import { activateMission, pauseMission, resumeMission } from '@/app/lib/missionControl/activation';

export async function GET(request, { params }) {
  try {
    // Require auth: mission state exposes exact last-seen coords + live
    // volunteer GPS, so it must not be readable by anonymous callers.
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { missionId } = params;

    // createIfMissing:false - GET must not write on read (no row materialization).
    const state = await getMissionState(missionId);

    if (!state) {
      return NextResponse.json(
        { error: 'Mission not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(state);
  } catch (error) {
    console.error('Error getting mission state:', error);
    return NextResponse.json(
      { error: 'Failed to get mission state' },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { missionId } = params;
    const body = await request.json();
    const { action, ...options } = body;

    let result;

    switch (action) {
      case 'ACTIVATE':
        result = await activateMission(missionId, session.user.id, options);
        break;

      case 'PAUSE':
        result = await pauseMission(options.missionId, session.user.id, options.reason);
        break;

      case 'RESUME':
        result = await resumeMission(options.missionId, session.user.id);
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
    console.error('Error with mission action:', error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}
