/**
 * What people on a pet's search say to each other (app/lib/searchTalk.js).
 *
 * A message from the desk goes to one named helper; a helper's goes back
 * to the people running the search. It is read by the person it is for,
 * the person who wrote it and the people running the search, and by
 * nobody else. A helper is never told a lead's name.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    searchMessage: { count: jest.fn(async () => 0), create: jest.fn(async ({ data }) => ({ id: 'msg-1', createdAt: new Date('2026-11-12T22:00:00Z'), seenAt: null, ...data })), findMany: jest.fn(async () => []), updateMany: jest.fn(async () => ({ count: 0 })) },
    searchStreet: { count: jest.fn(async () => 0) },
    notification: { create: jest.fn(async () => ({})), count: jest.fn(async () => 0) },
  },
}));
jest.mock('@/app/lib/push', () => ({ __esModule: true, isPushConfigured: jest.fn(() => true), sendPushToUser: jest.fn(async () => ({ sent: 1 })) }));

import prisma from '@/app/lib/prisma';
import { sendPushToUser } from '@/app/lib/push';
import { sendWord, wordsForDesk, wordsForPerson, markWordsSeen, cleanWord, WordError, WORD_MAX, WORDS_PER_HOUR, DESK_SENT_PER_HOUR, DESK_WORDS_PER_HOUR, OWNER_BELLS_PER_HOUR, WORD_NOTICE } from '@/app/lib/searchTalk';
import { handleFor } from '@/app/lib/searchTeam';

const CASE = 'case-max';
const PET = { id: CASE, caseNumber: 'AUS-2026-0001', petName: 'Max', reporterId: 'u-avery' };
const OWNER = { id: 'u-avery', kind: 'user', userId: 'u-avery', firstName: 'Avery', isOwner: true, seesNames: true, leads: true };
const LEAD = { id: 'u-sarah', kind: 'user', userId: 'u-sarah', firstName: 'Sarah', isOwner: false, seesNames: true, leads: true };
const MEMBER = { id: 'u-mike', kind: 'user', userId: 'u-mike', firstName: 'Mike', isOwner: false, seesNames: true, leads: false };
const HELPER = { id: 'v:vol-1', kind: 'volunteer', userId: null, firstName: 'Dana', isOwner: false, seesNames: false, leads: false };
const DANA = { id: 'v:vol-1', name: 'Dana' };
const MIKE = { id: 'u-mike', name: 'Mike' };
const NOW = new Date('2026-11-12T22:00:00Z');

beforeEach(() => {
  jest.clearAllMocks();
  prisma.searchMessage.count.mockReset();
  prisma.searchMessage.count.mockResolvedValue(0);
  prisma.searchStreet.count.mockResolvedValue(0);
  prisma.notification.count.mockResolvedValue(0);
});

describe('cleanWord', () => {
  test('keeps the person\'s words and their line breaks, and nothing that is not text', () => {
    expect(cleanWord('  Check the alley   behind the school.  ')).toBe('Check the alley behind the school.');
    expect(cleanWord('one\n\n\n\n\ntwo')).toBe('one\n\ntwo');
    // A null, a zero-width space and a right-to-left override: none of them is text.
    expect(cleanWord(`a${String.fromCharCode(0)}b${String.fromCharCode(0x200b)}c${String.fromCharCode(0x202e)}d`)).toBe('abcd');
    expect(cleanWord(null)).toBe('');
    expect(cleanWord('x'.repeat(900))).toHaveLength(WORD_MAX);
  });

  test('a tab is a space, not nothing, so two words do not run together', () => {
    expect(cleanWord(`Check${String.fromCharCode(9)}the alley`)).toBe('Check the alley');
  });

  test('a message that looks blank is blank: characters that take up no room are not text', () => {
    // A soft hyphen, a word joiner, the invisible operators, the isolates, and the fillers that draw as nothing.
    const unseen = [0x00ad, 0x2060, 0x2061, 0x2064, 0x2066, 0x2069, 0x3164, 0x115f, 0x1160, 0xffa0, 0x180e, 0xfeff];
    for (const code of unseen) expect({ code: code.toString(16), left: cleanWord(String.fromCharCode(code, code, code)) }).toEqual({ code: code.toString(16), left: '' });
    expect(cleanWord(`a${unseen.map((c) => String.fromCharCode(c)).join('')}b`)).toBe('ab');
  });
});

describe('sendWord: who may write to whom', () => {
  test('the owner writes to a named helper, from the desk', async () => {
    const row = await sendWord({ caseId: CASE, pet: PET, searcher: OWNER, to: DANA, text: ' Check the alley. ', now: NOW });
    expect(prisma.searchMessage.create).toHaveBeenCalledWith({ data: { caseId: CASE, fromId: 'u-avery', fromName: 'Avery', fromDesk: true, toId: 'v:vol-1', toName: 'Dana', text: 'Check the alley.', about: null } });
    expect(row.id).toBe('msg-1');
    // A helper with no account has no bell: they read it on the page.
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  test('someone leading a force can too, and a member with an account gets it in their bell and on their phone', async () => {
    await sendWord({ caseId: CASE, pet: PET, searcher: LEAD, to: MIKE, text: 'Can you take Burnet Rd?', now: NOW });
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    const notice = prisma.notification.create.mock.calls[0][0].data;
    // The lead is not named to them: it is about the search, and the words say the rest.
    expect(notice).toMatchObject({ userId: 'u-mike', type: WORD_NOTICE, title: 'About the search for Max', message: 'Can you take Burnet Rd?', actionUrl: '/mission-control?mission=AUS-2026-0001' });
    expect(JSON.stringify(notice)).not.toContain('Sarah');
    expect(sendPushToUser).toHaveBeenCalledWith(prisma, 'u-mike', { title: 'About the search for Max', body: 'Can you take Burnet Rd?', url: '/mission-control?mission=AUS-2026-0001' });
    // From the owner it is the owner's, by name: that name is on the pet's page already.
    prisma.notification.create.mockClear();
    await sendWord({ caseId: CASE, pet: PET, searcher: OWNER, to: MIKE, text: 'Thank you.', now: NOW });
    expect(prisma.notification.create.mock.calls[0][0].data.title).toBe('Avery, about the search for Max');
  });

  test('nobody else can write to a helper: a member, a helper, anyone', async () => {
    for (const searcher of [MEMBER, HELPER]) {
      await expect(sendWord({ caseId: CASE, pet: PET, searcher, to: MIKE, text: 'hello', now: NOW })).rejects.toMatchObject({ status: 403, code: 'NOT_ALLOWED', message: 'Only the owner can write to a helper.' });
    }
    expect(prisma.searchMessage.create).not.toHaveBeenCalled();
  });

  test('a helper\'s word goes to the people running the search, and the owner is told', async () => {
    await sendWord({ caseId: CASE, pet: PET, searcher: HELPER, text: 'Gate open behind the school.', now: NOW });
    expect(prisma.searchMessage.create).toHaveBeenCalledWith({ data: { caseId: CASE, fromId: 'v:vol-1', fromName: 'Dana', fromDesk: false, toId: null, toName: null, text: 'Gate open behind the school.', about: null } });
    // The title says what happened and no more: it is used for anyone who writes, searching or not.
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'u-avery', title: 'Dana wrote about the search for Max', message: 'Gate open behind the school.' });
  });

  test('what a message is about, when the screen knows and the person did not type it, is kept beside the words', async () => {
    await sendWord({ caseId: CASE, pet: PET, searcher: HELPER, text: "I can't right now.", about: 'Elm St from A St to B St', now: NOW });
    expect(prisma.searchMessage.create.mock.calls[0][0].data).toMatchObject({ text: "I can't right now.", about: 'Elm St from A St to B St' });
  });

  test('from the desk a message needs a person: what the owner tells everyone is a case update, not this', async () => {
    for (const searcher of [OWNER, LEAD]) {
      await expect(sendWord({ caseId: CASE, pet: PET, searcher, text: 'hello all', now: NOW })).rejects.toMatchObject({ status: 400, code: 'NO_ONE' });
    }
  });

  test('someone leading who was written to answers the desk, as any helper does', async () => {
    // Sarah leads a force and is out walking: the owner wrote to her, and her card has a line to answer in.
    prisma.searchMessage.count.mockImplementation(async ({ where }) => (where.toId === 'u-sarah' ? 1 : 0));
    const row = await sendWord({ caseId: CASE, pet: PET, searcher: LEAD, text: 'Nothing in the alley.', now: NOW });
    expect(row).toMatchObject({ fromId: 'u-sarah', fromDesk: false, toId: null, text: 'Nothing in the alley.' });
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'u-avery', title: 'Sarah wrote about the search for Max' });
    // The owner is never written to here, so there is nothing for the owner to answer this way.
    await expect(sendWord({ caseId: CASE, pet: PET, searcher: OWNER, text: 'hello all', now: NOW })).rejects.toMatchObject({ code: 'NO_ONE' });
  });

  test('joining takes no account, so helpers the owner has not chosen share a limit, and the owner\'s phone rings for them only so often', async () => {
    const hour = { gte: new Date(NOW.getTime() - 3600000) };
    // Under their own limit, never written to or asked, on a search whose helpers have together sent the desk too much this hour.
    prisma.searchMessage.count.mockImplementation(async ({ where }) => (where.fromId ? 2 : where.toId ? 0 : where.fromDesk === false ? DESK_WORDS_PER_HOUR : 0));
    await expect(sendWord({ caseId: CASE, pet: PET, searcher: HELPER, text: 'one more', now: NOW })).rejects.toMatchObject({ status: 429, code: 'TOO_MANY', message: 'A lot of messages have been sent on this search in the last hour. Call the owner if it is urgent.' });
    expect(prisma.searchMessage.create).not.toHaveBeenCalled();
    expect(prisma.searchMessage.count).toHaveBeenCalledWith({ where: { caseId: CASE, fromDesk: false, createdAt: hour } });
    // The owner writing to a helper is not counted against the helpers' limit.
    await expect(sendWord({ caseId: CASE, pet: PET, searcher: OWNER, to: DANA, text: 'Thanks.', now: NOW })).resolves.toMatchObject({ fromDesk: true });

    // Under both limits, but the owner's bell has rung its share for new people this hour: kept and shown, quietly.
    jest.clearAllMocks();
    prisma.searchMessage.count.mockReset();
    prisma.searchMessage.count.mockResolvedValue(0);
    prisma.notification.count.mockResolvedValue(OWNER_BELLS_PER_HOUR);
    const row = await sendWord({ caseId: CASE, pet: PET, searcher: HELPER, text: 'Gate open.', now: NOW });
    expect(row).toMatchObject({ text: 'Gate open.', fromDesk: false });
    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { userId: 'u-avery', type: WORD_NOTICE, createdAt: hour, data: { contains: '"from":"new"' } } });
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
    expect(DESK_WORDS_PER_HOUR).toBeGreaterThan(WORDS_PER_HOUR);
    expect(OWNER_BELLS_PER_HOUR).toBeLessThan(WORDS_PER_HOUR);
  });

  test('a flood from strangers cannot shut out someone the owner wrote to or asked: they are held to their own limit only', async () => {
    // The desk's shared limit is spent and the bell has rung its share for new people. Dana was written to by the owner.
    prisma.searchMessage.count.mockImplementation(async ({ where }) => (where.fromId ? 2 : where.toId === 'v:vol-1' ? 1 : where.fromDesk === false ? DESK_WORDS_PER_HOUR * 3 : 0));
    prisma.notification.count.mockResolvedValue(OWNER_BELLS_PER_HOUR * 3);
    const row = await sendWord({ caseId: CASE, pet: PET, searcher: HELPER, text: 'I can see Max under the porch.', now: NOW });
    expect(row).toMatchObject({ text: 'I can see Max under the porch.' });
    // And it rings: marked as from someone known, so it is not counted against the share for new people.
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(JSON.parse(prisma.notification.create.mock.calls[0][0].data.data)).toMatchObject({ from: 'known' });
    expect(prisma.notification.count).not.toHaveBeenCalled();

    // Asked to walk a street by the owner counts the same.
    jest.clearAllMocks();
    prisma.searchMessage.count.mockImplementation(async ({ where }) => (where.fromId ? 2 : where.toId ? 0 : where.fromDesk === false ? DESK_WORDS_PER_HOUR * 3 : 0));
    prisma.searchStreet.count.mockResolvedValue(1);
    await expect(sendWord({ caseId: CASE, pet: PET, searcher: HELPER, text: 'On my way.', now: NOW })).resolves.toMatchObject({ text: 'On my way.' });
    expect(prisma.searchStreet.count).toHaveBeenCalledWith({ where: { caseId: CASE, askedOfId: 'v:vol-1' } });
    // Someone new, under the limits, rings too, and is marked as new.
    jest.clearAllMocks();
    prisma.searchMessage.count.mockReset();
    prisma.searchMessage.count.mockResolvedValue(0);
    prisma.searchStreet.count.mockResolvedValue(0);
    prisma.notification.count.mockResolvedValue(0);
    await sendWord({ caseId: CASE, pet: PET, searcher: HELPER, text: 'Hello.', now: NOW });
    expect(JSON.parse(prisma.notification.create.mock.calls[0][0].data.data)).toMatchObject({ from: 'new' });
  });

  test('the person running the search writes to many helpers: their limit is higher, and its words do not tell them to call themselves', async () => {
    prisma.searchMessage.count.mockImplementation(async ({ where }) => (where.fromId === 'u-avery' ? WORDS_PER_HOUR + 5 : 0));
    await expect(sendWord({ caseId: CASE, pet: PET, searcher: OWNER, to: DANA, text: 'Thirty-sixth of the hour.', now: NOW })).resolves.toMatchObject({ fromDesk: true });
    prisma.searchMessage.count.mockImplementation(async ({ where }) => (where.fromId === 'u-avery' ? DESK_SENT_PER_HOUR : 0));
    const refused = sendWord({ caseId: CASE, pet: PET, searcher: OWNER, to: DANA, text: 'Too many.', now: NOW });
    await expect(refused).rejects.toMatchObject({ status: 429, code: 'TOO_MANY', message: 'That is a lot of messages in an hour. Wait a little and send it again.' });
    await expect(refused).rejects.not.toMatchObject({ message: expect.stringMatching(/Call the owner/) });
    expect(DESK_SENT_PER_HOUR).toBeGreaterThan(WORDS_PER_HOUR);
  });

  test('nothing to say is refused, and so is a flood', async () => {
    await expect(sendWord({ caseId: CASE, pet: PET, searcher: HELPER, text: '   \n ', now: NOW })).rejects.toMatchObject({ status: 400, code: 'EMPTY' });
    prisma.searchMessage.count.mockResolvedValue(WORDS_PER_HOUR);
    await expect(sendWord({ caseId: CASE, pet: PET, searcher: HELPER, text: 'again', now: NOW })).rejects.toBeInstanceOf(WordError);
    await expect(sendWord({ caseId: CASE, pet: PET, searcher: HELPER, text: 'again', now: NOW })).rejects.toMatchObject({ status: 429, code: 'TOO_MANY' });
    expect(prisma.searchMessage.count).toHaveBeenLastCalledWith({ where: { caseId: CASE, fromId: 'v:vol-1', createdAt: { gte: new Date(NOW.getTime() - 3600000) } } });
    expect(prisma.searchMessage.create).not.toHaveBeenCalled();
  });

  test('the owner writing is never sent a notice about their own words', async () => {
    await sendWord({ caseId: CASE, pet: PET, searcher: OWNER, to: { id: 'u-avery', name: 'Avery' }, text: 'note to self', now: NOW });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

describe('who reads what', () => {
  const rows = [
    { id: 'm3', createdAt: new Date('2026-11-12T21:59:00Z'), caseId: CASE, fromId: 'u-avery', fromName: 'Avery', fromDesk: true, toId: 'v:vol-1', toName: 'Dana', text: 'Can you take the alley too?', seenAt: null },
    { id: 'm2', createdAt: new Date('2026-11-12T21:52:00Z'), caseId: CASE, fromId: 'v:vol-1', fromName: 'Dana', fromDesk: false, toId: null, toName: null, text: 'Gate open behind the school.', seenAt: null },
    { id: 'm1', createdAt: new Date('2026-11-12T21:40:00Z'), caseId: CASE, fromId: 'u-sarah', fromName: 'Sarah', fromDesk: true, toId: 'v:vol-1', toName: 'Dana', text: 'Thanks for coming.', seenAt: new Date('2026-11-12T21:41:00Z') },
  ];

  test('the people running the search read all of it, oldest first, with people by handle and never by id', async () => {
    prisma.searchMessage.findMany.mockResolvedValue(rows);
    const all = await wordsForDesk(CASE, { viewerId: 'u-sarah' });
    expect(all.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(all[2]).toEqual({ id: 'm3', at: rows[0].createdAt, text: 'Can you take the alley too?', fromDesk: true, mine: false, from: 'Avery', fromHandle: handleFor(CASE, 'u-avery'), to: 'Dana', toHandle: handleFor(CASE, 'v:vol-1'), seenAt: null, about: null });
    // Which are the reader's own is said by the server, never worked out from a name.
    expect(all.map((m) => m.mine)).toEqual([true, false, false]);
    expect((await wordsForDesk(CASE)).map((m) => m.mine)).toEqual([false, false, false]);
    expect(all[1]).toMatchObject({ fromDesk: false, from: 'Dana', to: null, toHandle: null });
    expect(JSON.stringify(all)).not.toMatch(/vol-1|u-avery|u-sarah/);
    expect(prisma.searchMessage.findMany).toHaveBeenCalledWith({ where: { caseId: CASE }, orderBy: { createdAt: 'desc' }, take: 80 });
  });

  test('a helper reads what was written to them and what they wrote, and reading it marks nothing as seen', async () => {
    prisma.searchMessage.findMany.mockResolvedValue(rows);
    const mine = await wordsForPerson(CASE, 'v:vol-1', { ownerId: 'u-avery', ownerName: 'Avery' });
    expect(prisma.searchMessage.findMany).toHaveBeenCalledWith({ where: { caseId: CASE, OR: [{ toId: 'v:vol-1' }, { fromId: 'v:vol-1', fromDesk: false }] }, orderBy: { createdAt: 'desc' }, take: 6 });
    expect(mine).toEqual([
      // From anyone else who runs the search: whose it is, is not said to a helper. `seen` is whether their screen has shown it.
      { id: 'm1', at: rows[2].createdAt, text: 'Thanks for coming.', mine: false, from: null, seen: true },
      { id: 'm2', at: rows[1].createdAt, text: 'Gate open behind the school.', mine: true, from: null },
      // From the owner: by name. Not shown yet.
      { id: 'm3', at: rows[0].createdAt, text: 'Can you take the alley too?', mine: false, from: 'Avery', seen: false },
    ]);
    expect(JSON.stringify(mine)).not.toContain('Sarah');
    // A phone that fetched a word has not shown it: the desk is told "seen" only when the screen says so.
    expect(prisma.searchMessage.updateMany).not.toHaveBeenCalled();
  });

  test('the screen says which words it has shown, and only a word written to that person can be marked, by them', async () => {
    prisma.searchMessage.updateMany.mockResolvedValue({ count: 1 });
    expect(await markWordsSeen(CASE, 'v:vol-1', ['m3'], NOW)).toBe(1);
    // By id, on this pet, written to them, not yet seen: someone else's id in the list matches nothing.
    expect(prisma.searchMessage.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['m3'] }, caseId: CASE, toId: 'v:vol-1', seenAt: null }, data: { seenAt: NOW } });
    prisma.searchMessage.updateMany.mockClear();
    // Nothing that is not a short list of ids is passed on.
    expect(await markWordsSeen(CASE, 'v:vol-1', [], NOW)).toBe(0);
    expect(await markWordsSeen(CASE, 'v:vol-1', 'm3', NOW)).toBe(0);
    expect(await markWordsSeen(CASE, 'v:vol-1', [null, 7, { id: 'm3' }, ''], NOW)).toBe(0);
    expect(await markWordsSeen(CASE, null, ['m3'], NOW)).toBe(0);
    expect(prisma.searchMessage.updateMany).not.toHaveBeenCalled();
    await markWordsSeen(CASE, 'v:vol-1', Array.from({ length: 50 }, (_, i) => `m${i}`), NOW);
    expect(prisma.searchMessage.updateMany.mock.calls[0][0].where.id.in).toHaveLength(20);
  });
});
