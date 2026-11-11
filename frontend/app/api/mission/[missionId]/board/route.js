/**
 * The search board: the streets around where a pet was lost, and who is
 * on them.
 *
 * GET /api/mission/[missionId]/board
 *   Open to anyone holding the pet's link, like the pet's page. It sends
 *   each street and whether it is free, being walked or searched. It
 *   sends streets, not people: who holds a street goes only to the owner
 *   and the forces looking for the pet. `unit` is "street", or "block"
 *   where the map has no named streets (and for the first seconds, until
 *   the streets have been fetched: `streetsStatus` says which).
 *
 * PATCH /api/mission/[missionId]/board
 *   { unit: "street" | "block", id, action: "claim" | "release" | "searched" }
 *   For someone signed in, or a helper who joined from the share link
 *   without an account (app/lib/searcher.js). Claiming and marking
 *   searched take the safety waiver; giving a street back does not.
 *
 * [missionId] is the case id or the case number, as on a share link.
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/app/lib/prisma';
import { missionWhere } from '@/app/lib/shareMetadata';
import { isCaseOpen } from '@/app/lib/caseStatus';
import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { searcherFor } from '@/app/lib/searcher';
import { ensureGrid, ensureStreets, readStreets, readCells, actOnBoard, BOARD_ACTIONS } from '@/app/lib/searchBoard';
import { WAIVER_CODE } from '@/app/lib/waiver';
import { broadcast } from '@/app/lib/sse/missionStream';
import { forcesOf } from '@/app/lib/forceFeed';
import { wakeForces, WAKE_KINDS } from '@/app/lib/wake';
import { logEvent } from '@/lib/logging';

export const dynamic = 'force-dynamic';

/** How long a board read waits for the map server before answering with squares. */
const STREETS_WAIT_MS = 3500;
const BOARD_WRITE_LIMIT = { windowMs: 60 * 1000, maxRequests: 30, blockDurationMs: 60 * 1000 };

const CASE_SELECT = {
  id: true,
  caseNumber: true,
  status: true,
  reportType: true,
  petName: true,
  lastSeenLatitude: true,
  lastSeenLongitude: true,
};

function countsOf(items) {
  return {
    total: items.length,
    searched: items.filter((i) => i.status === 'SEARCHED' || i.status === 'PET_FOUND').length,
    inProgress: items.filter((i) => i.status === 'IN_PROGRESS').length,
  };
}

export async function GET(request, { params }) {
  const limit = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_READ, 'board');
  if (!limit.success) return rateLimitResponse(limit);
  const correlationId = crypto.randomUUID();
  try {
    const pet = await prisma.case.findFirst({ where: missionWhere(params.missionId), select: CASE_SELECT });
    if (!pet) return NextResponse.json({ error: 'This link does not match a pet.' }, { status: 404 });
    const open = isCaseOpen(pet.status);
    if (pet.reportType === 'FOUND' || pet.lastSeenLatitude == null || pet.lastSeenLongitude == null) {
      return NextResponse.json({ caseId: pet.id, open, unit: 'none', streets: [], cells: [], counts: countsOf([]), streetsStatus: null, viewer: null });
    }
    const searcher = await searcherFor(request, pet.id);
    const who = { viewer: searcher?.id || null, withNames: Boolean(searcher?.seesNames) };

    // The streets are fetched once per search. The first reader waits a
    // few seconds for them and otherwise gets the squares now; the fetch
    // carries on and the next read has streets.
    const fetching = ensureStreets(pet.id, { correlationId }).catch(() => 'FAILED');
    let timer;
    const waited = new Promise((resolve) => {
      timer = setTimeout(() => resolve('PENDING'), STREETS_WAIT_MS);
    });
    const streetsStatus = await Promise.race([fetching, waited]);
    clearTimeout(timer);

    const streets = streetsStatus === 'READY' ? await readStreets(pet.id, who) : null;
    let unit = 'street';
    let cells = [];
    if (!streets) {
      unit = 'block';
      await ensureGrid(pet.id, correlationId);
      cells = await readCells(pet.id, who);
    }
    const items = streets || cells;
    const holding = items.find((i) => i.mine) || null;
    // Why the streets are not here yet, when a fetch failed: which map
    // server said what. Nothing private, and without it a failure on the
    // live host cannot be told from the outside.
    const streetsNote =
      streetsStatus === 'FAILED'
        ? (await prisma.searchGrid.findUnique({ where: { caseId: pet.id }, select: { streetsNote: true } }))?.streetsNote || null
        : null;
    return NextResponse.json({
      caseId: pet.id,
      open,
      unit,
      streets: streets || [],
      cells,
      counts: countsOf(items),
      streetsStatus,
      streetsNote,
      viewer: searcher
        ? { kind: searcher.kind, firstName: searcher.firstName, isOwner: searcher.isOwner, waiver: searcher.waiver, seesNames: searcher.seesNames, holding: holding?.id || null }
        : null,
    });
  } catch (error) {
    console.error('Board read failed:', error);
    await logEvent({ event_type: 'board.read_failed', correlation_id: correlationId, resource_type: 'case', action: 'read', result: 'failure', error_message: error?.message }).catch(() => {});
    return NextResponse.json({ error: 'The search map did not load. Try again in a moment.' }, { status: 500 });
  }
}

