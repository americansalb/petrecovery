/**
 * What people on one pet's search say to each other through the search
 * screen (SearchMessage).
 *
 *   desk to one person   whoever runs the search (`searcher.leads`: the
 *                        owner, and app/lib/searcher.js says why nobody
 *                        else yet) writes to a named helper. It shows on
 *                        that person's card on their phone, and they can
 *                        answer in a line.
 *   a person to the desk a helper's word back, to the people running the
 *                        search. Anyone else who comes to run a search
 *                        and is written to answers the same way.
 *
 * What the owner tells everyone is a CaseUpdate ("Tell everyone helping"),
 * which the pet's page shows too, so it is not kept here.
 *
 * Who reads a message: the person it is for, the person who wrote it, and
 * whoever runs the search. Nobody else: not a member of a Rescue Force
 * that is looking, and never someone only looking at the page. To a
 * helper a word from the desk is from the owner by name; should anyone
 * else come to run a search, theirs reads as from "the people running the
 * search", so a helper is not told a name the owner did not give them.
 *
 * The words are the person's own. The product adds none (founder,
 * 2026-11-11: advice is the site's own words, and the screen writes no
 * advice of its own), so a message is always shown as someone's, with
 * whose it is.
 */
import prisma from '@/app/lib/prisma';
import { isPushConfigured, sendPushToUser } from '@/app/lib/push';
import { handleFor } from '@/app/lib/searchTeam';

/** The longest a message may be. */
export const WORD_MAX = 400;
/** How many messages one person may send on one search in an hour. */
export const WORDS_PER_HOUR = 30;
export const WORD_NOTICE = 'SEARCH_WORD';

/** A message as it is stored: one line breaks kept, everything else that is not text removed, cut to length. */
export function cleanWord(text) {
  return String(text ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, WORD_MAX);
}

export class WordError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Send one message. `searcher` is who is writing (app/lib/searcher.js).
 * `to` is the person it is for, as the roster has them (id and name), and
 * only someone who leads may name one; with no `to`, it is a helper's
 * word to the people running the search. Returns the stored row.
 */
export async function sendWord({ caseId, pet, searcher, to = null, text, now = new Date() }) {
  const words = cleanWord(text);
  if (!words) throw new WordError('Write something first.', 400, 'EMPTY');
  if (to && !searcher.leads) throw new WordError('Only the owner can write to a helper.', 403, 'NOT_ALLOWED');
  // From the desk a message is to a named person. (What the owner tells everyone is a CaseUpdate: it goes on the pet's page too.)
  // The one exception is an answer: someone running the search who was written to answers the desk, as any helper does.
  if (!to && searcher.leads) {
    const writtenTo = searcher.isOwner ? 0 : await prisma.searchMessage.count({ where: { caseId, toId: searcher.id } });
    if (!writtenTo) throw new WordError('Pick who it is for.', 400, 'NO_ONE');
  }
  const recent = await prisma.searchMessage.count({ where: { caseId, fromId: searcher.id, createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } } });
  if (recent >= WORDS_PER_HOUR) throw new WordError('That is a lot of messages in an hour. Call the owner if it is urgent.', 429, 'TOO_MANY');

  const row = await prisma.searchMessage.create({
    data: { caseId, fromId: searcher.id, fromName: searcher.firstName, fromDesk: Boolean(to), toId: to?.id || null, toName: to?.name || null, text: words },
  });

  // Someone with an account also gets it in their bell and, where they allowed it, on their phone.
  const name = pet?.petName || 'the pet';
  const url = `/mission-control?mission=${encodeURIComponent(pet?.caseNumber || caseId)}`;
  const tell = async (userId, title) => {
    if (!userId || userId === searcher.userId) return;
    try {
      await prisma.notification.create({ data: { userId, type: WORD_NOTICE, title, message: words.slice(0, 200), actionUrl: url, data: JSON.stringify({ caseId, messageId: row.id }) } });
      if (isPushConfigured()) await sendPushToUser(prisma, userId, { title, body: words.slice(0, 200), url }).catch(() => null);
    } catch (error) {
      console.warn('[searchTalk] notice failed:', error?.message);
    }
  };
  if (to) {
    // The owner by name; anyone else who came to run a search as the people running it.
    if (!String(to.id).startsWith('v:')) await tell(to.id, searcher.isOwner ? `${searcher.firstName}, about the search for ${name}` : `About the search for ${name}`);
  } else if (pet?.reporterId) {
    await tell(pet.reporterId, `${searcher.firstName}, searching for ${name}`);
  }
  return row;
}

/**
 * Every message of a search, oldest first, for the people running it.
 * People are named by handle, never by id. `viewerId` is who is reading:
 * their own messages are marked `mine`.
 */
export async function wordsForDesk(caseId, { take = 80, viewerId = null } = {}) {
  const rows = await prisma.searchMessage.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' }, take });
  return [...rows].reverse().map((m) => ({
    id: m.id,
    at: m.createdAt,
    text: m.text,
    fromDesk: m.fromDesk,
    mine: Boolean(viewerId && m.fromId === viewerId),
    from: m.fromName,
    fromHandle: handleFor(caseId, m.fromId),
    to: m.toName || null,
    toHandle: m.toId ? handleFor(caseId, m.toId) : null,
    seenAt: m.seenAt || null,
  }));
}

/**
 * The messages one person has with the desk, oldest first: what was
 * written to them and what they wrote. Reading them is what marks the
 * ones written to them as seen, which the desk then shows.
 * `ownerId` and `ownerName` say whose a message from the desk is, so a
 * helper reads the owner's by name and anyone else's as the people
 * running the search.
 */
export async function wordsForPerson(caseId, searcherId, { ownerId = null, ownerName = null, take = 6, now = new Date() } = {}) {
  const rows = await prisma.searchMessage.findMany({
    where: { caseId, OR: [{ toId: searcherId }, { fromId: searcherId, fromDesk: false }] },
    orderBy: { createdAt: 'desc' },
    take,
  });
  const unseen = rows.filter((m) => m.toId === searcherId && !m.seenAt).map((m) => m.id);
  if (unseen.length) await prisma.searchMessage.updateMany({ where: { id: { in: unseen }, seenAt: null }, data: { seenAt: now } }).catch(() => null);
  return [...rows].reverse().map((m) => ({
    id: m.id,
    at: m.createdAt,
    text: m.text,
    mine: m.fromId === searcherId,
    // Whose it is, for the person reading it.
    from: m.fromId === searcherId ? null : m.fromId === ownerId && ownerName ? ownerName : null,
  }));
}
