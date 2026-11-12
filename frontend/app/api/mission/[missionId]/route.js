/**
 * Mission Control API
 * GET: Get mission state
 * POST: Activate mission, pause it, resume it
 *
 * These are from before the search screen (GET .../picture and .../board
 * are what it reads now) and nothing on the site calls them. They stay for
 * the owner and for staff, and for nobody else:
 *
 * - The state holds the home address with its house number, exact places,
 *   and where each helper is. It used to go to anyone with an account.
 * - Pausing took no check at all and pushed a sentence of the caller's own
 *   to every helper's phone; it and resuming also acted on whatever
 *   mission id the request named, whatever pet the address was for.
 *
 * A role in a Rescue Force is not enough here either, for the reason
 * app/lib/searcher.js gives.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { missionWhere } from '@/app/lib/shareMetadata';
import { getMissionState } from '@/app/lib/missionControl/state';
import { activateMission, pauseMission, resumeMission } from '@/app/lib/missionControl/activation';
import { isStaff } from '@/app/lib/missionControl/guard';
import { onlyText, cut } from '@/app/lib/searchText';
import { withRateLimitAsync, rateLimitResponse } from '@/app/lib/rateLimit';

const CHANGE_LIMIT = { windowMs: 60 * 1000, maxRequests: 10, blockDurationMs: 60 * 1000 };
/** A reason for pausing goes to phones as a notification: a sentence, not a page. */
const REASON_MAX = 200;

/** The pet the address names, for its owner or for staff. { pet } or { refused } (a response). */
async function ownPet(missionId, userId) {
  const pet = await prisma.case.findFirst({ where: missionWhere(missionId), select: { id: true, reporterId: true } });
  if (!pet) return { refused: NextResponse.json({ error: 'Mission not found' }, { status: 404 }) };
  if (pet.reporterId !== userId && !(await isStaff(userId))) {
    return { refused: NextResponse.json({ error: 'Only the owner can do that.', code: 'NOT_ALLOWED' }, { status: 403 }) };
  }
  return { pet };
}

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
    const { pet, refused } = await ownPet(missionId, session.user.id);
    if (refused) return refused;

    // createIfMissing:false - GET must not write on read (no row materialization).
    const state = await getMissionState(pet.id);

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
    const limit = await withRateLimitAsync(request, CHANGE_LIMIT, 'mission:change');
    if (!limit.success) return rateLimitResponse(limit);

    const { missionId } = await params;
    const sent = await request.json().catch(() => null);
    const { action, ...options } = sent && typeof sent === 'object' && !Array.isArray(sent) ? sent : {};
    if (!['ACTIVATE', 'PAUSE', 'RESUME'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    const { pet, refused } = await ownPet(missionId, session.user.id);
    if (refused) return refused;

    let result;
    if (action === 'ACTIVATE') {
      const radius = Number(options.radiusMiles);
      result = await activateMission(pet.id, session.user.id, Number.isFinite(radius) && radius > 0 ? { radiusMiles: Math.min(radius, 25) } : {});
    } else {
      // The mission of the pet the address names. An id in the request is not used.
      const mission = await prisma.missionControl.findUnique({ where: { caseId: pet.id }, select: { id: true } });
      if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
      if (action === 'PAUSE') {
        const reason = cut(onlyText(typeof options.reason === 'string' ? options.reason : '').replace(/\s+/g, ' ').trim(), REASON_MAX);
        result = await pauseMission(mission.id, session.user.id, reason || undefined);
      } else {
        result = await resumeMission(mission.id, session.user.id);
      }
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
