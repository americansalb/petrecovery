/**
 * Asking one named person to walk one street.
 *
 * A search hands streets out by itself: whoever asks is given the most
 * urgent one near them. An ask is the person running the search stepping
 * in: "Jo, walk W 42nd St", with a word of their own if they have one.
 * The street is kept for that person for half an hour (ASK_HOLD_MS), it
 * becomes the card on their phone with one button, and the desk sees it
 * asked, then seen (their phone says when it has shown the card), then
 * walked.
 *
 * It is for whoever runs the search to do (`searcher.leads`: the owner),
 * like the rest of steering (app/lib/searchBoard.js). The person asked
 * can say they cannot, which gives the street back and says so in their
 * own word.
 *
 * Streets only. Where a search is on squares they are given out as people
 * ask, and a word to a person still reaches them (app/lib/searchTalk.js).
 */
import prisma from '@/app/lib/prisma';
import { walkTitle } from '@/app/lib/streetWalks';
import { ASK_HOLD_MS, askHolds, handleFor } from '@/app/lib/searchTeam';
import { cleanWord } from '@/app/lib/searchTalk';
import { cut } from '@/app/lib/searchText';

export const ASK_NOTE_MAX = 140;
/** What the asked person's button says, and so what the desk is told in their name when they press it. */
export const CANNOT_WORDS = "I can't right now.";

const OPEN = ['UNSEARCHED', 'NEEDS_REVISIT'];
const NO_ASK = { askedOfId: null, askedOfName: null, askedById: null, askedByName: null, askedAt: null, askedSeenAt: null, askedNote: null };

/** The fields that clear an ask, for the board's own writes (a street walked, given back, or put down as walked). */
export const clearAsk = () => ({ ...NO_ASK });

/**
 * Ask `person` ({ id, name }, from the roster) to walk a street. Returns
 * { street } or { error: 'NOT_FOUND' | 'NOT_OPEN' | 'ASKED_ALREADY' |
 * 'NOT_ALLOWED', title }. One ask to a person: asking them for another
 * street takes the first one back.
 */
export async function askStreet({ caseId, streetId, person, searcher, note = '', now = Date.now() }) {
  if (!searcher?.leads) return { error: 'NOT_ALLOWED', title: null };
  const street = await prisma.searchStreet.findFirst({ where: { id: String(streetId), caseId, context: false } });
  if (!street) return { error: 'NOT_FOUND', title: null };
  const title = walkTitle(street);
  if (!OPEN.includes(street.status)) return { error: 'NOT_OPEN', title };

  const asked = await prisma.searchStreet.updateMany({
    where: {
      id: street.id,
      caseId,
      context: false,
      status: { in: OPEN },
      // Free to ask for: nobody was asked, this person was, or the ask before has lapsed.
      OR: [{ askedOfId: null }, { askedOfId: person.id }, { askedAt: { lt: new Date(now - ASK_HOLD_MS) } }],
    },
    data: {
      askedOfId: person.id,
      askedOfName: person.name,
      askedById: searcher.userId,
      askedByName: searcher.firstName,
      askedAt: new Date(now),
      askedSeenAt: null,
      askedNote: cut(cleanWord(note).replace(/\n+/g, ' '), ASK_NOTE_MAX) || null,
    },
  });
  if (asked.count === 0) {
    // Said from what the street is now: since it was read someone may have taken it, which is not "someone else was asked".
    const current = await prisma.searchStreet.findFirst({ where: { id: street.id }, select: { status: true } });
    return { error: current && !OPEN.includes(current.status) ? 'NOT_OPEN' : 'ASKED_ALREADY', title };
  }
  // One ask to a person at a time: any street they were asked for before this one goes back to the search. Only
  // the ones before it: two asks made in the same moment must not each take the other back and leave the person none.
  await prisma.searchStreet.updateMany({ where: { caseId, askedOfId: person.id, NOT: { id: street.id }, askedAt: { lt: new Date(now) } }, data: clearAsk() });
  return { street: await prisma.searchStreet.findFirst({ where: { id: street.id } }), title };
}

