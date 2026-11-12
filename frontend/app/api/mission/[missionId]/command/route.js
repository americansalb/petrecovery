/**
 * Command Center API (the older one)
 * GET: Get command view
 * POST: Broadcasts, zone assignments, resources, traps, and the end of a search
 *
 * Nothing on the site calls it: the owner runs a search from the desk
 * (app/mission-control/desktop/Command.js) through .../board and
 * .../message. It stays for the owner and for staff, and nobody else.
 *
 * It used to trust a command role in a Rescue Force assigned to the pet.
 * A force with no leader gives that role to any member who asks, and
 * anyone can found a force (app/lib/searcher.js says how), so a stranger
 * could reach it in two taps: read where every helper is, push a sentence
 * of their own to every helper's phone, and end someone's search.
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
import { ownsPet, isStaff } from '@/app/lib/missionControl/guard';
import { onlyText, cut } from '@/app/lib/searchText';
import { withRateLimitAsync, rateLimitResponse } from '@/app/lib/rateLimit';

const COMMAND_LIMIT = { windowMs: 60 * 1000, maxRequests: 20, blockDurationMs: 60 * 1000 };
/** A broadcast goes to phones as a notification: a few sentences, and only text. */
const BROADCAST_MAX = 300;
const ACTIONS = ['BROADCAST', 'ASSIGN_ZONE', 'REQUEST_RESOURCE', 'UPDATE_STALE', 'SWITCH_TRAP_OPS', 'ADD_TRAP', 'CHECK_TRAP', 'RESOLVE_FOUND', 'RESOLVE_DECEASED', 'COLD_CASE'];

/** The owner of the pet the address names, or staff. */
const runsIt = async (userId, caseId) => (await ownsPet(userId, caseId)) || (await isStaff(userId));

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { missionId } = await params;
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

    // Where every helper is, and their rows' ids: the owner's, and staff's.
    if (!(await runsIt(session.user.id, missionId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    const limit = await withRateLimitAsync(request, COMMAND_LIMIT, 'mission:command');
    if (!limit.success) return rateLimitResponse(limit);

    const { missionId } = await params;
    const sent = await request.json().catch(() => null);
    const { action, ...data } = sent && typeof sent === 'object' && !Array.isArray(sent) ? sent : {};
    if (!ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

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

    // Broadcasts, zones, traps and the end of a search: the owner's, and staff's.
    if (!(await runsIt(session.user.id, missionId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let result;

    switch (action) {
      case 'BROADCAST': {
        const message = cut(onlyText(typeof data.message === 'string' ? data.message : '').replace(/\s+/g, ' ').trim(), BROADCAST_MAX);
        if (!message) return NextResponse.json({ error: 'Write something first.' }, { status: 400 });
        result = await sendBroadcast(
          mission.id,
          message,
          typeof data.type === 'string' ? data.type.slice(0, 40) : undefined,
          session.user.id
        );
        break;
      }

      case 'ASSIGN_ZONE': {
        // A zone and a helper of this pet's own search: ids from another search are not on it.
        const [zone, helper] = await Promise.all([
          typeof data.zoneId === 'string' ? prisma.missionZone.findFirst({ where: { id: data.zoneId, missionId: mission.id }, select: { id: true } }) : null,
          typeof data.volunteerId === 'string' ? prisma.missionVolunteer.findFirst({ where: { id: data.volunteerId, missionId: mission.id }, select: { id: true } }) : null,
        ]);
        if (!zone || !helper) return NextResponse.json({ error: 'That is not on this search.' }, { status: 404 });
        result = await assignZone(
          mission.id,
          zone.id,
          helper.id,
          session.user.id
        );
        break;
      }

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

      case 'CHECK_TRAP': {
        const trap = typeof data.trapId === 'string' ? await prisma.missionTrap.findFirst({ where: { id: data.trapId, missionId: mission.id }, select: { id: true } }) : null;
        if (!trap) return NextResponse.json({ error: 'That is not on this search.' }, { status: 404 });
        result = await checkTrap(trap.id, data, session.user.id);
        break;
      }

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
