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
    notification: { create: jest.fn(async () => ({})), count: jest.fn(async () => 0) },
  },
}));
jest.mock('@/app/lib/push', () => ({ __esModule: true, isPushConfigured: jest.fn(() => true), sendPushToUser: jest.fn(async () => ({ sent: 1 })) }));

import prisma from '@/app/lib/prisma';
import { sendPushToUser } from '@/app/lib/push';
import { sendWord, wordsForDesk, wordsForPerson, cleanWord, WordError, WORD_MAX, WORDS_PER_HOUR, DESK_WORDS_PER_HOUR, OWNER_BELLS_PER_HOUR, WORD_NOTICE } from '@/app/lib/searchTalk';
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
});

describe('sendWord: who may write to whom', () => {
  test('the owner writes to a named helper, from the desk', async () => {
    const row = await sendWord({ caseId: CASE, pet: PET, searcher: OWNER, to: DANA, text: ' Check the alley. ', now: NOW });
    expect(prisma.searchMessage.create).toHaveBeenCalledWith({ data: { caseId: CASE, fromId: 'u-avery', fromName: 'Avery', fromDesk: true, toId: 'v:vol-1', toName: 'Dana', text: 'Check the alley.' } });
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
    expect(prisma.searchMessage.create).toHaveBeenCalledWith({ data: { caseId: CASE, fromId: 'v:vol-1', fromName: 'Dana', fromDesk: false, toId: null, toName: null, text: 'Gate open behind the school.' } });
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'u-avery', title: 'Dana, searching for Max', message: 'Gate open behind the school.' });
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
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'u-avery', title: 'Sarah, searching for Max' });
    // The owner is never written to here, so there is nothing for the owner to answer this way.
    await expect(sendWord({ caseId: CASE, pet: PET, searcher: OWNER, text: 'hello all', now: NOW })).rejects.toMatchObject({ code: 'NO_ONE' });
  });

  test('joining takes no account, so a search\'s desk is also limited as a whole, and the owner\'s phone rings only so often', async () => {
    // One person under their own limit, on a search whose helpers have together sent the desk too much this hour.
    prisma.searchMessage.count.mockImplementation(async ({ where }) => (where.fromId ? 2 : where.fromDesk === false ? DESK_WORDS_PER_HOUR : 0));
    await expect(sendWord({ caseId: CASE, pet: PET, searcher: HELPER, text: 'one more', now: NOW })).rejects.toMatchObject({ status: 429, code: 'TOO_MANY', message: 'A lot of messages have been sent on this search in the last hour. Call the owner if it is urgent.' });
    expect(prisma.searchMessage.create).not.toHaveBeenCalled();
    expect(prisma.searchMessage.count).toHaveBeenCalledWith({ where: { caseId: CASE, fromDesk: false, createdAt: { gte: new Date(NOW.getTime() - 3600000) } } });
    // The owner writing to a helper is not counted against the helpers' limit.
    await expect(sendWord({ caseId: CASE, pet: PET, searcher: OWNER, to: DANA, text: 'Thanks.', now: NOW })).resolves.toMatchObject({ fromDesk: true });

    // Under both limits, but the owner's bell has rung its share this hour: the word is kept and shown, quietly.
    jest.clearAllMocks();
    prisma.searchMessage.count.mockReset();
    prisma.searchMessage.count.mockResolvedValue(0);
    prisma.notification.count.mockResolvedValue(OWNER_BELLS_PER_HOUR);
    const row = await sendWord({ caseId: CASE, pet: PET, searcher: HELPER, text: 'Gate open.', now: NOW });
    expect(row).toMatchObject({ text: 'Gate open.', fromDesk: false });
    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { userId: 'u-avery', type: WORD_NOTICE, createdAt: { gte: new Date(NOW.getTime() - 3600000) } } });
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
    expect(DESK_WORDS_PER_HOUR).toBeGreaterThan(WORDS_PER_HOUR);
    expect(OWNER_BELLS_PER_HOUR).toBeLessThan(WORDS_PER_HOUR);
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
    expect(all[2]).toEqual({ id: 'm3', at: rows[0].createdAt, text: 'Can you take the alley too?', fromDesk: true, mine: false, from: 'Avery', fromHandle: handleFor(CASE, 'u-avery'), to: 'Dana', toHandle: handleFor(CASE, 'v:vol-1'), seenAt: null });
    // Which are the reader's own is said by the server, never worked out from a name.
    expect(all.map((m) => m.mine)).toEqual([true, false, false]);
    expect((await wordsForDesk(CASE)).map((m) => m.mine)).toEqual([false, false, false]);
    expect(all[1]).toMatchObject({ fromDesk: false, from: 'Dana', to: null, toHandle: null });
    expect(JSON.stringify(all)).not.toMatch(/vol-1|u-avery|u-sarah/);
    expect(prisma.searchMessage.findMany).toHaveBeenCalledWith({ where: { caseId: CASE }, orderBy: { createdAt: 'desc' }, take: 80 });
  });

  test('a helper reads what was written to them and what they wrote, and reading marks it seen', async () => {
    prisma.searchMessage.findMany.mockResolvedValue(rows);
    const mine = await wordsForPerson(CASE, 'v:vol-1', { ownerId: 'u-avery', ownerName: 'Avery', now: NOW });
    expect(prisma.searchMessage.findMany).toHaveBeenCalledWith({ where: { caseId: CASE, OR: [{ toId: 'v:vol-1' }, { fromId: 'v:vol-1', fromDesk: false }] }, orderBy: { createdAt: 'desc' }, take: 6 });
    expect(mine).toEqual([
      // From a lead: whose it is, is not said to a helper.
      { id: 'm1', at: rows[2].createdAt, text: 'Thanks for coming.', mine: false, from: null },
      { id: 'm2', at: rows[1].createdAt, text: 'Gate open behind the school.', mine: true, from: null },
      // From the owner: by name.
      { id: 'm3', at: rows[0].createdAt, text: 'Can you take the alley too?', mine: false, from: 'Avery' },
    ]);
    expect(JSON.stringify(mine)).not.toContain('Sarah');
    // Only the one written to them and not yet seen is marked.
    expect(prisma.searchMessage.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['m3'] }, seenAt: null }, data: { seenAt: NOW } });
  });

  test('with nothing unseen, nothing is written', async () => {
    prisma.searchMessage.findMany.mockResolvedValue([rows[2]]);
    await wordsForPerson(CASE, 'v:vol-1', { now: NOW });
    expect(prisma.searchMessage.updateMany).not.toHaveBeenCalled();
  });
});
