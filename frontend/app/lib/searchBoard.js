/**
 * The search board's rows: the one place a case's grid is created, its
 * stale claims swept, and its open blocks read. The board's GET route and
 * the job picker (app/lib/jobs.js) both come here, so a pet's page can
 * offer "Walk C4" before anyone has opened the map.
 *
 * The board is streets where the map has them (SearchStreet, the second
 * half of this file): "Sinclair Ave from W 44th St to W 45th St" is a
 * thing a person can find and walk, and C4 is not. The squares remain
 * the board for a place with no named streets, and for the minutes
 * before the streets have been fetched.
 *
 * The geometry is app/lib/searchGrid.js and app/lib/streetWalks.js
 * (pure); this file is the Prisma half.
 */

import prisma from '@/app/lib/prisma';
import { generateGrid, cellLabel, cellPriority, sightingPull, CLAIM_TTL_MS, SIGHTING_PRIORITY_WINDOW_MS } from '@/app/lib/searchGrid';
import { buildWalks, walkTitle, walkMinutes, nearestOnPath, SIGHTING_REACH_METERS } from '@/app/lib/streetWalks';
import { fetchNamedWays, STREET_FETCH_MARGIN_METERS } from '@/app/lib/osmStreets';
import { logEvent } from '@/lib/logging';

const CASE_FOR_GRID = {
  id: true,
  lastSeenLatitude: true,
  lastSeenLongitude: true,
  searchRadius: true,
  sightings: {
    select: { latitude: true, longitude: true, sightedAt: true, createdAt: true },
    orderBy: { sightedAt: 'desc' },
    take: 20,
  },
};

async function createGridForCase(caseData, correlationId) {
  const sightings = (caseData.sightings || [])
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ lat: s.latitude, lng: s.longitude, at: s.sightedAt || s.createdAt }));

  const { radiusMeters, cellSizeMeters, cells } = generateGrid({
    center: { lat: caseData.lastSeenLatitude, lng: caseData.lastSeenLongitude },
    searchRadiusMiles: caseData.searchRadius,
    sightings,
  });

  try {
    const grid = await prisma.searchGrid.create({
      data: {
        caseId: caseData.id,
        centerLatitude: caseData.lastSeenLatitude,
        centerLongitude: caseData.lastSeenLongitude,
        radiusMiles: radiusMeters / 1609.344,
        cellSizeMeters,
        totalCells: cells.length,
        cells: {
          create: cells.map((c) => ({
            row: c.row,
            col: c.col,
            centerLatitude: c.centerLatitude,
            centerLongitude: c.centerLongitude,
            northLat: c.northLat,
            southLat: c.southLat,
            eastLng: c.eastLng,
            westLng: c.westLng,
            priority: c.priority,
          })),
        },
      },
      select: { id: true },
    });

    await logEvent({
      event_type: 'grid.created',
      correlation_id: correlationId,
      resource_type: 'case',
      resource_id: caseData.id,
      action: 'create',
      result: 'success',
      metadata: { cells: cells.length, cellSizeMeters },
    }).catch(() => {});

    return grid;
  } catch (error) {
    // P2002 on caseId: a concurrent first call won the race. Read theirs.
    if (error?.code === 'P2002') return null;
    throw error;
  }
}

/**
 * The case's grid, created on first use. Returns `{ id }`, or null when
 * the case has no last-seen location (nothing to grid), or does not exist.
 */
export async function ensureGrid(caseId, correlationId = null) {
  const caseData = await prisma.case.findUnique({ where: { id: caseId }, select: CASE_FOR_GRID });
  if (!caseData) return null;
  if (caseData.lastSeenLatitude == null || caseData.lastSeenLongitude == null) return null;

  let grid = await prisma.searchGrid.findUnique({ where: { caseId: caseData.id }, select: { id: true } });
  if (!grid) {
    grid =
      (await createGridForCase(caseData, correlationId)) ||
      (await prisma.searchGrid.findUnique({ where: { caseId: caseData.id }, select: { id: true } }));
  }
  return grid;
}

