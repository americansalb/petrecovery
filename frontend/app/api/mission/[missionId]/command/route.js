/**
 * Command Center API (Leaders only)
 * GET: Get command view
 * POST: Broadcasts, zone assignments, resources, traps
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import {
  getCommandView,
  updateStaleZones,
  assignZone,
  sendBroadcast,
  requestResource,
  switchToTrapOps,
  addTrap,
  checkTrap,
  getShiftSummary,
} from '@/app/lib/missionControl/commandCenter';
import { resolvePetFound, resolvePetDeceased, pauseToColdCase } from '@/app/lib/missionControl/endStates';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { missionId } = params;
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');

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

    // TODO: Verify user is a leader

    if (view === 'shift-summary') {
      const summary = await getShiftSummary(mission.id);
      return NextResponse.json(summary);
    }

    const commandView = await getCommandView(mission.id, session.user.id);
    return NextResponse.json(commandView);
  } catch (error) {
    console.error('Error getting command view:', error);
    return NextResponse.json(
      { error: 'Failed to get command view' },
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
    const { action, ...data } = body;

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

    // TODO: Verify user is a leader

    let result;

    switch (action) {
      case 'BROADCAST':
        result = await sendBroadcast(
          mission.id,
          data.message,
          data.type,
          session.user.id
        );
        break;

      case 'ASSIGN_ZONE':
        result = await assignZone(
          mission.id,
          data.zoneId,
          data.volunteerId,
          session.user.id
        );
        break;

      case 'REQUEST_RESOURCE':
        result = await requestResource(
          mission.id,
          data.resourceType,
          data.location,
          session.user.id
        );
        break;

      case 'UPDATE_STALE':
        result = await updateStaleZones(mission.id);
        break;

      case 'SWITCH_TRAP_OPS':
        result = await switchToTrapOps(mission.id, session.user.id);
        break;

      case 'ADD_TRAP':
        result = await addTrap(mission.id, data, session.user.id);
        break;

      case 'CHECK_TRAP':
        result = await checkTrap(data.trapId, data, session.user.id);
        break;

      // End states
      case 'RESOLVE_FOUND':
        result = await resolvePetFound(mission.id, data, session.user.id);
        break;

      case 'RESOLVE_DECEASED':
        result = await resolvePetDeceased(mission.id, data, session.user.id);
        break;

      case 'COLD_CASE':
        result = await pauseToColdCase(mission.id, data, session.user.id);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error with command action:', error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}
