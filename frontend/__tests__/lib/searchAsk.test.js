/**
 * Asking one named person to walk one street (app/lib/searchAsk.js).
 *
 * The street is kept for them for half an hour, shows on their phone as
 * their next step, and the desk sees it asked, then seen, then walked.
 * Only the owner and the leads can ask; the person asked can say they
 * cannot, in the words of the button they press.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    searchStreet: { findFirst: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) },
    searchMessage: { create: jest.fn(async () => ({})) },
  },
}));
jest.mock('@/app/lib/push', () => ({ __esModule: true, isPushConfigured: () => false, sendPushToUser: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { askStreet, unaskPerson, cannotWalk, markAskSeen, askOnStreet, claimableBy, keptFromOthers, clearAsk, ASK_NOTE_MAX, CANNOT_WORDS } from '@/app/lib/searchAsk';
import { ASK_HOLD_MS, handleFor } from '@/app/lib/searchTeam';

const CASE = 'case-max';
const NOW = new Date('2026-11-12T22:00:00Z').getTime();
const ago = (minutes) => new Date(NOW - minutes * 60000);
const OWNER = { id: 'u-avery', userId: 'u-avery', firstName: 'Avery', isOwner: true, leads: true };
const LEAD = { id: 'u-sarah', userId: 'u-sarah', firstName: 'Sarah', isOwner: false, leads: true };
const MEMBER = { id: 'u-mike', userId: 'u-mike', firstName: 'Mike', isOwner: false, leads: false };
const JO = { id: 'v:vol-2', name: 'Jo' };
const street = (over = {}) => ({ id: 'st-2', caseId: CASE, name: 'W 42nd St', fromName: 'Rosedale Ave', toName: 'Shoalwood Ave', status: 'UNSEARCHED', context: false, askedOfId: null, askedOfName: null, askedById: null, askedByName: null, askedAt: null, askedSeenAt: null, askedNote: null, ...over });
const EMPTY = { askedOfId: null, askedOfName: null, askedById: null, askedByName: null, askedAt: null, askedSeenAt: null, askedNote: null };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.searchStreet.findFirst.mockResolvedValue(street());
  prisma.searchStreet.updateMany.mockResolvedValue({ count: 1 });
});

describe('askStreet', () => {
  test('the owner asks Jo: the street is kept for Jo, with the owner\'s note, and not yet seen', async () => {
    const out = await askStreet({ caseId: CASE, streetId: 'st-2', person: JO, searcher: OWNER, note: '  Check the alley\nbehind the school.  ', now: NOW });
    expect(out.error).toBeUndefined();
    expect(out.title).toBe('W 42nd St from Rosedale Ave to Shoalwood Ave');
    const [write, others] = prisma.searchStreet.updateMany.mock.calls.map((c) => c[0]);
    // Only a street still to walk, on this pet's board, and only if nobody else is being kept it.
    expect(write.where).toEqual({ id: 'st-2', caseId: CASE, context: false, status: { in: ['UNSEARCHED', 'NEEDS_REVISIT'] }, OR: [{ askedOfId: null }, { askedOfId: 'v:vol-2' }, { askedAt: { lt: new Date(NOW - ASK_HOLD_MS) } }] });
    expect(write.data).toEqual({ askedOfId: 'v:vol-2', askedOfName: 'Jo', askedById: 'u-avery', askedByName: 'Avery', askedAt: new Date(NOW), askedSeenAt: null, askedNote: 'Check the alley behind the school.' });
    // One ask to a person: any other street Jo was asked for goes back to the search.
    // Any street they were asked for before this one goes back. Only the ones before it: two asks made in the same
    // moment must not each take the other back and leave the person with none.
    expect(others).toEqual({ where: { caseId: CASE, askedOfId: 'v:vol-2', NOT: { id: 'st-2' }, askedAt: { lt: new Date(NOW) } }, data: EMPTY });
  });

  test('a note is the asker\'s own words, kept short, and none is none', async () => {
    await askStreet({ caseId: CASE, streetId: 'st-2', person: JO, searcher: LEAD, note: 'x'.repeat(400), now: NOW });
    expect(prisma.searchStreet.updateMany.mock.calls[0][0].data.askedNote).toHaveLength(ASK_NOTE_MAX);
    prisma.searchStreet.updateMany.mockClear();
    await askStreet({ caseId: CASE, streetId: 'st-2', person: JO, searcher: LEAD, note: '   ', now: NOW });
    expect(prisma.searchStreet.updateMany.mock.calls[0][0].data).toMatchObject({ askedNote: null, askedById: 'u-sarah', askedByName: 'Sarah' });
  });

  test('only the owner and the leads can ask', async () => {
    expect(await askStreet({ caseId: CASE, streetId: 'st-2', person: JO, searcher: MEMBER, now: NOW })).toEqual({ error: 'NOT_ALLOWED', title: null });
    expect(await askStreet({ caseId: CASE, streetId: 'st-2', person: JO, searcher: null, now: NOW })).toEqual({ error: 'NOT_ALLOWED', title: null });
    expect(prisma.searchStreet.findFirst).not.toHaveBeenCalled();
    expect(prisma.searchStreet.updateMany).not.toHaveBeenCalled();
  });

  test('a street of another pet, or of the ring outside the board, is not found', async () => {
    prisma.searchStreet.findFirst.mockResolvedValue(null);
    expect(await askStreet({ caseId: CASE, streetId: 'st-x', person: JO, searcher: OWNER, now: NOW })).toEqual({ error: 'NOT_FOUND', title: null });
    expect(prisma.searchStreet.findFirst).toHaveBeenCalledWith({ where: { id: 'st-x', caseId: CASE, context: false } });
  });

  test('a street someone is on, or that has been walked, cannot be asked for', async () => {
    for (const status of ['IN_PROGRESS', 'SEARCHED']) {
      prisma.searchStreet.findFirst.mockResolvedValue(street({ status }));
      expect(await askStreet({ caseId: CASE, streetId: 'st-2', person: JO, searcher: OWNER, now: NOW })).toMatchObject({ error: 'NOT_OPEN' });
    }
    expect(prisma.searchStreet.updateMany).not.toHaveBeenCalled();
  });

  test('a street kept for someone else stays theirs, and nothing of Jo\'s is taken back', async () => {
    prisma.searchStreet.updateMany.mockResolvedValue({ count: 0 });
    expect(await askStreet({ caseId: CASE, streetId: 'st-2', person: JO, searcher: OWNER, now: NOW })).toMatchObject({ error: 'ASKED_ALREADY' });
    expect(prisma.searchStreet.updateMany).toHaveBeenCalledTimes(1);
  });
});

describe('taking an ask back, and saying "I can\'t"', () => {
  test('the desk takes back what a person was asked, but never a street they have started', async () => {
    expect(await unaskPerson({ caseId: CASE, person: JO, searcher: OWNER })).toEqual({ count: 1 });
    expect(prisma.searchStreet.updateMany).toHaveBeenCalledWith({ where: { caseId: CASE, askedOfId: 'v:vol-2', status: { in: ['UNSEARCHED', 'NEEDS_REVISIT'] } }, data: EMPTY });
    expect(await unaskPerson({ caseId: CASE, person: JO, searcher: MEMBER })).toEqual({ error: 'NOT_ALLOWED' });
  });

  test('the person asked says they cannot: the street goes back, and the desk is told in the words of their button', async () => {
    prisma.searchStreet.findFirst.mockResolvedValue(street({ askedOfId: 'v:vol-2', askedAt: ago(2) }));
    const out = await cannotWalk({ caseId: CASE, searcher: { id: 'v:vol-2', firstName: 'Jo' } });
    expect(out).toEqual({ title: 'W 42nd St from Rosedale Ave to Shoalwood Ave' });
    expect(prisma.searchStreet.findFirst).toHaveBeenCalledWith({ where: { caseId: CASE, context: false, askedOfId: 'v:vol-2', status: { in: ['UNSEARCHED', 'NEEDS_REVISIT'] } } });
    expect(prisma.searchStreet.updateMany).toHaveBeenCalledWith({ where: { id: 'st-2', askedOfId: 'v:vol-2', status: { in: ['UNSEARCHED', 'NEEDS_REVISIT'] } }, data: EMPTY });
    expect(CANNOT_WORDS).toBe("I can't right now.");
    // The words are the button's and nothing else. Which street they are about is kept beside them, not inside them.
    expect(prisma.searchMessage.create).toHaveBeenCalledWith({ data: { caseId: CASE, fromId: 'v:vol-2', fromName: 'Jo', fromDesk: false, toId: null, toName: null, text: "I can't right now.", about: 'W 42nd St from Rosedale Ave to Shoalwood Ave' } });
  });

  test('pressed twice, the desk is told once', async () => {
    prisma.searchStreet.findFirst.mockResolvedValue(street({ askedOfId: 'v:vol-2', askedAt: ago(2) }));
    // The other request gave it back first: this one's write changes nothing.
    prisma.searchStreet.updateMany.mockResolvedValue({ count: 0 });
    expect(await cannotWalk({ caseId: CASE, searcher: { id: 'v:vol-2', firstName: 'Jo' } })).toEqual({ error: 'NO_ASK' });
    expect(prisma.searchMessage.create).not.toHaveBeenCalled();
  });

  test('someone who was not asked has nothing to give back', async () => {
    prisma.searchStreet.findFirst.mockResolvedValue(null);
    expect(await cannotWalk({ caseId: CASE, searcher: { id: 'v:vol-9', firstName: 'Pat' } })).toEqual({ error: 'NO_ASK' });
    expect(prisma.searchStreet.updateMany).not.toHaveBeenCalled();
    expect(prisma.searchMessage.create).not.toHaveBeenCalled();
  });

  test('the first time their screen shows it is stamped, once', async () => {
    await markAskSeen(CASE, 'v:vol-2', NOW);
    expect(prisma.searchStreet.updateMany).toHaveBeenCalledWith({ where: { caseId: CASE, askedOfId: 'v:vol-2', askedSeenAt: null }, data: { askedSeenAt: new Date(NOW) } });
    prisma.searchStreet.updateMany.mockClear();
    expect(await markAskSeen(CASE, null, NOW)).toBe(0);
    expect(prisma.searchStreet.updateMany).not.toHaveBeenCalled();
  });
});

describe('what a street says about its ask, to each kind of person', () => {
  const asked = street({ askedOfId: 'v:vol-2', askedOfName: 'Jo', askedById: 'u-avery', askedByName: 'Avery', askedAt: ago(3), askedSeenAt: ago(2), askedNote: 'Check the alley.' });

  test('a street nobody was asked for says only that it is not kept', () => {
    expect(askOnStreet(street(), { viewer: 'v:vol-9', now: NOW })).toEqual({ reserved: false });
  });

  test('anyone else learns only that it is kept for someone: no name, no note', () => {
    for (const viewer of [null, 'v:vol-9', 'u-pat']) {
      expect(askOnStreet(asked, { viewer, ownerId: 'u-avery', now: NOW })).toEqual({ reserved: true });
    }
  });

  test('the person asked learns it is theirs, with the note, and whose ask it is when it is the owner\'s', () => {
    // `askedSeen` is whether their screen has said it showed the ask: until it has, it says so when it does.
    expect(askOnStreet({ ...asked, askedSeenAt: null }, { viewer: 'v:vol-2', ownerId: 'u-avery', now: NOW })).toEqual({ reserved: false, askedOfMe: true, askedNote: 'Check the alley.', askedBy: 'Avery', askedSeen: false });
    expect(askOnStreet({ ...asked, askedSeenAt: ago(1) }, { viewer: 'v:vol-2', ownerId: 'u-avery', now: NOW }).askedSeen).toBe(true);
    // The owner by the name the rest of the screen calls them (the report's), where that is given.
    expect(askOnStreet(asked, { viewer: 'v:vol-2', ownerId: 'u-avery', ownerName: 'Avi', now: NOW }).askedBy).toBe('Avi');
    // Asked by someone leading a force: a helper is not told a lead's name.
    const byLead = { ...asked, askedById: 'u-sarah', askedByName: 'Sarah' };
    expect(askOnStreet(byLead, { viewer: 'v:vol-2', ownerId: 'u-avery', now: NOW })).toMatchObject({ askedOfMe: true, askedBy: null });
    expect(JSON.stringify(askOnStreet(byLead, { viewer: 'v:vol-2', ownerId: 'u-avery', now: NOW }))).not.toContain('Sarah');
  });

  test('the owner and the forces see who was asked, by name and handle, and when it was seen', () => {
    const out = askOnStreet(asked, { viewer: 'u-avery', withNames: true, ownerId: 'u-avery', caseId: CASE, now: NOW });
    expect(out).toEqual({ reserved: true, askedOfName: 'Jo', askedOfHandle: handleFor(CASE, 'v:vol-2'), askedAt: ago(3), askedSeenAt: ago(2) });
    expect(JSON.stringify(out)).not.toContain('vol-2');
  });

  test('after half an hour it is no longer kept, and once walked it is nobody\'s ask', () => {
    const old = { ...asked, askedAt: ago(31) };
    expect(askOnStreet(old, { viewer: 'v:vol-9', now: NOW })).toEqual({ reserved: false });
    // Still theirs to see, until someone else takes it.
    expect(askOnStreet(old, { viewer: 'v:vol-2', ownerId: 'u-avery', now: NOW })).toMatchObject({ askedOfMe: true });
    expect(askOnStreet({ ...asked, status: 'SEARCHED' }, { viewer: 'v:vol-2', now: NOW })).toEqual({ reserved: false });
    expect(askOnStreet({ ...asked, status: 'IN_PROGRESS' }, { viewer: 'v:vol-9', now: NOW })).toEqual({ reserved: false });
  });
});

describe('a claim respects an ask', () => {
  test('the condition a claim adds, and the check that says why it was refused', () => {
    expect(claimableBy('v:vol-9', NOW)).toEqual({ OR: [{ askedOfId: null }, { askedOfId: 'v:vol-9' }, { askedAt: { lt: new Date(NOW - ASK_HOLD_MS) } }] });
    const row = street({ askedOfId: 'v:vol-2', askedAt: ago(3) });
    expect(keptFromOthers(row, 'v:vol-9', NOW)).toBe(true);
    expect(keptFromOthers(row, 'v:vol-2', NOW)).toBe(false);
    expect(keptFromOthers({ ...row, askedAt: ago(40) }, 'v:vol-9', NOW)).toBe(false);
    expect(keptFromOthers(street(), 'v:vol-9', NOW)).toBe(false);
    expect(keptFromOthers(null, 'v:vol-9', NOW)).toBe(false);
  });

  test('clearing an ask empties every field of it', () => {
    expect(clearAsk()).toEqual(EMPTY);
    expect(clearAsk()).not.toBe(clearAsk());
  });
});
