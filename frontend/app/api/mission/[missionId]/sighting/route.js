/**
 * Sighting Response API (the older one)
 * POST: Report sighting, verify, stand down
 * GET: Get sightings for mission
 *
 * A sighting on the search screen goes through
 * /api/public/missions/[id]/sighting and is read through .../picture. This
 * route is from before that, and nothing on the site calls it. It stays,
 * held to who each thing belongs to:
 *
 * - The list carries exact places, what the reporter wrote and the
 *   reporter's name. It went to anyone. It is for the owner and the forces
 *   looking for the pet, as names are everywhere else.
 * - Reporting and taking a perimeter place are what a helper does as
 *   themselves: the helper the request proves, never an id it names. A
 *   report is recorded and starts no containment (see `sureness`).
 * - Verifying a sighting and standing a containment down change the search
 *   for everyone and push to every helper's phone. Standing down took no
 *   sign-in at all and sent whatever reason it was given. Both are the
 *   owner's (and staff's), on a sighting of this pet's own.
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
import { ownVolunteerId, ownsPet, isStaff, cleanPlace } from '@/app/lib/missionControl/guard';
import { searcherFor } from '@/app/lib/searcher';
import { onlyText, cut } from '@/app/lib/searchText';
import { withRateLimitAsync, rateLimitResponse, RateLimitPresets } from '@/app/lib/rateLimit';
import { missionWhere } from '@/app/lib/shareMetadata';

const WRITE_LIMIT = { windowMs: 60 * 1000, maxRequests: 12, blockDurationMs: 60 * 1000 };
const NOTES_MAX = 500;
const REASON_MAX = 200;
/**
 * How sure a report through this route may say it is. The library starts a
 * containment on CONFIRMED or HIGH: it pushes "stop moving" to every
 * helper's phone and moves them to a perimeter. The search no longer tells
 * a helper to stop (founder, 2026-11-11), and joining takes no account, so
 * someone who joined a minute ago could have started one. A report here is
 * recorded, at MEDIUM at most, and starts nothing on anyone's phone.
 */
const sureness = (value) => (value === 'LOW' ? 'LOW' : ['MEDIUM', 'HIGH', 'CONFIRMED'].includes(value) ? 'MEDIUM' : undefined);
const line = (value, max) => cut(onlyText(typeof value === 'string' ? value : '').replace(/\s+/g, ' ').trim(), max);

export async function GET(request, { params }) {
  try {
    const limit = await withRateLimitAsync(request, RateLimitPresets.SEARCH_READ, 'mission:sightings');
    if (!limit.success) return rateLimitResponse(limit);
    const { missionId } = await params;
    const { searchParams } = new URL(request.url);
    const verifiedOnly = searchParams.get('verified') === 'true';

    const caseRow = await prisma.case.findFirst({ where: missionWhere(missionId), select: { id: true } });
    if (!caseRow) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    // Exact places, what was written and who wrote it: for the owner and the forces looking, as names are.
    const searcher = await searcherFor(request, caseRow.id);
    if (!searcher?.seesNames) {
      return NextResponse.json({ error: 'Only the owner and the forces looking for this pet can see this.', code: 'NOT_ALLOWED' }, { status: searcher ? 403 : 401 });
    }

    const mission = await prisma.missionControl.findUnique({
      where: { caseId: caseRow.id },
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
    const limit = await withRateLimitAsync(request, WRITE_LIMIT, 'mission:sighting');
    if (!limit.success) return rateLimitResponse(limit);
    const { missionId } = await params;
    const sent = await request.json().catch(() => null);
    const { action, ...data } = sent && typeof sent === 'object' && !Array.isArray(sent) ? sent : {};
    if (!['REPORT', 'CONFIRM_PERIMETER', 'VERIFY', 'STAND_DOWN'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Resolve id-or-caseNumber, then find-or-create: an open case accepts
    // sightings even if nobody has opened its Mission Control board yet.
    const caseRow = await prisma.case.findFirst({
      where: missionWhere(missionId),
      select: { id: true },
    });
    const mission = caseRow ? await ensureMissionControl(caseRow.id) : null;

    if (!mission) {
      return NextResponse.json(
        { error: 'Mission not found' },
        { status: 404 }
      );
    }

    let result;

    if (action === 'REPORT' || action === 'CONFIRM_PERIMETER') {
      // What a helper does as themselves: the helper this request proves, on this pet's search.
      const volunteerId = await ownVolunteerId(request, caseRow.id);
      if (!volunteerId) return NextResponse.json({ error: 'Join the search first.', code: 'NOT_JOINED' }, { status: 401 });
      if (action === 'REPORT') {
        const location = cleanPlace(data.location);
        if (!location) return NextResponse.json({ error: 'Where was it? A place is needed.' }, { status: 400 });
        result = await reportSighting(volunteerId, {
          location,
          confidence: sureness(data.confidence),
          photoUrl: typeof data.photoUrl === 'string' && /^https:\/\//.test(data.photoUrl) ? data.photoUrl.slice(0, 500) : undefined,
          notes: line(data.notes, NOTES_MAX) || undefined,
          direction: line(data.direction, 40) || undefined,
        });
      } else {
        result = await confirmPerimeterPosition(volunteerId);
      }
    } else {
      // These change the search for everyone and push to every helper's phone: the owner's, and staff's.
      const session = await getServerSession(authOptions);
      const userId = session?.user?.id;
      if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      if (!(await ownsPet(userId, caseRow.id)) && !(await isStaff(userId))) {
        return NextResponse.json({ error: 'Only the owner can do that.', code: 'NOT_ALLOWED' }, { status: 403 });
      }
      if (action === 'VERIFY') {
        // A sighting of this pet's own: an id from another search is not one.
        const own = typeof data.sightingId === 'string' ? await prisma.missionSighting.findFirst({ where: { id: data.sightingId, missionId: mission.id }, select: { id: true } }) : null;
        if (!own) return NextResponse.json({ error: 'That sighting is not on this search.' }, { status: 404 });
        result = await verifySighting(own.id, data.verified === true, userId);
      } else {
        result = await standDownContainment(mission.id, line(data.reason, REASON_MAX) || undefined);
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
    console.error('Error with sighting action:', error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}