/** Someone claims a block and goes home for dinner: it must not stay theirs all night. */
export async function sweepStaleClaims(gridId, now = Date.now()) {
  await prisma.gridCell.updateMany({
    where: { gridId, status: 'IN_PROGRESS', claimedAt: { lt: new Date(now - CLAIM_TTL_MS) } },
    data: { status: 'UNSEARCHED', claimedById: null, claimedAt: null },
  });
}

/**
 * What nobody is walking, most urgent first: unsearched and worth another
 * look, by the board's priority. Streets where the board has them, each
 * with its name ("Sinclair Ave from W 40th St to W 44th St") and
 * `unit: 'street'`; otherwise the squares, each with its letter name and
 * `unit: 'block'`. The job picker hands these out, so a job on the pet's
 * page is the same street the search map shows.
 */
export async function openBlocks(caseId, { take = 12 } = {}) {
  const grid = await ensureGrid(caseId);
  if (!grid) return [];
  const board = await prisma.searchGrid.findUnique({ where: { id: grid.id }, select: { streetsStatus: true } });
  if (board?.streetsStatus === 'READY') {
    await sweepStaleStreetClaims(caseId);
    const streets = await prisma.searchStreet.findMany({
      where: { caseId, context: false, status: { in: ['UNSEARCHED', 'NEEDS_REVISIT'] } },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }, { id: 'asc' }],
    });
    // The same order the search screen hands streets out in: next to a fresh sighting comes up.
    const seen = await recentSightings(caseId);
    return byUrgency(streets.map((s) => ({ ...s, priority: livePriority(s, seen) })))
      .slice(0, take)
      .map((s) => ({
        id: s.id,
        unit: 'street',
        label: walkTitle(s),
        status: s.status,
        priority: s.priority,
        centerLatitude: s.centerLatitude,
        centerLongitude: s.centerLongitude,
        minutes: walkMinutes(s.meters),
      }));
  }
  // Not fetched yet: start, and hand out squares meanwhile.
  if (!board?.streetsStatus) ensureStreets(caseId).catch(() => {});
  await sweepStaleClaims(grid.id);
  const cells = await prisma.gridCell.findMany({
    where: { gridId: grid.id, status: { in: ['UNSEARCHED', 'NEEDS_REVISIT'] } },
    orderBy: [{ priority: 'desc' }, { row: 'asc' }, { col: 'asc' }],
    take,
    select: {
      id: true,
      row: true,
      col: true,
      status: true,
      priority: true,
      centerLatitude: true,
      centerLongitude: true,
    },
  });
  return cells.map((c) => ({ ...c, unit: 'block', label: cellLabel(c.row, c.col) }));
}

// ---------------------------------------------------------------------------
// Streets
// ---------------------------------------------------------------------------

/** Fewer named streets than this is not a board; the squares serve better. */
const MIN_STREETS = 3;
/** After no map server answers, how long before asking again. Short: a search is short too. */
const STREETS_RETRY_MS = 3 * 60 * 1000;
/** A fetch that never reported back (the process died) is taken over after this. */
const STREETS_PENDING_MS = 90 * 1000;

const GRID_FOR_STREETS = {
  id: true,
  caseId: true,
  centerLatitude: true,
  centerLongitude: true,
  radiusMiles: true,
  streetsStatus: true,
  streetsAt: true,
};

/**
 * The case's streets, fetched from the map once and kept. Resolves to
 * the board's street state: 'READY', 'NONE' (no named streets here),
 * 'PENDING' (another request is fetching them), 'FAILED' (no map server
 * answered; asked again in a few minutes, and SearchGrid.streetsNote says
 * what each server did), or null when the case has no last-seen point. Exactly one caller does the fetch: taking the job
 * is a conditional write, like a claim.
 */
