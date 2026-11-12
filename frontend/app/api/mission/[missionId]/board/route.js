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
 *   { unit, id, action: "first" | "normal" | "walked" | "again" }
 *   Steering, from Mission Control on a desk: send the next helpers to a
 *   street first, take that back, put a street down as walked for someone
 *   who walked it without the site, or ask for another look. For whoever
 *   runs the search (`searcher.leads`: the owner, and app/lib/searcher.js
 *   says why nobody else); 403 for anyone else. No waiver, since none of
 *   it is going out to search.
 *
 *   { unit: "street", id, action: "ask", person, note? }
 *   { action: "unask", person }
 *   The same person asks one named helper to walk a street, or takes that
 *   back (app/lib/searchAsk.js). `person` is a handle from the roster
 *   this route sends them (`people`), never an id.
 *
 *   { action: "cannot" }
 *   The person asked says they cannot. The street goes back to the search.
 *
 * GET also carries `people`, the roster of the search, for the owner and
 * the forces looking for the pet (app/lib/searchTeam.js), and nobody else.
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
import { ensureGrid, ensureStreets, readStreets, readStreetsAround, readCells, actOnBoard, streetForBoard, BOARD_ACTIONS, STEER_ACTIONS } from '@/app/lib/searchBoard';
import { askStreet, unaskPerson, cannotWalk, markAskSeen } from '@/app/lib/searchAsk';
import { teamOf, personByHandle, forDesk } from '@/app/lib/searchTeam';
import { isPushConfigured, sendPushToUser } from '@/app/lib/push';
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
  reporterId: true,
  lastSeenLatitude: true,
  lastSeenLongitude: true,
};

/** What is said to the people the desk's own actions concern. */
const ASK_ACTIONS = ['ask', 'unask', 'cannot'];
const ASK_NOTICE = 'SEARCH_ASK';

function countsOf(items) {
  return {
    total: items.length,
    searched: items.filter((i) => i.status === 'SEARCHED' || i.status === 'PET_FOUND').length,
    inProgress: items.filter((i) => i.status === 'IN_PROGRESS').length,
  };
}