/** Take back whatever this person was asked to walk. Returns how many asks were taken back. */
export async function unaskPerson({ caseId, person, searcher }) {
  if (!searcher?.leads) return { error: 'NOT_ALLOWED' };
  // A street they have already started is theirs: it is not taken from under them.
  const { count } = await prisma.searchStreet.updateMany({ where: { caseId, askedOfId: person.id, status: { in: OPEN } }, data: clearAsk() });
  return { count };
}

/**
 * The person asked says they cannot. The street goes back to the search,
 * and the desk is told in the words of the button they pressed. Returns
 * { title } or { error: 'NO_ASK' }.
 */
export async function cannotWalk({ caseId, searcher }) {
  const street = await prisma.searchStreet.findFirst({ where: { caseId, context: false, askedOfId: searcher.id, status: { in: OPEN } } });
  if (!street) return { error: 'NO_ASK' };
  // Written only if this is the request that gave it back: pressed twice, the desk is told once.
  const { count } = await prisma.searchStreet.updateMany({ where: { id: street.id, askedOfId: searcher.id, status: { in: OPEN } }, data: clearAsk() });
  if (count === 0) return { error: 'NO_ASK' };
  // The words are the button's. Which street they are about is kept beside them, since the person did not type it.
  await prisma.searchMessage.create({ data: { caseId, fromId: searcher.id, fromName: searcher.firstName, fromDesk: false, toId: null, toName: null, text: CANNOT_WORDS, about: walkTitle(street) } }).catch(() => null);
  return { title: walkTitle(street) };
}

/** The id of the street this person was asked to walk and has not started, or null. */
export async function askWaitingFor(caseId, searcherId) {
  if (!searcherId) return null;
  const street = await prisma.searchStreet.findFirst({ where: { caseId, context: false, askedOfId: searcherId, status: { in: OPEN } }, select: { id: true } });
  return street?.id || null;
}

/**
 * The asked person's screen has shown the ask, which is when the desk sees
 * "seen". The screen says so itself (PATCH .../message): reading the board
 * is not seeing the card, and a computer never shows it.
 */
export async function markAskSeen(caseId, searcherId, now = Date.now()) {
  if (!searcherId) return 0;
  const { count } = await prisma.searchStreet.updateMany({ where: { caseId, askedOfId: searcherId, askedSeenAt: null }, data: { askedSeenAt: new Date(now) } });
  return count;
}

/**
 * What a street's row says about its ask, for one viewer. Everyone learns
 * only that a street is kept for someone (`reserved`), so their own ask
 * for a street passes over it. The person asked learns it is theirs, with
 * the note and whose ask it is (the owner by name; anyone else who came to
 * run a search as null, so a helper is not told their name). Who was asked goes
 * where names go.
 */
export function askOnStreet(row, { viewer = null, withNames = false, ownerId = null, ownerName = null, caseId = row.caseId, now = Date.now() } = {}) {
  if (!row.askedOfId) return { reserved: false };
  const mine = Boolean(viewer && row.askedOfId === viewer);
  const waiting = OPEN.includes(row.status);
  const out = { reserved: waiting && !mine && askHolds(row.askedAt, now) };
  if (mine && waiting) {
    out.askedOfMe = true;
    out.askedNote = row.askedNote || '';
    // The owner by the name the rest of the screen calls them (the report's), which can differ from their account's.
    out.askedBy = row.askedById && row.askedById === ownerId ? ownerName || row.askedByName || null : null;
    // Whether their screen has said it showed this: until it has, it says so when it does.
    out.askedSeen = Boolean(row.askedSeenAt);
  }
  if (withNames) {
    out.askedOfName = row.askedOfName || 'A helper';
    out.askedOfHandle = handleFor(caseId, row.askedOfId);
    out.askedAt = row.askedAt;
    out.askedSeenAt = row.askedSeenAt || null;
  }
  return out;
}

/** The condition a claim adds so that a street kept for someone is not taken by someone else. */
export function claimableBy(me, now = Date.now()) {
  return { OR: [{ askedOfId: null }, { askedOfId: me }, { askedAt: { lt: new Date(now - ASK_HOLD_MS) } }] };
}

/** Whether a street is being kept for someone other than `me` right now. */
export function keptFromOthers(row, me, now = Date.now()) {
  return Boolean(row?.askedOfId && row.askedOfId !== me && askHolds(row.askedAt, now));
}