export async function ensureStreets(caseId, { correlationId = null, fetchWays = fetchNamedWays, now = Date.now() } = {}) {
  const made = await ensureGrid(caseId, correlationId);
  if (!made) return null;
  const grid = await prisma.searchGrid.findUnique({ where: { id: made.id }, select: GRID_FOR_STREETS });
  if (!grid) return null;
  if (grid.streetsStatus === 'READY' || grid.streetsStatus === 'NONE') return grid.streetsStatus;
  const age = grid.streetsAt ? now - new Date(grid.streetsAt).getTime() : Infinity;
  if (grid.streetsStatus === 'PENDING' && age < STREETS_PENDING_MS) return 'PENDING';
  if (grid.streetsStatus === 'FAILED' && age < STREETS_RETRY_MS) return 'FAILED';

  const mine = await prisma.searchGrid.updateMany({
    where: {
      id: grid.id,
      OR: [
        { streetsStatus: null },
        { streetsStatus: 'FAILED', streetsAt: { lt: new Date(now - STREETS_RETRY_MS) } },
        { streetsStatus: 'PENDING', streetsAt: { lt: new Date(now - STREETS_PENDING_MS) } },
      ],
    },
    data: { streetsStatus: 'PENDING', streetsAt: new Date(now) },
  });
  if (mine.count === 0) return 'PENDING';

  const center = { lat: grid.centerLatitude, lng: grid.centerLongitude };
  const radiusMeters = grid.radiusMiles * 1609.344;
  let status = 'FAILED';
  let count = 0;
  let failure = null;
  try {
    const [ways, sightings] = await Promise.all([
      fetchWays({ lat: center.lat, lng: center.lng, radiusMeters }),
      prisma.caseSighting.findMany({
        where: { missionId: caseId },
        orderBy: { sightedAt: 'desc' },
        take: 20,
        select: { latitude: true, longitude: true, sightedAt: true, createdAt: true },
      }),
    ]);
    const walks = buildWalks({
      ways,
      center,
      radiusMeters,
      // The ring the fetch already reaches past the board, kept for naming places near the edge.
      contextMeters: STREET_FETCH_MARGIN_METERS,
      sightings: sightings
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({ lat: s.latitude, lng: s.longitude, at: s.sightedAt || s.createdAt })),
      now,
    });
    if (walks.filter((w) => !w.context).length < MIN_STREETS) {
      status = 'NONE';
    } else {
      // A retry after a half-written attempt starts clean.
      await prisma.searchStreet.deleteMany({ where: { caseId } });
      await prisma.searchStreet.createMany({
        data: walks.map((w) => ({
          caseId,
          name: w.name,
          fromName: w.fromName,
          toName: w.toName,
          path: JSON.stringify(w.path),
          meters: w.meters,
          centerLatitude: w.centerLatitude,
          centerLongitude: w.centerLongitude,
          priority: w.priority,
          context: Boolean(w.context),
        })),
      });
      status = 'READY';
      count = walks.filter((w) => !w.context).length;
    }
  } catch (error) {
    failure = String(error?.note || error?.message || error).slice(0, 300);
  }
  await prisma.searchGrid.update({ where: { id: grid.id }, data: { streetsStatus: status, streetsAt: new Date(), streetsNote: status === 'FAILED' ? failure : null } });
  await logEvent({
    event_type: status === 'FAILED' ? 'streets.fetch_failed' : 'streets.created',
    correlation_id: correlationId,
    resource_type: 'case',
    resource_id: caseId,
    action: 'create',
    result: status === 'FAILED' ? 'failure' : 'success',
    error_message: failure,
    metadata: { status, streets: count },
  }).catch(() => {});
  return status;
}

/**
 * A street nobody has reported back on in an hour and a half is free
 * again. One that had been walked before goes back to searched, not to
 * never searched: giving up a second pass does not erase the first.
 */
export async function sweepStaleStreetClaims(caseId, now = Date.now()) {
  const stale = { caseId, context: false, status: 'IN_PROGRESS', claimedAt: { lt: new Date(now - CLAIM_TTL_MS) } };
  const free = { claimedById: null, claimedByName: null, claimedAt: null };
  await prisma.searchStreet.updateMany({ where: { ...stale, searchCount: 0 }, data: { ...free, status: 'UNSEARCHED' } });
  await prisma.searchStreet.updateMany({ where: { ...stale, searchCount: { gt: 0 } }, data: { ...free, status: 'SEARCHED' } });
}

