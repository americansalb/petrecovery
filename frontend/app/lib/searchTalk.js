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
import { onlyText, hasText, cut } from '@/app/lib/searchText';

/** The longest a message may be. */
export const WORD_MAX = 400;
/** How many messages one helper may send on one search in an hour. */
export const WORDS_PER_HOUR = 30;
/** How many the person running a search may send in an hour: they write to many helpers, a helper to one desk. */
export const DESK_SENT_PER_HOUR = 200;
/**
 * How many messages the helpers of one search may send its desk in an hour
 * before a helper the owner has not yet written to or asked is refused.
 * Joining takes no account, so the limit on one person is not a limit on
 * someone who joins many times. Someone the owner has written to or asked
 * is someone the owner chose to hear from: they are held to their own
 * limit only, so a flood from strangers cannot shut them out.
 */
export const DESK_WORDS_PER_HOUR = 120;
/**
 * How many times an hour the owner's bell and phone ring for helpers they
 * have not yet written to or asked. Past it such a message is still kept
 * and shown on the search screen; it only stops making a noise. A message
 * from someone the owner has written to or asked always rings.
 */
export const OWNER_BELLS_PER_HOUR = 12;
export const WORD_NOTICE = 'SEARCH_WORD';

/**
 * A message as it is stored: the person's words with their line breaks, without what is not text
 * (app/lib/searchText.js), cut to length. A message with nothing in it to read is blank.
 */
export function cleanWord(text) {
  const words = cut(
    onlyText(text)
      .replace(/ +/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    WORD_MAX
  );
  return hasText(words) ? words : '';
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
 * only whoever runs the search may name one; with no `to`, it is a
 * helper's word to the people running the search. `about` is what the
 * screen knows it concerns and the person did not type (a street), kept
 * beside the words and never inside them. Returns the stored row.
 */
export async function sendWord({ caseId, pet, searcher, to = null, text, about = null, now = new Date() }) {
  const words = cleanWord(text);
  if (!words) throw new WordError('Write something first.', 400, 'EMPTY');
  if (to && !searcher.leads) throw new WordError('Only the owner can write to a helper.', 403, 'NOT_ALLOWED');
  // From the desk a message is to a named person. (What the owner tells everyone is a CaseUpdate: it goes on the pet's page too.)
  // The one exception is an answer: someone running the search who was written to answers the desk, as any helper does.
  if (!to && searcher.leads) {
    const writtenTo = searcher.isOwner ? 0 : await prisma.searchMessage.count({ where: { caseId, toId: searcher.id } });
    if (!writtenTo) throw new WordError('Pick who it is for.', 400, 'NO_ONE');
  }
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const recent = await prisma.searchMessage.count({ where: { caseId, fromId: searcher.id, createdAt: { gte: hourAgo } } });
  if (to) {
    // Said to the person running the search, so it does not tell them to call the owner.
    if (recent >= DESK_SENT_PER_HOUR) throw new WordError('That is a lot of messages in an hour. Wait a little and send it again.', 429, 'TOO_MANY');
  } else if (recent >= WORDS_PER_HOUR) {
    throw new WordError('That is a lot of messages in an hour. Call the owner if it is urgent.', 429, 'TOO_MANY');
  }
  // Whether the owner has written to this person or asked them to walk a street: someone the owner chose to hear from.
  let known = Boolean(to);
  if (!to) {
    const [written, asked] = await Promise.all([
      prisma.searchMessage.count({ where: { caseId, toId: searcher.id } }),
      prisma.searchStreet.count({ where: { caseId, askedOfId: searcher.id } }),
    ]);
    known = written + asked > 0;
    if (!known) {
      const toDesk = await prisma.searchMessage.count({ where: { caseId, fromDesk: false, createdAt: { gte: hourAgo } } });
      if (toDesk >= DESK_WORDS_PER_HOUR) throw new WordError('A lot of messages have been sent on this search in the last hour. Call the owner if it is urgent.', 429, 'TOO_MANY');
    }
  }

  const row = await prisma.searchMessage.create({
    data: { caseId, fromId: searcher.id, fromName: searcher.firstName, fromDesk: Boolean(to), toId: to?.id || null, toName: to?.name || null, text: words, about: about ? String(about).slice(0, 200) : null },
  });

  // Someone with an account also gets it in their bell and, where they allowed it, on their phone.
  const name = pet?.petName || 'the pet';
  const url = `/mission-control?mission=${encodeURIComponent(pet?.caseNumber || caseId)}`;
  const tell = async (userId, title, tag) => {
    if (!userId || userId === searcher.userId) return;
    try {
      await prisma.notification.create({ data: { userId, type: WORD_NOTICE, title, message: words.slice(0, 200), actionUrl: url, data: JSON.stringify({ caseId, messageId: row.id, from: tag }) } });
      if (isPushConfigured()) await sendPushToUser(prisma, userId, { title, body: words.slice(0, 200), url }).catch(() => null);
    } catch (error) {
      console.warn('[searchTalk] notice failed:', error?.message);
    }
  };
  if (to) {
    // The owner by name; anyone else who came to run a search as the people running it.
    if (!String(to.id).startsWith('v:')) await tell(to.id, searcher.isOwner ? `${searcher.firstName}, about the search for ${name}` : `About the search for ${name}`, 'desk');
  } else if (pet?.reporterId) {
    // Kept and shown either way. From someone the owner has not yet written to or asked, it rings only so many times an hour.
    const quiet = known ? false : (await prisma.notification.count({ where: { userId: pet.reporterId, type: WORD_NOTICE, createdAt: { gte: hourAgo }, data: { contains: '"from":"new"' } } }).catch(() => 0)) >= OWNER_BELLS_PER_HOUR;
    if (!quiet) await tell(pet.reporterId, `${searcher.firstName} wrote about the search for ${name}`, known ? 'known' : 'new');
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
    // What the screen knew it was about, shown beside the words.
    about: m.about || null,
  }));
}

/**
 * The messages one person has with the desk, oldest first: what was
 * written to them and what they wrote. `seen` says whether a word written
 * to them has been on their screen; reading this does not make it so. The
 * screen says when it has shown one (`markWordsSeen`), because the desk is
 * told "seen" and that has to mean seen.
 * `ownerId` and `ownerName` say whose a message from the desk is, so a
 * helper reads the owner's by name and anyone else's as the people
 * running the search.
 */
export async function wordsForPerson(caseId, searcherId, { ownerId = null, ownerName = null, take = 6 } = {}) {
  const rows = await prisma.searchMessage.findMany({
    where: { caseId, OR: [{ toId: searcherId }, { fromId: searcherId, fromDesk: false }] },
    orderBy: { createdAt: 'desc' },
    take,
  });
  return [...rows].reverse().map((m) => ({
    id: m.id,
    at: m.createdAt,
    text: m.text,
    mine: m.fromId === searcherId,
    // Whose it is, for the person reading it.
    from: m.fromId === searcherId ? null : m.fromId === ownerId && ownerName ? ownerName : null,
    ...(m.fromId === searcherId ? {} : { seen: Boolean(m.seenAt) }),
  }));
}

/**
 * This person's screen has shown these words. Only words written to them
 * can be marked, by them, once. Returns how many were.
 */
export async function markWordsSeen(caseId, searcherId, ids = [], now = new Date()) {
  const wanted = [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string' && id))].slice(0, 20);
  if (!searcherId || !wanted.length) return 0;
  const { count } = await prisma.searchMessage.updateMany({ where: { id: { in: wanted }, caseId, toId: searcherId, seenAt: null }, data: { seenAt: now } });
  return count;
}
