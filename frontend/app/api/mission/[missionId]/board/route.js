/**
 * The search board: the ground around where a pet was lost, in areas, and
 * who is on them (app/lib/searchZones.js).
 *
 * GET /api/mission/[missionId]/board
 *   Open to anyone holding the pet's link, like the pet's page. `unit` is
 *   "area", and `areas` is the circle of the search cut into areas of
 *   ground: the middle, four sides, eight more once it is widened, and a
 *   small circle round each fresh sighting. Each says whether it has been
 *   searched, how many times, and how many people are on it now. It sends
 *   ground, not people: who is on an area goes only to the owner and the
 *   forces looking for the pet. `circle` is the circle itself, and
 *   `around` the named streets near it, for naming a place: nobody is sent
 *   to walk a street. `unit` is "none" for a found pet or a report with no
 *   place the pet was lost.
 *
 *   (Until 2026-11-12 the board was streets, handed out one at a time. A
 *   pet does not keep to streets, so with every street walked the board
 *   would have read as finished while every yard between them was
 *   untouched. PATCH still takes `unit: "street"` and `"block"` for a
 *   screen left open from before, which can stop or finish the street it
 *   holds. Nobody is asked to walk one: an ask is always for an area.)
 *
 * PATCH /api/mission/[missionId]/board
 *   { unit: "area", id, action: "claim" | "release" | "searched" }
 *   For someone signed in, or a helper who joined from the share link
 *   without an account (app/lib/searcher.js). Starting an area and saying
 *   it is searched take the safety waiver; stopping does not. Several
 *   people can be on one area at once. The one exception is the circle
 *   round a sighting: one person goes to a sighting, never a group, so a
 *   second person is answered 409 TAKEN and their screen gives them other
 *   ground.
 *
 *   { unit: "area", id, action: "first" | "normal" | "walked" | "again" }
 *   { unit: "area", action: "againAll" | "widen" }
 *   Steering, from Mission Control on a desk: send the next helpers to an
 *   area first, take that back, put an area down as searched for someone
 *   who searched it without the site, ask for another look at one area or
 *   at every searched one, or widen the circle to its outer ring. For
 *   whoever runs the search (`searcher.leads`: the owner, and
 *   app/lib/searcher.js says why nobody else); 403 for anyone else. No
 *   waiver, since none of it is going out to search.
 *
 *   { unit: "area", id, action: "ask", person, note? }
 *   { action: "unask", person }
 *   The same person asks one named helper to search an area, or takes that
 *   back. `person` is a handle from the roster this route sends them
 *   (`people`), never an id.
 *
 *   { action: "cannot" }
 *   The person asked says they cannot.
 *
 * GET also carries `people`, the roster of the search, for the owner and
 * the forces looking for the pet (app/lib/searchTeam.js), and nobody else.
 * Reading the board marks nothing as seen: a phone says when it has shown
 * an ask or a word (PATCH .../message).
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
import { ensureStreets, actOnBoard, BOARD_ACTIONS, STEER_ACTIONS } from '@/app/lib/searchBoard';
import { RING } from '@/app/lib/searchCircle';
import { readZones, actOnZone, zoneForBoard, askZone, unaskZonePerson, cannotSearch, streetNames, ZONE_ACTIONS, ZONE_STEER_ACTIONS } from '@/app/lib/searchZones';
import { teamOf, personByHandle, forDesk } from '@/app/lib/searchTeam';
import { isPushConfigured, sendPushToUser } from '@/app/lib/push';
import { WAIVER_CODE } from '@/app/lib/waiver';
import { broadcast } from '@/app/lib/sse/missionStream';
import { forcesOf } from '@/app/lib/forceFeed';
import { wakeForces, WAKE_KINDS } from '@/app/lib/wake';
import { logEvent } from '@/lib/logging';

export const dynamic = 'force-dynamic';

const BOARD_WRITE_LIMIT = { windowMs: 60 * 1000, maxRequests: 30, blockDurationMs: 60 * 1000 };

const CASE_SELECT = {
  id: true,
  caseNumber: true,
  status: true,
  reportType: true,
  petName: true,
  ownerName: true,
  reporterId: true,
  lastSeenLatitude: true,
  lastSeenLongitude: true,
};

/** What is said to the people the desk's own actions concern. */
const ASK_ACTIONS = ['ask', 'unask', 'cannot'];
const ASK_NOTICE = 'SEARCH_ASK';