/**
 * One street as the board sends it. `viewer` is the searcher id of whoever
 * is asking (app/lib/searcher.js), so their own street says so. Names of
 * the people holding streets go only to those the caller says may see
 * them: anyone with the link sees streets, not people.
 */
export function streetForBoard(row, { viewer = null, withNames = false } = {}) {
  let path = [];
  try {
    path = JSON.parse(row.path);
  } catch {
    path = [];
  }
  return {
    id: row.id,
    name: row.name,
    fromName: row.fromName,
    toName: row.toName,
    title: walkTitle(row),
    path,
    meters: row.meters,
    minutes: walkMinutes(row.meters),
    center: { lat: row.centerLatitude, lng: row.centerLongitude },
    priority: row.priority,
    // The owner or a lead asked for it first: the next people are sent here before anywhere else.
    first: row.priority >= FIRST_PRIORITY,
    status: row.status,
    claimedAt: row.claimedAt,
    searchedAt: row.searchedAt,
    searchCount: row.searchCount,
    // Put down as walked from the desk, for someone who walked it without the site.
    marked: isMark(row.searchedById),
    mine: Boolean(viewer && row.claimedById === viewer),
    ...(withNames ? { claimedByName: row.claimedById ? row.claimedByName || 'A helper' : null, searchedByName: row.searchedByName || null } : {}),
  };
}

/**
 * The priority a street or a square is asked for first with. The search
 * itself ranks from 1 to 10 (app/lib/searchGrid.js), so anything above is
 * a person's doing: the owner, or someone leading a force that is
 * looking, sending the next helpers there before anywhere else.
 */
export const FIRST_PRIORITY = 11;

/** "m:" and a user id: walked by someone off the site, and put down by that user. Not a person out searching. */
const MARK = 'm:';
export const isMark = (id) => typeof id === 'string' && id.startsWith(MARK);

/** The sightings of the last three days, as the priority rule reads them. One a witness took back does not count. */
export async function recentSightings(caseId, now = Date.now()) {
  const rows = await prisma.caseSighting
    .findMany({
      where: { missionId: caseId, sightedAt: { gte: new Date(now - SIGHTING_PRIORITY_WINDOW_MS) }, OR: [{ witnessState: null }, { witnessState: { not: 'NOT_THE_PET' } }] },
      select: { latitude: true, longitude: true, sightedAt: true },
    })
    .catch(() => []);
  return (rows || []).map((r) => ({ lat: r.latitude, lng: r.longitude, at: r.sightedAt }));
}

/**
 * A street's priority as it stands now: what the board stored, pulled up
 * by any fresh sighting next to it. "Next to" is measured from the street's
 * own line where the row carries one, so the street the pet was seen on
 * comes first however long it is; a square is measured from its middle.
 */
export function livePriority(row, sightings, now = Date.now()) {
  if (!sightings?.length) return row.priority;
  let path = null;
  if (typeof row.path === 'string') {
    try {
      path = JSON.parse(row.path);
    } catch {
      path = null;
    }
  }
  const middle = { lat: row.centerLatitude, lng: row.centerLongitude };
  let pull = 0;
  for (const s of sightings) {
    if (typeof s?.lat !== 'number' || typeof s?.lng !== 'number') continue;
    const on = path && path.length > 1 ? nearestOnPath(s, path) : null;
    const center = on && on.lat != null ? { lat: on.lat, lng: on.lng } : middle;
    pull = Math.max(pull, sightingPull({ center, sightings: [s], cellSizeMeters: SIGHTING_REACH_METERS, now }));
  }
  return Math.max(row.priority, pull);
}

const byUrgency = (rows) => [...rows].sort((a, b) => b.priority - a.priority || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || (a.id < b.id ? -1 : 1));

/**
 * The streets of a case's board, most urgent first, or null when the
 * board is not on streets (not fetched yet, none on the map, or no
 * last-seen point). Sweeps stale claims on the way, like the squares do.
 */
