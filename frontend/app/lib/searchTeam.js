/**
 * The people on one pet's search, for the desk (Mission Control on a
 * computer): who joined, what each is doing right now, and what each has
 * done. It is how the person running the search (the owner) gives a
 * named person a street or sends them a word.
 *
 * It is built from what the search already holds: the helpers who joined
 * from the share link without an account (MissionVolunteer), whoever
 * holds, walked or was asked to walk a street or a square, and whoever
 * the desk has exchanged a word with. That last part matters: someone who
 * wrote to the desk has to be someone the owner can answer, and someone
 * the owner wrote to has to be able to write back, whatever has become of
 * their street since. Nobody is listed for having only looked at the page.
 *
 * Names are for the owner and the forces looking for the pet, like every
 * name on the board (app/lib/searcher.js, `seesNames`), so this is read
 * only for them. And a person is never handed out by their id: the desk
 * knows each one by a handle that means something only for this pet
 * (`handleFor`), so the id a helper proves themselves with never leaves
 * the server.
 */
import crypto from 'crypto';
import prisma from '@/app/lib/prisma';
import { walkTitle } from '@/app/lib/streetWalks';
import { cellLabel } from '@/app/lib/searchGrid';
import { firstWord, NAME_MAX } from '@/app/lib/searchText';

export { NAME_MAX };

/** An ask keeps a street for the person asked this long. After it, anyone can be given the street. */
export const ASK_HOLD_MS = 30 * 60 * 1000;

const MARK = 'm:';

function secret() {
  // The site's own secret, under either of the names sign-in reads it by. Without one (a local run with no
  // setup) nobody is signed in, so no handle is ever sent; the constant only keeps the function total.
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'reunitepets-local';
}

/** What the desk calls a person, for one pet. The same person on another pet's search has another handle. */
export function handleFor(caseId, id) {
  return crypto.createHmac('sha256', secret()).update(`${caseId}:${id}`).digest('base64url').slice(0, 16);
}

/** Whether an ask still keeps its street for the person asked. */
export function askHolds(askedAt, now = Date.now()) {
  return Boolean(askedAt) && now - new Date(askedAt).getTime() < ASK_HOLD_MS;
}

/**
 * Pure: the roster from rows already read. `helpers` are MissionVolunteer
 * rows ({ id, displayName, joinedAt, userId }), `streets` and `cells` the
 * board's rows, `ownerId` the pet's reporter (the owner runs the search
 * and is not one of the people helping it), `users` a map of user id to
 * first name for anyone the rows do not already name, `messages` the
 * search's messages ({ fromId, fromName, fromDesk, toId, toName }).
 *
 * A search on areas of ground (app/lib/searchZones.js) passes `zones`:
 * each { id, name, visits: [{ searcherId, searcherName, askedAt,
 * askedSeenAt, askedNote, askedByName, startedAt, endedAt, outcome }] }.
 * A person is then on an area ({ unit: 'area' }), asked to search one, or
 * free, and `walked` counts the areas they searched. `known` is anyone
 * else to list by name alone ({ id, name }): people who walked a street
 * before the search was on areas.
 *
 * Each person: { id, handle, name, kind: 'helper' | 'member', joinedAt,
 * state: 'walking' | 'asked' | 'free', on: { unit, id, title } | null,
 * since, asked: { id, title, at, seenAt, note, byName, holds } | null,
 * walked, lastWalkedAt, lastOn: { unit, id, title } | null }. `id` is for
 * the server only: `forDesk` drops it.
 */