export async function GET(request, { params }) {
  const limit = await withRateLimitAsync(request, RateLimitPresets.SEARCH_READ, 'board');
  if (!limit.success) return rateLimitResponse(limit);
  const correlationId = crypto.randomUUID();
  try {
    const pet = await prisma.case.findFirst({ where: missionWhere(params.missionId), select: CASE_SELECT });
    if (!pet) return NextResponse.json({ error: 'This link does not match a pet.' }, { status: 404 });
    const open = isCaseOpen(pet.status);
    if (pet.reportType === 'FOUND' || pet.lastSeenLatitude == null || pet.lastSeenLongitude == null) {
      return NextResponse.json({ caseId: pet.id, open, unit: 'none', streets: [], around: [], cells: [], counts: countsOf([]), streetsStatus: null, viewer: null });
    }
    const searcher = await searcherFor(request, pet.id);
    const who = { viewer: searcher?.id || null, withNames: Boolean(searcher?.seesNames), ownerId: pet.reporterId };

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
    // The first time the person asked has the board on their screen is when the desk sees "seen".
    if (open && searcher && items.some((i) => i.askedOfMe)) await markAskSeen(pet.id, searcher.id).catch(() => 0);
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
      // The named streets just past the board's edge: for naming a place or a direction, never for walking.
      around: streets ? await readStreetsAround(pet.id) : [],
      cells,
      counts: countsOf(items),
      streetsStatus,
      streetsNote,
      // Who is on the search and what each is doing: for the owner and the forces looking, and nobody else.
      ...(searcher?.seesNames ? { people: (await teamOf(pet.id, { ownerId: pet.reporterId })).map(forDesk) } : {}),
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
  NOT_ALLOWED: () => 'Only the owner can do that.',
  SOMEONE_ON_IT: (title) => `Someone is on ${title} right now. They mark it when they have walked it.`,
  ALREADY_WALKED: (title) => `${title} is already down as walked.`,
  NOT_WALKED: (title) => `${title} has not been walked yet.`,
  ASKED: (title) => `${title} is being kept for someone who was asked to walk it. Pick another.`,
  NOT_OPEN: (title) => `${title} has someone on it or has been walked. Pick one that is still to walk.`,
  ASKED_ALREADY: (title) => `Someone else was just asked to walk ${title}.`,
  NO_PERSON: () => 'That person is not on this search.',
  NO_ASK: () => 'Nothing was asked of you.',
};
const STEERED = { street: 'STREET_UPDATED', block: 'CELL_UPDATED' };
const EVENT = {
  street: { claim: 'STREET_CLAIMED', release: 'STREET_RELEASED', searched: 'STREET_SEARCHED', first: STEERED.street, normal: STEERED.street, walked: 'STREET_SEARCHED', again: STEERED.street },
  block: { claim: 'CELL_CLAIMED', release: 'CELL_RELEASED', searched: 'CELL_SEARCHED', first: STEERED.block, normal: STEERED.block, walked: 'CELL_SEARCHED', again: STEERED.block },
};

export async function PATCH(request, { params }) {
  const limit = await withRateLimitAsync(request, BOARD_WRITE_LIMIT, 'board:act');
  if (!limit.success) return rateLimitResponse(limit);
  const correlationId = crypto.randomUUID();
  try {
    const body = await request.json().catch(() => ({}));
    const unit = body.unit === 'block' ? 'block' : 'street';
    const { id, action } = body;
    const steering = STEER_ACTIONS.includes(action);
    const asking = ASK_ACTIONS.includes(action);
    if (!(asking || (id && (BOARD_ACTIONS.includes(action) || steering)))) {
      return NextResponse.json({ error: `Send an id and one of: ${[...BOARD_ACTIONS, ...STEER_ACTIONS].join(', ')}.` }, { status: 400 });
    }
    const pet = await prisma.case.findFirst({ where: missionWhere(params.missionId), select: CASE_SELECT });
    if (!pet) return NextResponse.json({ error: 'This link does not match a pet.' }, { status: 404 });
    const searcher = await searcherFor(request, pet.id);
    if (!searcher) return NextResponse.json({ error: 'Join the search first.', code: 'NOT_JOINED' }, { status: 401 });
    if (asking) return askOrAnswer({ pet, searcher, body, correlationId });
    // Steering is for whoever runs the search, which is the owner: where the next helpers go, and ground
    // covered off the site. A role in a Rescue Force is not enough to redirect a search (app/lib/searcher.js).
    if (steering && !searcher.leads) return NextResponse.json({ error: WORDS.NOT_ALLOWED(), code: 'NOT_ALLOWED' }, { status: 403 });
    if (!isCaseOpen(pet.status) && action !== 'release') {
      return NextResponse.json({ error: 'This search has ended. Thank you for looking.', code: 'CLOSED' }, { status: 409 });
    }
    // Taking a street or marking it searched is going out to search, which
    // takes the safety waiver. Giving one back does not, and neither does steering from a desk.
    if (action !== 'release' && !steering && !searcher.waiver) {
      return NextResponse.json({ error: 'Accept the safety waiver before you search.', code: WAIVER_CODE }, { status: 403 });
    }

    const result = await actOnBoard({ caseId: pet.id, unit, id: String(id), action, searcher, ownerId: pet.reporterId });
    if (result.error) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'NOT_ALLOWED' ? 403 : 409;
      // A street kept for someone else is, to the person asking for one, a street that is taken: their screen tries the next.
      return NextResponse.json({ error: WORDS[result.error](result.title || 'That street'), code: result.error === 'ASKED' ? 'TAKEN' : result.error, kept: result.error === 'ASKED' || undefined }, { status });
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

/**
 * The desk asks a named person to walk a street, or takes that back; or
 * the person asked says they cannot. Not a walk, so no waiver; an ask is
 * for whoever runs the search to make (the owner), and the server checks
 * that before it looks for the person, so nobody learns from the answer
 * who is on the search.
 */
async function askOrAnswer({ pet, searcher, body, correlationId }) {
  const { action } = body;
  if (!isCaseOpen(pet.status)) return NextResponse.json({ error: 'This search has ended. Thank you for looking.', code: 'CLOSED' }, { status: 409 });
  const say = (code, title, status) => NextResponse.json({ error: WORDS[code](title || 'That street'), code }, { status });
  const done = async (title, extra = {}) => {
    try {
      broadcast(pet.id, { type: 'STREET_UPDATED', unit: 'street' });
    } catch (error) {
      console.warn('Board broadcast failed:', error?.message);
    }
    await logEvent({
      event_type: `board.street_${action}`,
      correlation_id: correlationId,
      actor_user_id: searcher.userId,
      resource_type: 'search_street',
      resource_id: extra.item?.id || null,
      action: 'update',
      result: 'success',
      metadata: { title, volunteer: searcher.kind === 'volunteer' },
    }).catch(() => {});
    return NextResponse.json({ success: true, unit: 'street', ...extra });
  };

  if (action === 'cannot') {
    const result = await cannotWalk({ caseId: pet.id, searcher });
    if (result.error) return say(result.error, null, 409);
    return done(result.title);
  }

  if (!searcher.leads) return say('NOT_ALLOWED', null, 403);
  const person = await personByHandle(pet.id, String(body.person || ''), { ownerId: pet.reporterId });
  if (!person) return say('NO_PERSON', null, 404);

  if (action === 'unask') {
    await unaskPerson({ caseId: pet.id, person, searcher });
    return done(null);
  }

  if (!body.id) return NextResponse.json({ error: 'Send the street to ask for.' }, { status: 400 });
  const result = await askStreet({ caseId: pet.id, streetId: String(body.id), person, searcher, note: body.note });
  if (result.error) return say(result.error, result.title, result.error === 'NOT_FOUND' ? 404 : result.error === 'NOT_ALLOWED' ? 403 : 409);
  // Someone with an account also hears it in their bell and, where they allowed it, on their phone. A helper
  // without one has it on the search screen. The owner is named; anyone else who came to run a search is not.
  if (!String(person.id).startsWith('v:') && person.id !== searcher.userId) {
    const title = `${searcher.isOwner ? `${searcher.firstName} asked you` : 'You were asked'} to walk ${result.street.name}`;
    const message = `For ${pet.petName || 'the pet'}. ${result.title}.`;
    const url = `/mission-control?mission=${encodeURIComponent(pet.caseNumber || pet.id)}`;
    try {
      await prisma.notification.create({ data: { userId: person.id, type: ASK_NOTICE, title, message, actionUrl: url, data: JSON.stringify({ caseId: pet.id, streetId: result.street.id }) } });
      if (isPushConfigured()) await sendPushToUser(prisma, person.id, { title, body: message, url }).catch(() => null);
    } catch (error) {
      console.warn('Ask notice failed:', error?.message);
    }
  }
  return done(result.title, { item: streetForBoard(result.street, { viewer: searcher.id, withNames: searcher.seesNames, ownerId: pet.reporterId }) });
}