export async function readStreets(caseId, { viewer = null, withNames = false } = {}) {
  const grid = await prisma.searchGrid.findUnique({ where: { caseId }, select: { streetsStatus: true } });
  if (grid?.streetsStatus !== 'READY') return null;
  await sweepStaleStreetClaims(caseId);
  const rows = await prisma.searchStreet.findMany({
    where: { caseId, context: false },
    orderBy: [{ priority: 'desc' }, { name: 'asc' }, { id: 'asc' }],
  });
  if (!rows.length) return null;
  // A board's priorities are worked out when it is made. Sightings come later, so they are applied here, on
  // every read: the streets next to a fresh sighting move up the order with nothing rewritten.
  const seen = await recentSightings(caseId);
  return byUrgency(rows.map((row) => ({ ...row, priority: livePriority(row, seen) }))).map((row) => streetForBoard(row, { viewer, withNames }));
}

/**
 * The streets in the ring just outside the board: names and lines only,
 * for calling a place by its corner and a direction by its street. They
 * carry no state, because nobody is ever sent to walk them.
 */
export async function readStreetsAround(caseId) {
  const rows = await prisma.searchStreet.findMany({
    where: { caseId, context: true },
    select: { name: true, fromName: true, toName: true, path: true },
  });
  return rows.map((row) => {
    let path = [];
    try {
      path = JSON.parse(row.path);
    } catch {
      path = [];
    }
    return { name: row.name, fromName: row.fromName, toName: row.toName, path };
  });
}

/**
 * The squares of a case's board as the board sends them, for a place
 * with no streets. The same rule on names: `withNames` only for the
 * owner and the forces looking for the pet.
 */
export async function readCells(caseId, { viewer = null, withNames = false } = {}) {
  const grid = await prisma.searchGrid.findUnique({ where: { caseId }, select: { id: true } });
  if (!grid) return [];
  await sweepStaleClaims(grid.id);
  const cells = await prisma.gridCell.findMany({
    where: { gridId: grid.id },
    orderBy: [{ row: 'asc' }, { col: 'asc' }],
    select: {
      id: true, row: true, col: true, centerLatitude: true, centerLongitude: true,
      northLat: true, southLat: true, eastLng: true, westLng: true,
      status: true, priority: true, claimedById: true, claimedAt: true, searchedAt: true, searchCount: true, searchedByKey: true,
    },
  });
  // Who holds a square, and who walked it or put it down as walked: first names, and only for those who may see
  // them. A helper with no account is known by the name they joined with.
  let nameOf = () => null;
  if (withNames) {
    const who = (key) => (key ? (isMark(key) ? key.slice(MARK.length) : key) : null);
    const keys = [...new Set(cells.flatMap((c) => [c.claimedById, who(c.searchedByKey)]).filter(Boolean))];
    const userIds = keys.filter((id) => !id.startsWith('v:'));
    const helperIds = keys.filter((id) => id.startsWith('v:')).map((id) => id.slice(2));
    const [users, helpers] = await Promise.all([
      userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true } }) : [],
      helperIds.length ? prisma.missionVolunteer.findMany({ where: { id: { in: helperIds } }, select: { id: true, displayName: true } }) : [],
    ]);
    const names = Object.fromEntries([...(users || []).map((u) => [u.id, u.firstName]), ...(helpers || []).map((h) => [`v:${h.id}`, h.displayName])]);
    nameOf = (key) => (key ? String(names[who(key)] || '').trim().split(/\s+/)[0] || 'A helper' : null);
  }
  return cells.map(({ claimedById, searchedByKey, ...c }) => ({
    ...c,
    first: c.priority >= FIRST_PRIORITY,
    marked: isMark(searchedByKey),
    label: cellLabel(c.row, c.col),
    title: `Block ${cellLabel(c.row, c.col)}`,
    center: { lat: c.centerLatitude, lng: c.centerLongitude },
    minutes: 20,
    mine: Boolean(viewer && claimedById === viewer),
    ...(withNames ? { claimedByName: nameOf(claimedById), searchedByName: nameOf(searchedByKey) } : {}),
  }));
}

