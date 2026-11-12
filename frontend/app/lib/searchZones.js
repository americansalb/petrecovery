/**
 * The areas of one pet's search, kept: the Prisma half of the circle
 * (app/lib/searchCircle.js is the geometry, pure).
 *
 * A search is a circle of ground around where the pet was lost, in areas:
 * the middle, four sides, eight more once the person running the search
 * widens it, and a small circle round each fresh sighting. This file makes
 * those rows the first time a search is read (SearchZone), says who is on
 * each (SearchZoneVisit), and takes the board's actions on them.
 *
 * What is different from the streets this replaced (app/lib/searchBoard.js):
 *
 *  - Ground is not one walk. An area is hectares, so several people can be
 *    on one at once, and each time one of them says they searched it the
 *    area counts one more search. Nothing is ever "taken": someone asking
 *    for ground is always given some.
 *  - The one exception is the circle round a sighting. One person goes to
 *    a sighting, never a group, so while someone is there, or the owner is
 *    on the way, it is not given to anyone else.
 *  - An ask ("Jo, search the west side") keeps nothing from anyone. It is
 *    a row for that person: asked, seen, started.
 *  - The areas need no map server. Streets are still fetched
 *    (searchBoard.js, ensureStreets) for one thing: the two names that
 *    help someone find an area.
 *
 * Names follow the board's rule: who is on an area goes only to the owner
 * and the forces looking for the pet. Nobody is handed out by their id.
 */
import prisma from '@/app/lib/prisma';
import { CLAIM_TTL_MS, FIRST_PRIORITY, SIGHTING_PRIORITY_WINDOW_MS } from '@/app/lib/searchGrid';
import { RING, circleFor, areasOf, seenArea, minutesFor, heartOf, outlineOf, reachOf, landmarksIn, urgencyOf, inWords, rankAreas, heldFor } from '@/app/lib/searchCircle';

export { rankAreas };
import { ensureGrid } from '@/app/lib/searchBoard';
import { handleFor, askHolds } from '@/app/lib/searchTeam';
import { cleanWord } from '@/app/lib/searchTalk';
import { cut } from '@/app/lib/searchText';

/** How many fresh sightings get a circle of their own: the newest few. */
export const SEEN_CIRCLES_MAX = 3;
/** An ask nobody started in this long is over: the person is no longer shown as asked. */
export const ASK_STALE_MS = 12 * 60 * 60 * 1000;
/**
 * How long after the site stops counting someone as on an area they can
 * still say what happened there. The site's count is a guess from the
 * clock; the person who went over the ground is the one who knows.
 */
export const LATE_MS = 12 * 60 * 60 * 1000;
export const ASK_NOTE_MAX = 140;
/** What the asked person's button says, and so what the desk is told in their name when they press it. */
export const CANNOT_WORDS = "I can't right now.";
/** The priority an area goes back to when it is no longer asked for first. */
const PLAIN_PRIORITY = 5;

/** "m:" and a user id: ground searched off the site, and put down by that user. Not a person out searching. */
const MARK = 'm:';
const isMark = (id) => typeof id === 'string' && id.startsWith(MARK);

export const ZONE_ACTIONS = ['claim', 'release', 'searched'];
/**
 * Steering, from the desk, for whoever runs the search (the owner):
 *
 *   first    send the next people here before anywhere else
 *   normal   take that back
 *   walked   put it down as searched, for someone who searched it without the site
 *   again    a searched area needs another look
 *   againAll every searched area of the circle needs another look
 *   widen    add the outer ring to the search
 */
export const ZONE_STEER_ACTIONS = ['first', 'normal', 'walked', 'again', 'againAll', 'widen'];

const CASE_FOR_ZONES = { id: true, reportType: true, petName: true, petSpecies: true, lastSeenLatitude: true, lastSeenLongitude: true };

/**
 * How long someone is taken to be on an area with no word from them
 * (app/lib/searchCircle.js, heldFor): half an hour past the moment the desk
 * is told they have been out a long time, and never under two hours.
 */
const holdFor = (minutes) => heldFor(minutes) * 60 * 1000;
/** The shortest hold there is: the sweep looks at nothing started more recently. */
const MIN_HOLD_MS = heldFor(0) * 60 * 1000;

/** "north" from "north", "north-east" from "outer-north-east": the way an area lies, or null for a whole circle. */
function wayOf(key) {
  if (key === 'middle' || String(key).startsWith('seen-')) return null;
  return String(key).replace(/^outer-/, '');
}

/** A stored row as the geometry reads it. */
const areaOf = (row) => ({ key: row.key, name: row.name, way: wayOf(row.key), ring: row.ring, from: row.fromMeters, to: row.toMeters, a: row.bearingFrom, b: row.bearingTo });
const centerOf = (row) => ({ lat: row.centerLatitude, lng: row.centerLongitude });