const WORDS = {
  NOT_FOUND: () => 'That street is not on this search.',
  TAKEN: (title) => `Someone just took ${title}. Pick another nearby.`,
  NOT_YOURS: (title) => `${title} is not yours to give back.`,
  NOT_CLAIMED: (title) => `Take ${title} first, then mark it searched.`,
};
const EVENT = {
  street: { claim: 'STREET_CLAIMED', release: 'STREET_RELEASED', searched: 'STREET_SEARCHED' },
  block: { claim: 'CELL_CLAIMED', release: 'CELL_RELEASED', searched: 'CELL_SEARCHED' },
};

export async function PATCH(request, { params }) {
  const limit = await withRateLimitAsync(request, BOARD_WRITE_LIMIT, 'board:act');
  if (!limit.success) return rateLimitResponse(limit);
  const correlationId = crypto.randomUUID();
  try {
    const body = await request.json().catch(() => ({}));
    const unit = body.unit === 'block' ? 'block' : 'street';
    const { id, action } = body;
    if (!id || !BOARD_ACTIONS.includes(action)) {
      return NextResponse.json({ error: `Send an id and one of: ${BOARD_ACTIONS.join(', ')}.` }, { status: 400 });
    }
    const pet = await prisma.case.findFirst({ where: missionWhere(params.missionId), select: CASE_SELECT });
    if (!pet) return NextResponse.json({ error: 'This link does not match a pet.' }, { status: 404 });
    const searcher = await searcherFor(request, pet.id);
    if (!searcher) return NextResponse.json({ error: 'Join the search first.', code: 'NOT_JOINED' }, { status: 401 });
    if (!isCaseOpen(pet.status) && action !== 'release') {
      return NextResponse.json({ error: 'This search has ended. Thank you for looking.', code: 'CLOSED' }, { status: 409 });
    }
    // Taking a street or marking it searched is going out to search, which
    // takes the safety waiver. Giving one back does not.
    if (action !== 'release' && !searcher.waiver) {
      return NextResponse.json({ error: 'Accept the safety waiver before you search.', code: WAIVER_CODE }, { status: 403 });
    }

    const result = await actOnBoard({ caseId: pet.id, unit, id: String(id), action, searcher });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : 409;
      return NextResponse.json({ error: WORDS[result.error](result.title || 'That street'), code: result.error }, { status });
    }

    // Everyone with the board open sees it change. Ids and states only:
    // who holds a street is not for everyone, so readers that may know ask.
    try {
      broadcast(pet.id, { type: EVENT[unit][action], unit, item: { id: result.item.id, status: result.item.status } });
    } catch (error) {
      console.warn('Board broadcast failed:', error?.message);
    }

    if (action === 'release') {
      // A freed street next to the trail is worth waking the members on duty for.
      forcesOf(pet.id)
        .then(async (forceIds) => {
          if (!forceIds.length) return;
          await wakeForces({
            forceIds,
            exceptUserId: searcher.userId,
            kind: WAKE_KINDS.BLOCK_FREE,
            title: `${result.title} is free again`,
            body: `Nobody is walking it for ${pet.petName || 'the pet'}. Take it if you are near.`,
            url: `/mission-control?mission=${encodeURIComponent(pet.caseNumber || pet.id)}`,
            data: { caseId: pet.id, unit, id: result.item.id },
          });
        })
        .catch((error) => console.warn('Board wake failed:', error?.message));
    }

    await logEvent({
      event_type: `board.${unit}_${action}`,
      correlation_id: correlationId,
      actor_user_id: searcher.userId,
      resource_type: unit === 'street' ? 'search_street' : 'grid_cell',
      resource_id: result.item.id,
      action: 'update',
      result: 'success',
      metadata: { title: result.title, status: result.item.status, volunteer: searcher.kind === 'volunteer' },
    }).catch(() => {});

    return NextResponse.json({ success: true, unit, item: result.item });
  } catch (error) {
    console.error('Board action failed:', error);
    return NextResponse.json({ error: 'That did not go through. Try again in a moment.' }, { status: 500 });
  }
}