const CLAIMABLE = ['UNSEARCHED', 'IN_PROGRESS', 'NEEDS_REVISIT', 'SEARCHED'];
export const BOARD_ACTIONS = ['claim', 'release', 'searched'];
/**
 * Steering, from the desk: the owner, or someone leading a force that is
 * looking, decides where the next helpers go and records ground covered
 * off the site. None of these is going out to search, so none needs the
 * waiver, and none is open to someone who only joined a force.
 *
 *   first   send the next people here before anywhere else
 *   normal  take that back: the street returns to its place in the order
 *   walked  put it down as walked, for someone who walked it without the site
 *   again   a walked street needs another look, and is handed out again
 */
export const STEER_ACTIONS = ['first', 'normal', 'walked', 'again'];

/**
 * The three verbs of the board: claim, release, searched, on a street or
 * (where the board has no streets) a square. `searcher` is who is doing
 * it (app/lib/searcher.js): someone signed in, or a helper who joined
 * without an account.
 *
 * A claim is a CONDITIONAL WRITE, the same discipline as the squares'
 * own route: two people tap the same street, the database picks one, and
 * the other is told in words. One job per person: taking a street gives
 * back whatever they held.
 *
 * Returns { item } (the row as the board sends it, for this searcher) or
 * { error: 'NOT_FOUND' | 'TAKEN' | 'NOT_YOURS' | 'NOT_CLAIMED', title }.
 */