/** The owner's first name as the report gives it, which is what the rest of the screen calls them. */
const ownerFirst = (pet) => String(pet.ownerName || '').trim().split(/\s+/)[0] || null;

/** A request's body as an object, whatever was sent: nothing, a list or a bare value is an empty one. */
async function bodyOf(request) {
  const body = await request.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}
const isText = (value) => typeof value === 'string' && value.length > 0 && value.length <= 200;

/** How much of the circle has been searched: its own areas, without the circles round sightings. */
function countsOf(areas) {
  const ground = areas.filter((a) => a.ring !== RING.SEEN);
  return {
    total: ground.length,
    searched: ground.filter((a) => a.searchCount > 0).length,
    inProgress: ground.filter((a) => a.status === 'IN_PROGRESS').length,
  };
}

export async function GET(request, { params }) {
  const limit = await withRateLimitAsync(request, RateLimitPresets.SEARCH_READ, 'board');
  if (!limit.success) return rateLimitResponse(limit);
  const correlationId = crypto.randomUUID();
  try {
    const { missionId } = await params;
    const pet = await prisma.case.findFirst({ where: missionWhere(missionId), select: CASE_SELECT });
    if (!pet) return NextResponse.json({ error: 'This link does not match a pet.' }, { status: 404 });
    const open = isCaseOpen(pet.status);
    const none = { caseId: pet.id, open, unit: 'none', areas: [], circle: null, streets: [], around: [], cells: [], counts: countsOf([]), streetsStatus: null, viewer: null };
    if (pet.reportType === 'FOUND' || pet.lastSeenLatitude == null || pet.lastSeenLongitude == null) return NextResponse.json(none);
    const searcher = await searcherFor(request, pet.id);
    const who = { viewer: searcher?.id || null, withNames: Boolean(searcher?.seesNames), ownerId: pet.reporterId, ownerName: ownerFirst(pet) };

    // The streets are fetched once per search, for the two names that help someone find an area and for calling
    // a sighting by its corner. The areas need no map server, so nothing here waits for it.
    ensureStreets(pet.id, { correlationId }).catch(() => 'FAILED');

    const read = await readZones(pet.id, who);
    if (!read) return NextResponse.json(none);
    const { areas, circle, streetsStatus } = read;
    const holding = areas.find((a) => a.mine) || null;
    return NextResponse.json({
      caseId: pet.id,
      open,
      unit: 'area',
      areas,
      circle,
      // The named streets near the search: for naming a place, never for walking.
      around: streetsStatus === 'READY' ? await streetNames(pet.id) : [],
      streets: [],
      cells: [],
      counts: countsOf(areas),
      streetsStatus,
      // Who is on the search and what each is doing: for the owner and the forces looking, and nobody else. The
      // note on an ask is the owner's word to one person, so it goes with the roster only to whoever runs the search.
      ...(searcher?.seesNames ? { people: (await teamOf(pet.id, { ownerId: pet.reporterId })).map((p) => forDesk(p, { notes: Boolean(searcher.leads) })) } : {}),
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
  ALREADY_AGAIN: (title) => `${title} is already down for another look.`,
  ASKED: (title) => `${title} is being kept for someone who was asked to walk it. Pick another.`,
};
/** The same answers for an area of ground. `title` is its name as a sentence takes it: "the west side". */
const AREA_WORDS = {
  NOT_FOUND: () => 'That area is not on this search.',
  // The circle round a sighting, with its one person: said as a fact, and the screen gives this person other ground.
  TAKEN: () => 'Someone is already there. One person goes to a sighting.',
  NOT_YOURS: (title) => `You are not on ${title}.`,
  NOT_CLAIMED: (title) => `Start ${title} first, then say it is searched.`,
  NOT_ALLOWED: () => 'Only the owner can do that.',
  SOMEONE_ON_IT: (title) => `Someone is searching ${title} right now. They say so when they have searched it.`,
  ALREADY_WALKED: (title) => `${capital(title)} is already down as searched. Ask for another look first.`,
  NOT_WALKED: (title) => `${capital(title)} has not been searched yet.`,
  ALREADY_AGAIN: (title) => `${capital(title)} is already down for another look.`,
  ALREADY_WIDE: () => 'The search already reaches that far.',
  ON_IT: (title) => `They are already searching ${title}.`,
  ASKED_ALREADY: () => 'Someone is already there, or was just asked to go. One person goes to a sighting.',
  NO_PERSON: () => 'That person is not on this search.',
  NO_ASK: () => 'Nothing was asked of you.',
};
const capital = (text) => String(text || '').charAt(0).toUpperCase() + String(text || '').slice(1);
const AREA_ACTIONS = [...ZONE_ACTIONS, ...ZONE_STEER_ACTIONS];
/** The steering that is about the whole search, and so names no area. */
const WHOLE_SEARCH = ['againAll', 'widen'];

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
    const body = await bodyOf(request);
    // The board is areas of ground. Streets and squares are still answered, for a screen left open from before.
    const unit = body.unit === 'block' ? 'block' : body.unit === 'street' ? 'street' : 'area';
    const area = unit === 'area';
    const { id, action } = body;
    const steering = (area ? ZONE_STEER_ACTIONS : STEER_ACTIONS).includes(action);
    const asking = ASK_ACTIONS.includes(action);
    const known = area ? AREA_ACTIONS : [...BOARD_ACTIONS, ...STEER_ACTIONS];
    // An id is a short piece of text: anything else is refused here, before it is read as one.
    if (!(asking || (known.includes(action) && (isText(id) || (area && WHOLE_SEARCH.includes(action)))))) {
      return NextResponse.json({ error: `Send an id and one of: ${known.join(', ')}.` }, { status: 400 });
    }
    const { missionId } = await params;
    const pet = await prisma.case.findFirst({ where: missionWhere(missionId), select: CASE_SELECT });
    if (!pet) return NextResponse.json({ error: 'This link does not match a pet.' }, { status: 404 });
    const searcher = await searcherFor(request, pet.id);
    if (!searcher) return NextResponse.json({ error: 'Join the search first.', code: 'NOT_JOINED' }, { status: 401 });
    // An ask is always for ground: nobody is asked to walk a street any more, whatever an older screen says it is on.
    if (asking) return askOrAnswerArea({ pet, searcher, body, correlationId });
    // Steering is for whoever runs the search, which is the owner: where the next helpers go, and ground
    // covered off the site. A role in a Rescue Force is not enough to redirect a search (app/lib/searcher.js).
    if (steering && !searcher.leads) return NextResponse.json({ error: WORDS.NOT_ALLOWED(), code: 'NOT_ALLOWED' }, { status: 403 });
    if (!isCaseOpen(pet.status) && action !== 'release') {
      return NextResponse.json({ error: 'This search has ended. Thank you for looking.', code: 'CLOSED' }, { status: 409 });
    }
    // Starting an area or saying it is searched is going out to search, which
    // takes the safety waiver. Stopping does not, and neither does steering from a desk.
    if (action !== 'release' && !steering && !searcher.waiver) {
      return NextResponse.json({ error: 'Accept the safety waiver before you search.', code: WAIVER_CODE }, { status: 403 });
    }

    if (area) return actOnArea({ pet, searcher, id, action, correlationId });

    const result = await actOnBoard({ caseId: pet.id, unit, id, action, searcher, ownerId: pet.reporterId, ownerName: ownerFirst(pet) });
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

/** One of the board's verbs on an area of ground, after who is asking and what they may do have been checked. */
async function actOnArea({ pet, searcher, id, action, correlationId }) {
  const result = await actOnZone({ caseId: pet.id, id, action, searcher, ownerId: pet.reporterId, ownerName: ownerFirst(pet) });
  if (result.error) {
    const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'NOT_ALLOWED' ? 403 : 409;
    return NextResponse.json({ error: AREA_WORDS[result.error](result.title || 'that area'), code: result.error }, { status });
  }
  // Everyone with the board open sees it change. Ids and states only: who is on an area is not for everyone.
  try {
    broadcast(pet.id, { type: 'AREA_UPDATED', unit: 'area', ...(result.item ? { item: { id: result.item.id, status: result.item.status } } : {}) });
  } catch (error) {
    console.warn('Board broadcast failed:', error?.message);
  }
  await logEvent({
    event_type: `board.area_${action}`,
    correlation_id: correlationId,
    actor_user_id: searcher.userId,
    resource_type: 'search_zone',
    resource_id: result.item?.id || null,
    action: 'update',
    result: 'success',
    metadata: { title: result.title, status: result.item?.status, added: result.added, count: result.count, volunteer: searcher.kind === 'volunteer' },
  }).catch(() => {});
  return NextResponse.json({ success: true, unit: 'area', ...(result.item ? { item: result.item } : {}), ...(result.added != null ? { added: result.added } : {}), ...(result.count != null ? { count: result.count } : {}) });
}

/**
 * The desk asks a named person to search an area, or takes that back; or
 * the person asked says they cannot. Not a search, so no waiver; an ask is
 * for whoever runs the search to make (the owner), and the server checks
 * that before it looks for the person, so nobody learns from the answer
 * who is on the search.
 */
async function askOrAnswerArea({ pet, searcher, body, correlationId }) {
  const { action } = body;
  if (!isCaseOpen(pet.status)) return NextResponse.json({ error: 'This search has ended. Thank you for looking.', code: 'CLOSED' }, { status: 409 });
  const say = (code, title, status) => NextResponse.json({ error: AREA_WORDS[code](title || 'that area'), code }, { status });
  const done = async (title, extra = {}) => {
    try {
      broadcast(pet.id, { type: 'AREA_UPDATED', unit: 'area' });
    } catch (error) {
      console.warn('Board broadcast failed:', error?.message);
    }
    await logEvent({
      event_type: `board.area_${action}`,
      correlation_id: correlationId,
      actor_user_id: searcher.userId,
      resource_type: 'search_zone',
      resource_id: extra.item?.id || null,
      action: 'update',
      result: 'success',
      metadata: { title, volunteer: searcher.kind === 'volunteer' },
    }).catch(() => {});
    return NextResponse.json({ success: true, unit: 'area', ...extra });
  };

  if (action === 'cannot') {
    const result = await cannotSearch({ caseId: pet.id, searcher });
    if (result.error) return say(result.error, null, 409);
    return done(result.title);
  }

  if (!searcher.leads) return say('NOT_ALLOWED', null, 403);
  const person = isText(body.person) ? await personByHandle(pet.id, body.person, { ownerId: pet.reporterId }) : null;
  if (!person) return say('NO_PERSON', null, 404);

  if (action === 'unask') {
    await unaskZonePerson({ caseId: pet.id, person, searcher });
    return done(null);
  }

  if (!isText(body.id)) return NextResponse.json({ error: 'Send the area to ask for.' }, { status: 400 });
  const result = await askZone({ caseId: pet.id, zoneId: body.id, person, searcher, note: typeof body.note === 'string' ? body.note : '' });
  if (result.error) return say(result.error, result.title, result.error === 'NOT_FOUND' ? 404 : result.error === 'NOT_ALLOWED' ? 403 : 409);
  const name = pet.petName || 'the pet';
  const item = zoneForBoard(result.zone, { viewer: searcher.id, withNames: searcher.seesNames, ownerId: pet.reporterId, ownerName: ownerFirst(pet), caseId: pet.id, name });
  // Someone with an account also hears it in their bell and, where they allowed it, on their phone. A helper
  // without one has it on the search screen. The owner is named; anyone else who came to run a search is not.
  if (!String(person.id).startsWith('v:') && person.id !== searcher.userId) {
    const title = `${searcher.isOwner ? `${ownerFirst(pet) || searcher.firstName} asked you` : 'You were asked'} to search ${result.title}`;
    const message = `For ${name}. ${item.reach}.`;
    const url = `/mission-control?mission=${encodeURIComponent(pet.caseNumber || pet.id)}`;
    try {
      await prisma.notification.create({ data: { userId: person.id, type: ASK_NOTICE, title, message, actionUrl: url, data: JSON.stringify({ caseId: pet.id, zoneId: result.zone.id }) } });
      if (isPushConfigured()) await sendPushToUser(prisma, person.id, { title, body: message, url }).catch(() => null);
    } catch (error) {
      console.warn('Ask notice failed:', error?.message);
    }
  }
  return done(result.title, { item });
}