function rowFor(area, center, circle, caseId) {
  const heart = heartOf(area, center);
  return {
    caseId,
    key: area.key,
    name: area.name,
    ring: area.ring,
    centerLatitude: center.lat,
    centerLongitude: center.lng,
    fromMeters: area.from,
    toMeters: area.to,
    bearingFrom: area.a,
    bearingTo: area.b,
    heartLatitude: heart.lat,
    heartLongitude: heart.lng,
    minutes: minutesFor(area, circle),
  };
}

/** The sightings of the last three days, newest first. One a witness took back does not count. */
export async function freshSightings(caseId, now = Date.now()) {
  const rows = await prisma.caseSighting
    .findMany({
      where: { missionId: caseId, sightedAt: { gte: new Date(now - SIGHTING_PRIORITY_WINDOW_MS) }, OR: [{ witnessState: null }, { witnessState: { not: 'NOT_THE_PET' } }] },
      orderBy: { sightedAt: 'desc' },
      take: 20,
      select: { id: true, latitude: true, longitude: true, sightedAt: true, ownerGoingAt: true },
    })
    .catch(() => []);
  return (rows || [])
    .filter((r) => typeof r.latitude === 'number' && typeof r.longitude === 'number')
    .map((r) => ({ id: r.id, lat: r.latitude, lng: r.longitude, at: r.sightedAt, ownerGoingAt: r.ownerGoingAt || null }));
}

/** The board's streets as names and lines, for naming what runs through an area. */
async function streetLines(caseId) {
  const rows = await prisma.searchStreet.findMany({ where: { caseId }, select: { name: true, path: true } }).catch(() => []);
  const lines = [];
  for (const row of rows || []) {
    try {
      lines.push({ name: row.name, path: JSON.parse(row.path) });
    } catch {
      // A row whose line cannot be read names nothing.
    }
  }
  return lines;
}

/**
 * The named streets near a search, as { name, fromName, toName, path }:
 * for calling a place by its corner ("Ramsey Ave and W 40th St"). They
 * carry no state, because nobody is sent to walk one.
 */
export async function streetNames(caseId) {
  const rows = await prisma.searchStreet.findMany({ where: { caseId }, select: { name: true, fromName: true, toName: true, path: true } }).catch(() => []);
  const out = [];
  for (const row of rows || []) {
    try {
      out.push({ name: row.name, fromName: row.fromName, toName: row.toName, path: JSON.parse(row.path) });
    } catch {
      // A row whose line cannot be read names nothing.
    }
  }
  return out;
}

/** Give each area that has none its landmarks, once the streets are known (or known to be none). */
async function nameLandmarks(caseId, streetsStatus) {
  const bare = await prisma.searchZone.findMany({
    where: { caseId, landmarks: null },
    select: { id: true, key: true, name: true, ring: true, centerLatitude: true, centerLongitude: true, fromMeters: true, toMeters: true, bearingFrom: true, bearingTo: true },
  });
  if (!bare.length) return;
  const streets = streetsStatus === 'READY' ? await streetLines(caseId) : [];
  await Promise.all(
    bare.map((row) =>
      prisma.searchZone.updateMany({ where: { id: row.id, landmarks: null }, data: { landmarks: JSON.stringify(landmarksIn(areaOf(row), centerOf(row), streets)) } })
    )
  );
}

/**
 * The areas of a case's search, made on first use and added to as the
 * search changes: the outer ring once it is widened, and a circle round
 * each fresh sighting. Returns what the reads below need, or null when
 * there is no search to draw (no such pet, a found pet, or a report with
 * no place the pet was lost).
 */
export async function ensureZones(caseId, { now = Date.now() } = {}) {
  const pet = await prisma.case.findUnique({ where: { id: caseId }, select: CASE_FOR_ZONES });
  if (!pet || pet.reportType === 'FOUND' || pet.lastSeenLatitude == null || pet.lastSeenLongitude == null) return null;
  const [grid, rows, sightings] = await Promise.all([
    prisma.searchGrid.findUnique({ where: { caseId }, select: { widenedAt: true, streetsStatus: true } }),
    prisma.searchZone.findMany({ where: { caseId }, select: { key: true, ring: true, centerLatitude: true, centerLongitude: true, landmarks: true } }),
    freshSightings(caseId, now),
  ]);
  const circle = circleFor(pet.petSpecies);
  const widened = Boolean(grid?.widenedAt);
  const name = pet.petName || 'the pet';
  // The circle stays where it was first drawn, even if the report's place is edited later: ground already
  // searched must not move under the people who searched it.
  const first = rows.find((r) => r.ring !== RING.SEEN);
  const center = first ? centerOf(first) : { lat: pet.lastSeenLatitude, lng: pet.lastSeenLongitude };
  const have = new Set(rows.map((r) => r.key));
  const missing = [];
  for (const area of areasOf(circle, { widened })) {
    if (!have.has(area.key)) missing.push(rowFor(area, center, circle, caseId));
  }
  for (const s of sightings.slice(0, SEEN_CIRCLES_MAX)) {
    const area = seenArea(s.id, circle, name);
    if (!have.has(area.key)) missing.push({ ...rowFor(area, { lat: s.lat, lng: s.lng }, circle, caseId), sightingId: s.id });
  }
  // Two first reads at once both try: the unique key on (caseId, key) keeps one of each.
  if (missing.length) await prisma.searchZone.createMany({ data: missing, skipDuplicates: true });
  const streetsStatus = grid?.streetsStatus || null;
  if ((missing.length || rows.some((r) => r.landmarks == null)) && (streetsStatus === 'READY' || streetsStatus === 'NONE')) {
    await nameLandmarks(caseId, streetsStatus).catch(() => {});
  }
  return { pet, circle, center, widened, name, sightings, streetsStatus };
}