export async function actOnBoard({ caseId, unit, id, action, searcher, now = Date.now() }) {
  const streets = unit === 'street';
  const grid = await prisma.searchGrid.findUnique({ where: { caseId }, select: { id: true } });
  if (!grid) return { error: 'NOT_FOUND', title: null };
  const model = streets ? prisma.searchStreet : prisma.gridCell;
  // A street of the ring outside the board is not a street of the board: it cannot be taken.
  const scope = streets ? { caseId, context: false } : { gridId: grid.id };
  const before = await model.findFirst({ where: { id, ...scope } });
  if (!before) return { error: 'NOT_FOUND', title: null };
  const title = streets ? walkTitle(before) : `Block ${cellLabel(before.row, before.col)}`;
  const me = searcher.id;
  const free = { claimedById: null, claimedAt: null, ...(streets ? { claimedByName: null } : {}) };

  // The place the search itself gives this street or square: by how far it is from where the pet was lost.
  // (Sightings are applied on every read, so they are not part of what is stored.)
  const backToItsPlace = async () => {
    const board = await prisma.searchGrid.findUnique({ where: { id: grid.id }, select: { centerLatitude: true, centerLongitude: true, radiusMiles: true, cellSizeMeters: true } });
    const natural = cellPriority({
      center: { lat: before.centerLatitude, lng: before.centerLongitude },
      lastSeen: { lat: board.centerLatitude, lng: board.centerLongitude },
      radiusMeters: board.radiusMiles * 1609.344,
      cellSizeMeters: streets ? SIGHTING_REACH_METERS : board.cellSizeMeters,
      now,
    });
    await model.update({ where: { id }, data: { priority: natural } });
  };
  // Asked for first, and now walked: the ask is met, so the next people are not sent to it ahead of everything again.
  const askMet = () => (before.priority >= FIRST_PRIORITY ? backToItsPlace().catch(() => {}) : null);

  if (STEER_ACTIONS.includes(action)) {
    if (!searcher.leads) return { error: 'NOT_ALLOWED', title };
    if (action === 'first') {
      // A walked street that is asked for first is, by that, due another look.
      await model.update({ where: { id }, data: { priority: FIRST_PRIORITY, ...(before.status === 'SEARCHED' ? { status: 'NEEDS_REVISIT' } : {}) } });
    } else if (action === 'normal') {
      await backToItsPlace();
    } else if (action === 'walked') {
      // Someone holding it marks it themselves. This is for a street nobody on the site is on.
      const marked = await model.updateMany({
        where: { id, ...scope, status: { in: ['UNSEARCHED', 'NEEDS_REVISIT'] } },
        data: {
          status: 'SEARCHED',
          searchedAt: new Date(now),
          searchCount: { increment: 1 },
          ...(streets ? { searchedById: `${MARK}${searcher.userId}`, searchedByName: searcher.firstName } : { searchedById: null, searchedByKey: `${MARK}${searcher.userId}` }),
        },
      });
      if (marked.count === 0) return { error: before.status === 'IN_PROGRESS' ? 'SOMEONE_ON_IT' : 'ALREADY_WALKED', title };
      await askMet();
      await prisma.searchGrid.update({ where: { id: grid.id }, data: { lastActivityAt: new Date(now), ...(streets ? {} : { cellsSearched: { increment: 1 } }) } }).catch(() => {});
    } else {
      const again = await model.updateMany({ where: { id, ...scope, status: 'SEARCHED' }, data: { status: 'NEEDS_REVISIT' } });
      if (again.count === 0) return { error: 'NOT_WALKED', title };
    }
  } else if (action === 'claim') {
    const held = { claimedById: me, status: 'IN_PROGRESS' };
    await prisma.searchStreet.updateMany({ where: { caseId, ...held, searchCount: 0, NOT: { id } }, data: { claimedById: null, claimedByName: null, claimedAt: null, status: 'UNSEARCHED' } });
    await prisma.searchStreet.updateMany({ where: { caseId, ...held, searchCount: { gt: 0 }, NOT: { id } }, data: { claimedById: null, claimedByName: null, claimedAt: null, status: 'SEARCHED' } });
    await prisma.gridCell.updateMany({ where: { gridId: grid.id, ...held, NOT: { id } }, data: { claimedById: null, claimedAt: null, status: 'UNSEARCHED' } });
    const won = await model.updateMany({
      where: {
        id,
        ...scope,
        OR: [{ claimedById: null }, { claimedById: me }, { claimedAt: { lt: new Date(now - CLAIM_TTL_MS) } }],
        // Searched is claimable too: a pet moves, and a street walked three
        // hours ago is worth walking again.
        status: { in: CLAIMABLE },
      },
      data: { status: 'IN_PROGRESS', claimedById: me, claimedAt: new Date(now), ...(streets ? { claimedByName: searcher.firstName } : {}) },
    });
    if (won.count === 0) return { error: 'TAKEN', title };
  } else if (action === 'release') {
    const mine = { id, ...scope, claimedById: me };
    const fresh = await model.updateMany({ where: { ...mine, searchCount: 0 }, data: { ...free, status: 'UNSEARCHED' } });
    const again = await model.updateMany({ where: { ...mine, searchCount: { gt: 0 } }, data: { ...free, status: 'SEARCHED' } });
    if (fresh.count + again.count === 0) return { error: 'NOT_YOURS', title };
  } else if (action === 'searched') {
    // Only the holder can mark it: "searched" means someone walked it.
    const marked = await model.updateMany({
      where: { id, ...scope, claimedById: me, status: 'IN_PROGRESS' },
      data: {
        ...free,
        status: 'SEARCHED',
        searchedAt: new Date(now),
        searchCount: { increment: 1 },
        // A square's searchedById points at an account, so a helper without one is kept in searchedByKey.
        ...(streets ? { searchedById: me, searchedByName: searcher.firstName } : { searchedById: searcher.userId, searchedByKey: me }),
      },
    });
    if (marked.count === 0) return { error: 'NOT_CLAIMED', title };
    await askMet();
    await prisma.searchGrid
      .update({ where: { id: grid.id }, data: { lastActivityAt: new Date(now), ...(streets ? {} : { cellsSearched: { increment: 1 } }) } })
      .catch(() => {});
  } else {
    return { error: 'NOT_FOUND', title };
  }

  const after = await model.findFirst({ where: { id, ...scope } });
  if (streets) return { item: streetForBoard(after, { viewer: me, withNames: searcher.seesNames }), title };
  return {
    item: {
      id: after.id,
      label: cellLabel(after.row, after.col),
      title,
      status: after.status,
      priority: after.priority,
      first: after.priority >= FIRST_PRIORITY,
      claimedAt: after.claimedAt,
      searchedAt: after.searchedAt,
      searchCount: after.searchCount,
      marked: isMark(after.searchedByKey),
      mine: after.claimedById === me,
    },
    title,
  };
}