export function roster({ caseId, helpers = [], streets = [], cells = [], zones = [], known = [], messages = [], ownerId = null, users = {}, now = Date.now() }) {
  const people = new Map();
  const person = (id, name) => {
    if (!id || id === ownerId || String(id).startsWith(MARK)) return null;
    if (!people.has(id)) {
      people.set(id, { id, handle: handleFor(caseId, id), name: '', kind: String(id).startsWith('v:') ? 'helper' : 'member', joinedAt: null, state: 'free', on: null, since: null, asked: null, walked: 0, lastWalkedAt: null, lastOn: null });
    }
    const p = people.get(id);
    if (!p.name && name) p.name = firstWord(name);
    return p;
  };
  const later = (a, b) => (!a ? b : !b ? a : new Date(a) > new Date(b) ? a : b);

  for (const h of helpers) {
    // Someone signed in who also joined from the link is one person: the account.
    const p = person(h.userId || `v:${h.id}`, h.displayName);
    if (p) p.joinedAt = h.joinedAt || null;
  }
  const visit = (row, unit, title, searchedKey) => {
    if (row.status === 'IN_PROGRESS' && row.claimedById) {
      const p = person(row.claimedById, row.claimedByName);
      if (p) {
        p.state = 'walking';
        p.on = { unit, id: row.id, title };
        p.since = row.claimedAt || null;
      }
    }
    if (searchedKey && row.searchCount > 0) {
      const p = person(searchedKey, row.searchedByName);
      if (p) {
        p.walked += 1;
        const newest = later(p.lastWalkedAt, row.searchedAt);
        // The street they walked last: it is the nearest thing to where they are that the search knows.
        if (newest !== p.lastWalkedAt || !p.lastOn) p.lastOn = { unit, id: row.id, title };
        p.lastWalkedAt = newest;
      }
    }
    if (row.askedOfId) {
      const p = person(row.askedOfId, row.askedOfName);
      if (p) p.asked = { id: row.id, title, at: row.askedAt || null, seenAt: row.askedSeenAt || null, note: row.askedNote || '', byName: firstWord(row.askedByName), holds: askHolds(row.askedAt, now) };
    }
  };
  for (const s of streets) visit(s, 'street', walkTitle(s), s.searchedById);
  for (const c of cells) visit(c, 'block', `Block ${cellLabel(c.row, c.col)}`, c.searchedByKey || c.searchedById);
  // Areas of ground: several people can be on one, so who is where is kept per person and area.
  for (const z of zones) {
    const place = { unit: 'area', id: z.id, title: z.name };
    for (const v of z.visits || []) {
      const p = person(v.searcherId, v.searcherName);
      if (!p) continue;
      if (v.startedAt && !v.endedAt) {
        p.state = 'walking';
        p.on = place;
        p.since = v.startedAt;
      }
      if (v.outcome === 'SEARCHED' && v.endedAt) {
        p.walked += 1;
        const newest = later(p.lastWalkedAt, v.endedAt);
        if (newest !== p.lastWalkedAt || !p.lastOn) p.lastOn = place;
        p.lastWalkedAt = newest;
      }
      // Asked, and still asked while they are on what was asked: the desk reads asked, seen, started.
      if (v.askedAt && !v.endedAt) p.asked = { id: z.id, title: z.name, at: v.askedAt, seenAt: v.askedSeenAt || null, note: v.askedNote || '', byName: firstWord(v.askedByName), holds: askHolds(v.askedAt, now) };
    }
  }
  for (const k of known) person(k.id, k.name);
  // Everyone the desk has exchanged a word with stays someone it can write to and hear from.
  for (const m of messages) {
    if (!m.fromDesk) person(m.fromId, m.fromName);
    if (m.toId) person(m.toId, m.toName);
  }

  const order = { free: 0, asked: 1, walking: 2 };
  return [...people.values()]
    .map((p) => {
      // Someone asked who has not started is "asked"; someone walking the street they were asked for is walking.
      const state = p.state === 'walking' ? 'walking' : p.asked ? 'asked' : 'free';
      return { ...p, state, name: p.name || firstWord(users[p.id]) || 'A helper' };
    })
    .sort((a, b) => order[a.state] - order[b.state] || new Date(b.joinedAt || b.lastWalkedAt || b.since || 0) - new Date(a.joinedAt || a.lastWalkedAt || a.since || 0) || (a.handle < b.handle ? -1 : 1));
}

/**
 * A person as a desk is sent them: by handle, never by id. The note on an
 * ask is the asker's word to one person, so it goes only to whoever runs
 * the search (`notes`). A member of a Rescue Force that is looking sees
 * that someone was asked, for which street and when, and not what was said.
 */
export function forDesk({ id, ...person }, { notes = false } = {}) {
  if (notes || !person.asked) return person;
  const { note, byName, ...asked } = person.asked;
  return { ...person, asked };
}

/**
 * The roster of a pet's search, read from the database. For callers who
 * have already checked that the viewer may see names.
 */