/**
 * Someone who started an area and has not been heard from in two hours
 * (longer for a large area: holdFor) is no longer counted as on it, and an
 * ask nobody started in half a day is over. Returns how many were closed.
 * The person keeps their own card for it (lapsedVisitOf).
 */
export async function sweepStaleVisits(caseId, now = Date.now()) {
  const old = await prisma.searchZoneVisit.findMany({
    where: {
      caseId,
      endedAt: null,
      OR: [{ startedAt: { lt: new Date(now - MIN_HOLD_MS) } }, { startedAt: null, askedAt: { lt: new Date(now - ASK_STALE_MS) } }],
    },
    select: { id: true, startedAt: true, zone: { select: { minutes: true } } },
  });
  const stale = old.filter((v) => !v.startedAt || now - new Date(v.startedAt).getTime() > holdFor(v.zone?.minutes));
  if (!stale.length) return 0;
  const { count } = await prisma.searchZoneVisit.updateMany({ where: { id: { in: stale.map((v) => v.id) }, endedAt: null }, data: { endedAt: new Date(now), outcome: 'LAPSED' } });
  return count;
}

const parseList = (text) => {
  try {
    const list = JSON.parse(text || '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

const onIt = (visit) => Boolean(visit.startedAt) && !visit.endedAt;
const askedOnly = (visit) => Boolean(visit.askedAt) && !visit.startedAt && !visit.endedAt;

/** How long the owner setting off for a sighting counts as the owner being there. */
const OWNER_GOING_MS = CLAIM_TTL_MS;

/**
 * Whether the circle round a sighting has its one person, as far as
 * someone else is concerned: somebody is there, somebody was asked to go
 * (while the ask is fresh), or the owner set off for it. Someone the
 * person running the search asked to go is not kept out by the owner
 * having set off: the ask is the owner's own word, and it stands until it
 * is taken back.
 */
function seenCircleFull(row, { except = null, sighting = null, ownerId = null, now = Date.now() } = {}) {
  if (row.ring !== RING.SEEN) return false;
  const visits = row.visits || [];
  const others = visits.filter((v) => v.searcherId !== except);
  if (others.some((v) => onIt(v) || (askedOnly(v) && askHolds(v.askedAt, now)))) return true;
  const going = sighting?.ownerGoingAt ? now - new Date(sighting.ownerGoingAt).getTime() < OWNER_GOING_MS : false;
  const askedToGo = Boolean(except) && visits.some((v) => v.searcherId === except && askedOnly(v));
  return going && except !== ownerId && !askedToGo;
}

/**
 * One at a time through the circle round a sighting. Who goes there is
 * decided by a read and then a write, and two people can ask in the same
 * moment, so both are done under a lock the database holds until the
 * transaction ends (it works across server instances and lets go on a
 * crash). `work` is given the transaction to read and write through.
 */
function oneAtATime(zoneId, work) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7304, hashtext(${String(zoneId)}))`;
    return work(tx);
  });
}

/**
 * One area as the board sends it, for one viewer. `ctx` is what the read
 * knows: { viewer, withNames, ownerId, ownerName, caseId, name, sightings, now }.
 * The row carries its open visits (asked, or on it).
 */
export function zoneForBoard(row, ctx = {}) {
  const { viewer = null, withNames = false, ownerId = null, ownerName = null, caseId = row.caseId, name = 'the pet', sightings = [], now = Date.now() } = ctx;
  const area = areaOf(row);
  const center = centerOf(row);
  const visits = row.visits || [];
  const on = visits.filter(onIt).sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
  const asks = visits.filter(askedOnly);
  const mine = Boolean(viewer && on.some((v) => v.searcherId === viewer));
  const myAsk = viewer ? asks.find((v) => v.searcherId === viewer) || null : null;
  const sighting = row.ring === RING.SEEN ? sightings.find((s) => s.id === row.sightingId) || null : null;
  const first = row.priority >= FIRST_PRIORITY;
  // How urgent it is right now: its ring and the fresh sightings, worked out on every read. The circle round a
  // fresh sighting comes before everything the search itself orders; one whose sighting is old comes last.
  const urgency = first ? FIRST_PRIORITY : row.ring === RING.SEEN ? (sighting ? 10 : 2) : urgencyOf(area, center, { sightings, now });
  const status = on.length ? 'IN_PROGRESS' : row.againAt ? 'NEEDS_REVISIT' : row.searchCount > 0 ? 'SEARCHED' : 'UNSEARCHED';
  const full = seenCircleFull(row, { except: viewer, sighting, ownerId, now });
  const going = sighting?.ownerGoingAt && now - new Date(sighting.ownerGoingAt).getTime() < OWNER_GOING_MS ? { at: sighting.ownerGoingAt } : null;
  const out = {
    id: row.id,
    key: row.key,
    ring: row.ring,
    name: row.name,
    title: row.name,
    reach: reachOf(area, name),
    landmarks: parseList(row.landmarks),
    outline: outlineOf(area, center),
    center: { lat: row.heartLatitude, lng: row.heartLongitude },
    from: row.fromMeters,
    to: row.toMeters,
    a: row.bearingFrom,
    b: row.bearingTo,
    minutes: row.minutes,
    priority: urgency,
    // The owner asked for it first: the next people are sent here before anywhere else.
    first,
    status,
    // Searched, and put up for another look. It stays so while someone is on it, until one of them says it is searched.
    again: Boolean(row.againAt),
    // How many people are on it now. Everyone may know how many; who they are goes where names go.
    on: on.length,
    // How many others were asked to search it and have not started, while the ask is fresh: ground with someone
    // on the way is given out after ground with nobody.
    coming: asks.filter((v) => v.searcherId !== viewer && askHolds(v.askedAt, now)).length,
    // The circle round a sighting, with its one person: not given to anyone else.
    full,
    reserved: full,
    claimedAt: on[0]?.startedAt || null,
    searchedAt: row.searchedAt,
    searchCount: row.searchCount,
    // Put down as searched from the desk, for someone who searched it without the site.
    marked: isMark(row.searchedById),
    mine,
    ...(row.ring === RING.SEEN ? { sightingId: row.sightingId, sightingAt: sighting?.at || null, ...(going ? { going } : {}) } : {}),
  };
  if (myAsk) {
    out.askedOfMe = true;
    out.askedNote = myAsk.askedNote || '';
    // The owner by the name the rest of the screen calls them; anyone else who came to run a search is not named to a helper.
    out.askedBy = myAsk.askedById && myAsk.askedById === ownerId ? ownerName || myAsk.askedByName || null : null;
    // Whether their screen has said it showed this: until it has, it says so when it does.
    out.askedSeen = Boolean(myAsk.askedSeenAt);
  }
  if (withNames) {
    out.who = on.map((v) => ({ name: v.searcherName || 'A helper', handle: handleFor(caseId, v.searcherId), since: v.startedAt }));
    out.claimedByName = out.who[0]?.name || null;
    out.searchedByName = row.searchedByName || null;
    out.asked = asks.map((v) => ({ name: v.searcherName || 'A helper', handle: handleFor(caseId, v.searcherId), at: v.askedAt, seenAt: v.askedSeenAt || null, holds: askHolds(v.askedAt, now) }));
  }
  return out;
}

const OPEN_VISITS = { where: { endedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] };

/** The bearing an area lies on, from its circle's centre: 0 for the north side, 90 for the east. */
const midBearing = (row) => {
  const span = (((row.bearingTo - row.bearingFrom) % 360) + 360) % 360 || 360;
  return (row.bearingFrom + span / 2) % 360;
};

/** Most urgent first; on a tie the circle round a sighting, then the middle, the sides and the outer areas, clockwise from north. */
const byUrgency = (a, b) => b.priority - a.priority || Number(b.ring === RING.SEEN) - Number(a.ring === RING.SEEN) || a.ring - b.ring || a.bearing - b.bearing;

/**
 * The last area this person started, where the site stopped counting them
 * as there before they said what happened (sweepStaleVisits): { id,
 * zoneId }, or null. An hour-long search can take three; the clock is a
 * guess, and the person who went over the ground is the one who knows. So
 * for half a day they can still say it is searched, or that they stopped.
 * Starting anything since makes that the last thing they started.
 */
async function lapsedVisitOf(caseId, searcherId, now = Date.now()) {
  if (!searcherId) return null;
  const last = await prisma.searchZoneVisit
    .findFirst({ where: { caseId, searcherId, startedAt: { not: null } }, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], select: { id: true, zoneId: true, outcome: true, endedAt: true } })
    .catch(() => null);
  if (!last || last.outcome !== 'LAPSED' || !last.endedAt) return null;
  return now - new Date(last.endedAt).getTime() < LATE_MS ? { id: last.id, zoneId: last.zoneId } : null;
}

/**
 * The areas of a case's search, most urgent first, with the circle they
 * are cut from, or null when there is no search to draw. Makes the areas
 * on first use and sweeps stale visits on the way.
 *
 * { circle: { center, inner, edge, wide, radius, widened }, areas: [...] }
 */
export async function readZones(caseId, { viewer = null, withNames = false, ownerId = null, ownerName = null, now = Date.now() } = {}) {
  const made = await ensureZones(caseId, { now });
  if (!made) return null;
  await sweepStaleVisits(caseId, now);
  const rows = await prisma.searchZone.findMany({ where: { caseId }, include: { visits: OPEN_VISITS } });
  const ctx = { viewer, withNames, ownerId, ownerName, caseId, name: made.name, sightings: made.sightings, now };
  const fresh = new Set(made.sightings.slice(0, SEEN_CIRCLES_MAX).map((s) => s.id));
  // A sighting's circle is on the board while the sighting is fresh, or while someone is still there.
  const shown = (row) => row.ring !== RING.SEEN || fresh.has(row.sightingId) || row.visits.some(onIt);
  // An ask to go to a circle that has left the board is over: the sighting was taken back, or newer ones took its
  // place. Ended here, so the person's phone and the desk's list stop saying they are asked.
  const over = rows.filter((row) => !shown(row)).flatMap((row) => row.visits.filter(askedOnly).map((v) => v.id));
  if (over.length) {
    await prisma.searchZoneVisit.updateMany({ where: { id: { in: over }, endedAt: null, startedAt: null }, data: { endedAt: new Date(now), outcome: 'LAPSED' } }).catch(() => {});
  }
  const areas = rows
    // The outer ring is part of the search once it is widened, and not before.
    .filter((row) => row.ring !== RING.OUTER || made.widened)
    .filter(shown)
    .map((row) => ({ ...zoneForBoard(row, ctx), bearing: midBearing(row) }))
    .sort(byUrgency)
    .map(({ bearing, ...area }) => area);
  if (viewer && !areas.some((a) => a.mine)) {
    // The site stopped counting this person as on an area, and they have not said what happened there. To
    // everyone else they are no longer on it. Their own card stays, so they can still say it is searched. A
    // sighting's circle that someone else has since gone to is that person's.
    const late = await lapsedVisitOf(caseId, viewer, now);
    const theirs = late ? areas.find((a) => a.id === late.zoneId && !a.full) : null;
    if (theirs) theirs.mine = true;
  }
  const { circle, center, widened } = made;
  return {
    circle: { center, inner: circle.inner, edge: circle.edge, wide: circle.wide, radius: widened ? circle.wide : circle.edge, widened },
    areas,
    streetsStatus: made.streetsStatus,
  };
}

/**
 * Ground for the job picker on a pet's page (app/lib/jobs.js), in the
 * order the search screen gives it out, each as that picker reads a job:
 * { id, unit: 'area', label, ring, status, priority, first, again,
 * centerLatitude, centerLongitude, minutes, reach, landmarks, on, coming,
 * searchCount, searchedAt, askedOfMe }. Empty when there is no search to
 * draw.
 */
export async function openAreas(caseId, { take = 12, viewer = null, now = Date.now() } = {}) {
  const read = await readZones(caseId, { viewer, now });
  if (!read) return [];
  return rankAreas(read.areas)
    .slice(0, take)
    .map((a) => ({
      id: a.id,
      unit: 'area',
      label: a.name,
      ring: a.ring,
      status: a.status,
      priority: a.priority,
      first: a.first,
      again: a.again,
      centerLatitude: a.center.lat,
      centerLongitude: a.center.lng,
      minutes: a.minutes,
      reach: a.reach,
      landmarks: a.landmarks,
      on: a.on,
      coming: a.coming,
      searchCount: a.searchCount,
      searchedAt: a.searchedAt,
      askedOfMe: Boolean(a.askedOfMe),
    }));
}

/**
 * The board's verbs on an area. `searcher` is who is doing it
 * (app/lib/searcher.js).
 *
 *   claim     start searching it. Whatever else this person was on is
 *             given back: one area per person at a time.
 *   release   stop, without having searched it
 *   searched  this person searched it: the area counts one more search
 *
 * and, for whoever runs the search, the steering in ZONE_STEER_ACTIONS.
 *
 * Returns { item, title } (the area as the board sends it, for this
 * person; `title` is its name as a sentence takes it) or { error, title }:
 * NOT_FOUND, TAKEN (a sighting's circle has its one person), NOT_YOURS,
 * NOT_CLAIMED, NOT_ALLOWED, SOMEONE_ON_IT, ALREADY_WALKED, NOT_WALKED,
 * ALREADY_AGAIN, ALREADY_WIDE.
 */
export async function actOnZone({ caseId, id, action, searcher, ownerId = null, ownerName = null, now = Date.now() }) {
  const me = searcher.id;
  const when = new Date(now);
  const steering = ZONE_STEER_ACTIONS.includes(action);
  if (steering && !searcher.leads) return { error: 'NOT_ALLOWED', title: null };

  if (action === 'widen') return widenCircle({ caseId, searcher, now });
  if (action === 'againAll') {
    // Every searched area nobody is on, of the circle itself: a sighting's circle is asked for one at a time.
    const { count } = await prisma.searchZone.updateMany({
      where: { caseId, ring: { not: RING.SEEN }, searchCount: { gt: 0 }, againAt: null, visits: { none: { endedAt: null, startedAt: { not: null } } } },
      data: { againAt: when },
    });
    return { count, title: null };
  }

  const read = () => prisma.searchZone.findFirst({ where: { id: String(id), caseId }, include: { visits: OPEN_VISITS } });
  const before = await read();
  if (!before) return { error: 'NOT_FOUND', title: null };
  const title = inWords(before.name);
  const busy = before.visits.some(onIt);
  // Asked for first, and now searched: the ask is met, so the next people are not sent to it ahead of everything again.
  const askMet = () => prisma.searchZone.updateMany({ where: { id: before.id, priority: { gte: FIRST_PRIORITY } }, data: { priority: PLAIN_PRIORITY } }).catch(() => {});

  if (action === 'first') {
    // Searched and asked for first is, by that, due another look.
    await prisma.searchZone.updateMany({ where: { id: before.id }, data: { priority: FIRST_PRIORITY, ...(before.searchCount > 0 && !before.againAt ? { againAt: when } : {}) } });
  } else if (action === 'normal') {
    await prisma.searchZone.updateMany({ where: { id: before.id }, data: { priority: PLAIN_PRIORITY } });
  } else if (action === 'walked') {
    // Someone on it says so themselves. This is for ground nobody on the site is on.
    if (busy) return { error: 'SOMEONE_ON_IT', title };
    const marked = await prisma.searchZone.updateMany({
      // Not searched yet, or put up for another look: a searched area is put up for another look before it is counted again.
      where: { id: before.id, OR: [{ searchCount: 0 }, { againAt: { not: null } }] },
      data: { searchCount: { increment: 1 }, searchedAt: when, searchedById: `${MARK}${searcher.userId}`, searchedByName: searcher.firstName, againAt: null },
    });
    if (marked.count === 0) return { error: 'ALREADY_WALKED', title };
    await askMet();
  } else if (action === 'again') {
    if (busy) return { error: 'SOMEONE_ON_IT', title };
    if (!(before.searchCount > 0)) return { error: 'NOT_WALKED', title };
    const again = await prisma.searchZone.updateMany({ where: { id: before.id, searchCount: { gt: 0 }, againAt: null }, data: { againAt: when } });
    if (again.count === 0) return { error: 'ALREADY_AGAIN', title };
  } else if (action === 'claim') {
    // The person is on it afterwards: the ask becomes the search, or a new visit starts.
    const start = async (db, visits) => {
      const mineHere = visits.filter((v) => v.searcherId === me);
      if (mineHere.some(onIt)) return;
      const asked = mineHere.find(askedOnly);
      if (asked) {
        // The area they were asked for: the ask becomes the search, and starting it is seeing it.
        const started = await db.searchZoneVisit.updateMany({ where: { id: asked.id, endedAt: null }, data: { startedAt: when, searcherName: searcher.firstName, ...(asked.askedSeenAt ? {} : { askedSeenAt: when }) } });
        if (started.count > 0) return;
      }
      await db.searchZoneVisit.create({ data: { zoneId: before.id, caseId, searcherId: me, searcherName: searcher.firstName, startedAt: when } });
    };
    if (before.ring === RING.SEEN) {
      const sighting = (await freshSightings(caseId, now)).find((s) => s.id === before.sightingId) || null;
      // One person goes to a sighting, never a group. Two can ask in the same moment, so looking who is there
      // and starting are one step: the second to arrive finds the first there, and is given other ground.
      const taken = await oneAtATime(before.id, async (tx) => {
        const visits = await tx.searchZoneVisit.findMany({ where: { zoneId: before.id, endedAt: null }, orderBy: OPEN_VISITS.orderBy });
        if (seenCircleFull({ ring: before.ring, visits }, { except: me, sighting, ownerId, now })) return true;
        await start(tx, visits);
        // It has its one person. Anyone else asked to go, so long ago that the ask no longer kept it for them, is no longer asked.
        await tx.searchZoneVisit.updateMany({ where: { zoneId: before.id, endedAt: null, startedAt: null, NOT: { searcherId: me } }, data: { endedAt: when, outcome: 'LAPSED' } });
        return false;
      });
      if (taken) return { error: 'TAKEN', title };
    } else {
      await start(prisma, before.visits);
    }
    // One area per person at a time: whatever else they were on is given back, once they have the new one.
    await prisma.searchZoneVisit.updateMany({ where: { caseId, searcherId: me, endedAt: null, startedAt: { not: null }, NOT: { zoneId: before.id } }, data: { endedAt: when, outcome: 'GAVE_BACK' } });
  } else if (action === 'release') {
    const given = await prisma.searchZoneVisit.updateMany({ where: { zoneId: before.id, searcherId: me, endedAt: null, startedAt: { not: null } }, data: { endedAt: when, outcome: 'GAVE_BACK' } });
    if (given.count === 0) {
      // The site had stopped counting them as there. Stopping is still theirs to say, and it takes the card off their screen.
      const late = await lapsedVisitOf(caseId, me, now);
      if (!late || late.zoneId !== before.id) return { error: 'NOT_YOURS', title };
      await prisma.searchZoneVisit.updateMany({ where: { id: late.id, outcome: 'LAPSED' }, data: { outcome: 'GAVE_BACK' } });
    }
  } else if (action === 'searched') {
    // Only someone on it can say so: "searched" means a person went over the ground.
    const done = await prisma.searchZoneVisit.updateMany({ where: { zoneId: before.id, searcherId: me, endedAt: null, startedAt: { not: null } }, data: { endedAt: when, outcome: 'SEARCHED' } });
    if (done.count === 0) {
      // Out longer than the site allowed for, so it had stopped counting them as there. They went over the
      // ground all the same, and saying so counts. Once: only the request that changes the visit counts it.
      const late = await lapsedVisitOf(caseId, me, now);
      if (!late || late.zoneId !== before.id) return { error: 'NOT_CLAIMED', title };
      const counted = await prisma.searchZoneVisit.updateMany({ where: { id: late.id, outcome: 'LAPSED' }, data: { endedAt: when, outcome: 'SEARCHED' } });
      if (counted.count === 0) return { error: 'NOT_CLAIMED', title };
    }
    await prisma.searchZone.update({ where: { id: before.id }, data: { searchCount: { increment: 1 }, searchedAt: when, searchedById: me, searchedByName: searcher.firstName, againAt: null } });
    await askMet();
  } else {
    return { error: 'NOT_FOUND', title };
  }

  if (action === 'searched' || action === 'walked') {
    await prisma.searchGrid.updateMany({ where: { caseId }, data: { lastActivityAt: when } }).catch(() => {});
  }
  const [after, pet, sightings] = await Promise.all([read(), prisma.case.findUnique({ where: { id: caseId }, select: { petName: true } }), freshSightings(caseId, now)]);
  return {
    item: zoneForBoard(after, { viewer: me, withNames: searcher.seesNames, ownerId, ownerName, caseId, name: pet?.petName || 'the pet', sightings, now }),
    title,
  };
}

/**
 * Add the outer ring to a search: for whoever runs it. Returns { added }
 * (how many areas the search grew by) or { error: 'NOT_ALLOWED' |
 * 'NOT_FOUND' | 'ALREADY_WIDE' }.
 */
export async function widenCircle({ caseId, searcher, now = Date.now() }) {
  if (!searcher?.leads) return { error: 'NOT_ALLOWED', title: null };
  // The widening is kept on the search's own row, which the first read of its streets makes.
  const grid = await ensureGrid(caseId);
  if (!grid) return { error: 'NOT_FOUND', title: null };
  const widened = await prisma.searchGrid.updateMany({ where: { id: grid.id, widenedAt: null }, data: { widenedAt: new Date(now), widenedById: searcher.userId } });
  if (widened.count === 0) return { error: 'ALREADY_WIDE', title: null };
  const before = await prisma.searchZone.count({ where: { caseId, ring: RING.OUTER } });
  await ensureZones(caseId, { now });
  const after = await prisma.searchZone.count({ where: { caseId, ring: RING.OUTER } });
  return { added: after - before, title: null };
}

// ---------------------------------------------------------------------------
// Asking one named person to search one area
// ---------------------------------------------------------------------------

/**
 * Ask `person` ({ id, name }, from the roster) to search an area, with a
 * word of the asker's own if they have one. For whoever runs the search.
 * It becomes the card on that person's phone with one button, and the desk
 * sees it asked, then seen, then started. One ask to a person: asking them
 * for another area takes the first one back.
 *
 * Returns { zone, title } or { error: 'NOT_ALLOWED' | 'NOT_FOUND' |
 * 'ON_IT' (they are already searching it) | 'ASKED_ALREADY' (a sighting's
 * circle has its one person), title }.
 */
export async function askZone({ caseId, zoneId, person, searcher, note = '', now = Date.now() }) {
  if (!searcher?.leads) return { error: 'NOT_ALLOWED', title: null };
  const zone = await prisma.searchZone.findFirst({ where: { id: String(zoneId), caseId }, include: { visits: OPEN_VISITS } });
  if (!zone) return { error: 'NOT_FOUND', title: null };
  const title = inWords(zone.name);
  const when = new Date(now);
  const seen = zone.ring === RING.SEEN;
  // Answers the error, or null once the ask is made. `visits` are the area's open ones, as `db` reads them.
  const ask = async (db, visits) => {
    if (visits.some((v) => v.searcherId === person.id && onIt(v))) return 'ON_IT';
    if (seen && visits.some((v) => v.searcherId !== person.id && (onIt(v) || (askedOnly(v) && askHolds(v.askedAt, now))))) return 'ASKED_ALREADY';
    // One ask to a person at a time. Only the ones before this moment: two asks made at once must not each take the other back.
    await db.searchZoneVisit.updateMany({ where: { caseId, searcherId: person.id, endedAt: null, startedAt: null, askedAt: { lt: when } }, data: { endedAt: when, outcome: 'TAKEN_BACK' } });
    // And one person asked to go to a sighting: asking someone else, once the first ask no longer keeps it, takes the first back.
    if (seen) await db.searchZoneVisit.updateMany({ where: { zoneId: zone.id, endedAt: null, startedAt: null, NOT: { searcherId: person.id } }, data: { endedAt: when, outcome: 'TAKEN_BACK' } });
    await db.searchZoneVisit.create({
      data: {
        zoneId: zone.id,
        caseId,
        searcherId: person.id,
        searcherName: person.name,
        askedById: searcher.userId,
        askedByName: searcher.firstName,
        askedAt: when,
        askedNote: cut(cleanWord(note).replace(/\n+/g, ' '), ASK_NOTE_MAX) || null,
      },
    });
    return null;
  };
  // Who goes to a sighting is decided one request at a time (oneAtATime), so an ask and someone setting off in the same moment cannot both stand.
  const error = seen
    ? await oneAtATime(zone.id, async (tx) => ask(tx, await tx.searchZoneVisit.findMany({ where: { zoneId: zone.id, endedAt: null }, orderBy: OPEN_VISITS.orderBy })))
    : await ask(prisma, zone.visits);
  if (error) return { error, title };
  return { zone: await prisma.searchZone.findFirst({ where: { id: zone.id }, include: { visits: OPEN_VISITS } }), title };
}

/** Take back whatever this person was asked to search and has not started. Returns how many asks were taken back. */
export async function unaskZonePerson({ caseId, person, searcher, now = Date.now() }) {
  if (!searcher?.leads) return { error: 'NOT_ALLOWED' };
  // An area they have already started is theirs: it is not taken from under them.
  const { count } = await prisma.searchZoneVisit.updateMany({ where: { caseId, searcherId: person.id, endedAt: null, startedAt: null }, data: { endedAt: new Date(now), outcome: 'TAKEN_BACK' } });
  return { count };
}

/**
 * The person asked says they cannot. The desk is told in the words of the
 * button they pressed. Returns { title } or { error: 'NO_ASK' }.
 */
export async function cannotSearch({ caseId, searcher, now = Date.now() }) {
  const ask = await prisma.searchZoneVisit.findFirst({ where: { caseId, searcherId: searcher.id, endedAt: null, startedAt: null, askedAt: { not: null } }, orderBy: { askedAt: 'desc' }, select: { id: true, zone: { select: { name: true } } } });
  if (!ask) return { error: 'NO_ASK' };
  // Written only if this is the request that answered it: pressed twice, the desk is told once.
  const { count } = await prisma.searchZoneVisit.updateMany({ where: { id: ask.id, endedAt: null, startedAt: null }, data: { endedAt: new Date(now), outcome: 'CANNOT' } });
  if (count === 0) return { error: 'NO_ASK' };
  const title = inWords(ask.zone?.name);
  // The words are the button's. Which area they are about is kept beside them, since the person did not type it.
  await prisma.searchMessage.create({ data: { caseId, fromId: searcher.id, fromName: searcher.firstName, fromDesk: false, toId: null, toName: null, text: CANNOT_WORDS, about: title } }).catch(() => null);
  return { title };
}

/** The id of the area this person was asked to search and has not started, or null. */
export async function zoneAskWaitingFor(caseId, searcherId) {
  if (!searcherId) return null;
  const ask = await prisma.searchZoneVisit.findFirst({ where: { caseId, searcherId, endedAt: null, startedAt: null, askedAt: { not: null } }, orderBy: { askedAt: 'desc' }, select: { zoneId: true } });
  return ask?.zoneId || null;
}

/** The asked person's screen has shown the ask, which is when the desk sees "seen". Returns how many asks that marked. */
export async function markZoneAskSeen(caseId, searcherId, now = Date.now()) {
  if (!searcherId) return 0;
  const { count } = await prisma.searchZoneVisit.updateMany({ where: { caseId, searcherId, endedAt: null, askedAt: { not: null }, askedSeenAt: null }, data: { askedSeenAt: new Date(now) } });
  return count;
}

/**
 * Who is out, from the areas: on one now, or finished one since `since`.
 * Searcher ids, for the picture's count (app/lib/searchPicture.js).
 */
export async function zoneSearchersSince(caseId, since) {
  const rows = await prisma.searchZoneVisit
    .findMany({ where: { caseId, OR: [{ endedAt: null, startedAt: { not: null } }, { outcome: 'SEARCHED', endedAt: { gte: since } }] }, select: { searcherId: true } })
    .catch(() => []);
  return (rows || []).map((r) => r.searcherId);
}

/** For the thank-you screen: how many areas were searched at least once, and by whom. { areas, people: [searcher id] } */
export async function zoneGroundCovered(caseId) {
  const [areas, visits] = await Promise.all([
    prisma.searchZone.count({ where: { caseId, searchCount: { gt: 0 } } }).catch(() => 0),
    prisma.searchZoneVisit.findMany({ where: { caseId, outcome: 'SEARCHED' }, select: { searcherId: true } }).catch(() => []),
  ]);
  return { areas, people: (visits || []).map((v) => v.searcherId) };
}
