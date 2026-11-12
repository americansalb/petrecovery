/**
 * Volunteer Operations API
 * POST: Quick join (zero-friction)
 * PATCH: Update location, status, resources
 *
 * Joining is open to anyone with the pet's link. Everything else here is
 * something a helper does as themselves (check in, check out, a signal,
 * what they carry, where they are), so it takes the helper the request
 * proves: the volunteer headers, or the signed-in person's own row on this
 * search (app/lib/missionControl/guard.js). An id written in the request is
 * not taken on trust: these actions used to act on whatever id they were
 * sent, for any pet.
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
import { ensureMissionControl } from '@/app/lib/missionControl/ensure';
import { ownVolunteerId, cleanPlace } from '@/app/lib/missionControl/guard';
import { missionWhere } from '@/app/lib/shareMetadata';
import { withRateLimitAsync } from '@/app/lib/rateLimit';

/**
 * Joining a search takes no account, so each join makes a new helper for
 * nothing. Everyone a search has joined is listed on its owner's desk and
 * can write to them (app/lib/searchTeam.js, app/lib/searchTalk.js), so one
 * connection may not make helpers without end. Thirty in ten minutes is
 * more than a whole search party joining from one house.
 */
const JOIN_LIMIT = { windowMs: 10 * 60 * 1000, maxRequests: 30, blockDurationMs: 10 * 60 * 1000 };
/** What a helper does as themselves, per connection. A signal reaches other people's phones, so it has its own, smaller count. */
const HELPER_LIMIT = { windowMs: 60 * 1000, maxRequests: 30, blockDurationMs: 60 * 1000 };
const SIGNAL_LIMIT = { windowMs: 10 * 60 * 1000, maxRequests: 6, blockDurationMs: 10 * 60 * 1000 };
/** A phone reporting where it is, every few seconds while it is open. */
const PLACE_LIMIT = { windowMs: 60 * 1000, maxRequests: 60, blockDurationMs: 30 * 1000 };

const SIGNALS = ['NEED_BACKUP', 'AREA_CLEAR', 'TAKING_BREAK', 'HEADING_HOME'];
const RESOURCES = ['CAR', 'TRAP', 'FLYERS', 'TREATS', 'CARRIER'];
const SLOW_DOWN = { error: 'That is a lot at once. Try again in a moment.' };
const NOT_JOINED = { error: 'Join the search first.', code: 'NOT_JOINED' };

export async function POST(request, { params }) {
  try {
    const { missionId } = await params;
    const sent = await request.json().catch(() => null);
    const body = sent && typeof sent === 'object' && !Array.isArray(sent) ? sent : {};
    const { action, deviceId, location, name, ...data } = body;

    if (action === 'JOIN') {
      const limit = await withRateLimitAsync(request, JOIN_LIMIT, 'search:join');
      if (!limit.success) {
        return NextResponse.json({ error: 'A lot of people have joined from this connection in the last few minutes. Try again in a little while.' }, { status: 429 });
      }
    }

    // Share links carry either the case id or the case number; resolve
    // first, then find-or-create the MissionControl row - an open case is
    // joinable even if nobody has opened its board yet.
    const caseRow = await prisma.case.findFirst({
      where: missionWhere(missionId),
      select: { id: true },
    });
    if (!caseRow) {
      return NextResponse.json(
        { error: 'No search matches this link' },
        { status: 404 }
      );
    }

    const mission = await ensureMissionControl(caseRow.id);
    if (!mission) {
      return NextResponse.json(
        { error: 'This search is no longer active' },
        { status: 404 }
      );
    }

    // Check for authenticated user (optional)
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    let result;

    if (action === 'JOIN') {
      result = await quickJoin(mission.id, {
        deviceId,
        location,
        name,
        userId,
        waiverAccepted: data?.waiverAccepted ?? body?.waiverAccepted,
        waiverVersion: data?.waiverVersion ?? body?.waiverVersion,
      });
    } else if (['CHECK_IN', 'CHECK_OUT', 'SIGNAL', 'FLAG_RESOURCES'].includes(action)) {
      const limit = await withRateLimitAsync(request, action === 'SIGNAL' ? SIGNAL_LIMIT : HELPER_LIMIT, action === 'SIGNAL' ? 'search:signal' : 'search:helper');
      if (!limit.success) return NextResponse.json(SLOW_DOWN, { status: 429 });
      // The helper this request proves, on this pet's search. Whatever id the request names is not used.
      const volunteerId = await ownVolunteerId(request, caseRow.id);
      if (!volunteerId) return NextResponse.json(NOT_JOINED, { status: 401 });

      if (action === 'CHECK_IN') {
        const minutes = Number(data.estimatedMinutes);
        result = await checkIn(volunteerId, Number.isFinite(minutes) && minutes > 0 ? Math.min(Math.round(minutes), 24 * 60) : undefined);
      } else if (action === 'CHECK_OUT') {
        result = await checkOut(volunteerId);
      } else if (action === 'SIGNAL') {
        if (!SIGNALS.includes(data.signalType)) return NextResponse.json({ error: 'Invalid signal' }, { status: 400 });
        result = await sendSignal(volunteerId, data.signalType, cleanPlace(location));
      } else {
        const resources = Array.isArray(data.resources) ? [...new Set(data.resources.filter((r) => RESOURCES.includes(r)))] : [];
        result = await flagResources(volunteerId, resources);
      }
    } else {
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
    const limit = await withRateLimitAsync(request, PLACE_LIMIT, 'search:place');
    if (!limit.success) return NextResponse.json(SLOW_DOWN, { status: 429 });
    const { missionId } = await params;
    const sent = await request.json().catch(() => null);
    const location = cleanPlace(sent && typeof sent === 'object' ? sent.location : null);
    if (!location) {
      return NextResponse.json(
        { error: 'Missing location' },
        { status: 400 }
      );
    }

    const caseRow = await prisma.case.findFirst({ where: missionWhere(missionId), select: { id: true } });
    if (!caseRow) return NextResponse.json({ error: 'No search matches this link' }, { status: 404 });
    // A helper moves only themselves: the one this request proves, on this pet's search.
    const volunteerId = await ownVolunteerId(request, caseRow.id);
    if (!volunteerId) return NextResponse.json(NOT_JOINED, { status: 401 });

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