export async function teamOf(caseId, { ownerId = null, now = Date.now() } = {}) {
  const [helpers, messages, streets, grid, zones] = await Promise.all([
    prisma.missionVolunteer.findMany({ where: { mission: { caseId } }, select: { id: true, displayName: true, joinedAt: true, userId: true } }),
    // The newest few hundred are plenty to know who the desk has talked with.
    prisma.searchMessage.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' }, take: 300, select: { fromId: true, fromName: true, fromDesk: true, toId: true, toName: true } }),
    prisma.searchStreet.findMany({
      where: { caseId, context: false },
      select: {
        id: true, name: true, fromName: true, toName: true, status: true,
        claimedById: true, claimedByName: true, claimedAt: true,
        searchedById: true, searchedByName: true, searchedAt: true, searchCount: true,
        askedOfId: true, askedOfName: true, askedByName: true, askedAt: true, askedSeenAt: true, askedNote: true,
      },
    }),
    prisma.searchGrid.findUnique({
      where: { caseId },
      select: { streetsStatus: true, cells: { where: { OR: [{ status: 'IN_PROGRESS' }, { searchCount: { gt: 0 } }] }, select: { id: true, row: true, col: true, status: true, claimedById: true, claimedAt: true, searchedById: true, searchedByKey: true, searchedAt: true, searchCount: true } } },
    }),
    // The areas of the search and everyone who was asked for one, is on one or searched one. The newest few
    // hundred visits are plenty to know who is doing what.
    prisma.searchZone.findMany({
      where: { caseId },
      select: {
        id: true,
        name: true,
        visits: {
          orderBy: { createdAt: 'asc' },
          take: 300,
          select: { searcherId: true, searcherName: true, askedAt: true, askedSeenAt: true, askedNote: true, askedByName: true, startedAt: true, endedAt: true, outcome: true },
        },
      },
    }),
  ]);
  if (zones.length) return areaTeam({ caseId, helpers, messages, streets, cells: grid?.cells || [], zones, ownerId, now });
  const cells = grid?.cells || [];
  // Squares keep no name beside a claim, and a street's row names only its own: anyone still unnamed is looked up.
  const named = new Set([...helpers.map((h) => h.userId || `v:${h.id}`), ...streets.flatMap((s) => [s.claimedByName && s.claimedById, s.searchedByName && s.searchedById, s.askedOfName && s.askedOfId]), ...messages.flatMap((m) => [m.fromName && m.fromId, m.toName && m.toId])].filter(Boolean));
  const unnamed = [...new Set(cells.flatMap((c) => [c.claimedById, c.searchedByKey || c.searchedById]).filter((id) => id && !String(id).startsWith('v:') && !String(id).startsWith(MARK) && !named.has(id)))];
  const rows = unnamed.length ? await prisma.user.findMany({ where: { id: { in: unnamed } }, select: { id: true, firstName: true } }) : [];
  const users = Object.fromEntries((rows || []).map((u) => [u.id, u.firstName]));
  return roster({ caseId, helpers, streets, cells, messages, ownerId, users, now });
}

/**
 * The roster of a search that is on areas. What each person is doing comes
 * from the areas alone. Streets and squares from before the search was on
 * areas say only who was here: a street someone held then is not something
 * they are on now.
 */
async function areaTeam({ caseId, helpers, messages, streets, cells, zones, ownerId, now }) {
  const before = [
    ...streets.flatMap((s) => [
      { id: s.claimedById, name: s.claimedByName },
      { id: s.searchedById, name: s.searchedByName },
      { id: s.askedOfId, name: s.askedOfName },
    ]),
    ...cells.flatMap((c) => [{ id: c.claimedById, name: null }, { id: c.searchedByKey || c.searchedById, name: null }]),
  ].filter((k) => k.id && !String(k.id).startsWith(MARK));
  const named = new Set(
    [
      ...helpers.map((h) => h.userId || `v:${h.id}`),
      ...before.filter((k) => k.name).map((k) => k.id),
      ...zones.flatMap((z) => z.visits.filter((v) => v.searcherName).map((v) => v.searcherId)),
      ...messages.flatMap((m) => [m.fromName && m.fromId, m.toName && m.toId]),
    ].filter(Boolean)
  );
  const unnamed = [...new Set(before.map((k) => k.id).filter((id) => !String(id).startsWith('v:') && !named.has(id)))];
  const rows = unnamed.length ? await prisma.user.findMany({ where: { id: { in: unnamed } }, select: { id: true, firstName: true } }) : [];
  const users = Object.fromEntries((rows || []).map((u) => [u.id, u.firstName]));
  return roster({ caseId, helpers, zones, known: before, messages, ownerId, users, now });
}

/** The person a handle stands for on this pet's search, or null. */
export async function personByHandle(caseId, handle, options = {}) {
  if (!handle || typeof handle !== 'string') return null;
  const team = await teamOf(caseId, options);
  return team.find((p) => p.handle === handle) || null;
}
