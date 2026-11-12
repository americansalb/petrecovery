/**
 * The people on a pet's search (app/lib/searchTeam.js): who joined, what
 * each is doing now, and what each has done. It is what the desk shows
 * under "People", and how a named person is given a street or sent a
 * word.
 *
 * Two things matter as much as the list. Nobody is handed out by their
 * id: the desk knows a person by a handle that means something only for
 * this pet. And the owner, who runs the search, is not one of the people
 * helping it.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    missionVolunteer: { findMany: jest.fn(async () => []) },
    searchStreet: { findMany: jest.fn(async () => []) },
    searchMessage: { findMany: jest.fn(async () => []) },
    searchGrid: { findUnique: jest.fn(async () => null) },
    user: { findMany: jest.fn(async () => []) },
  },
}));

import prisma from '@/app/lib/prisma';
import { roster, forDesk, handleFor, askHolds, teamOf, personByHandle, ASK_HOLD_MS, NAME_MAX } from '@/app/lib/searchTeam';

const CASE = 'case-max';
const NOW = new Date('2026-11-12T22:00:00Z').getTime();
const ago = (minutes) => new Date(NOW - minutes * 60000);
const street = (over = {}) => ({ id: 'st-1', name: 'Ramsey Ave', fromName: 'W 40th St', toName: 'W 44th St', status: 'UNSEARCHED', claimedById: null, claimedByName: null, claimedAt: null, searchedById: null, searchedByName: null, searchedAt: null, searchCount: 0, askedOfId: null, askedOfName: null, askedByName: null, askedAt: null, askedSeenAt: null, askedNote: null, ...over });
const helper = (over = {}) => ({ id: 'vol-1', displayName: 'Dana Whitfield', joinedAt: ago(50), userId: null, ...over });
const by = (list) => Object.fromEntries(list.map((p) => [p.name, p]));

describe('roster: who is on the search and what each is doing', () => {
  test('someone who joined from the link and has done nothing is free, by first name', () => {
    const team = roster({ caseId: CASE, helpers: [helper()], now: NOW });
    expect(team).toHaveLength(1);
    expect(team[0]).toMatchObject({ id: 'v:vol-1', name: 'Dana', kind: 'helper', state: 'free', on: null, asked: null, walked: 0, joinedAt: ago(50) });
  });

  test('walking, asked and free, with what each has walked', () => {
    const team = by(
      roster({
        caseId: CASE,
        helpers: [helper(), helper({ id: 'vol-2', displayName: 'Jo', joinedAt: ago(2) }), helper({ id: 'vol-3', displayName: 'Sam', joinedAt: ago(90) })],
        streets: [
          street({ id: 'st-1', status: 'IN_PROGRESS', claimedById: 'v:vol-1', claimedByName: 'Dana', claimedAt: ago(40) }),
          street({ id: 'st-2', name: 'W 42nd St', fromName: 'Rosedale Ave', toName: 'Shoalwood Ave', askedOfId: 'v:vol-2', askedOfName: 'Jo', askedByName: 'Avery Lindqvist', askedAt: ago(1), askedNote: 'Check the alley.' }),
          street({ id: 'st-3', name: 'W 43rd St', status: 'SEARCHED', searchedById: 'v:vol-3', searchedByName: 'Sam', searchedAt: ago(10), searchCount: 1 }),
          street({ id: 'st-4', name: 'Shoalwood Ave', status: 'SEARCHED', searchedById: 'v:vol-3', searchedByName: 'Sam', searchedAt: ago(30), searchCount: 2 }),
          street({ id: 'st-5', name: 'Burnet Rd', status: 'SEARCHED', searchedById: 'u-sarah', searchedByName: 'Sarah', searchedAt: ago(20), searchCount: 1 }),
        ],
        now: NOW,
      })
    );
    expect(team.Dana).toMatchObject({ state: 'walking', on: { unit: 'street', id: 'st-1', title: 'Ramsey Ave from W 40th St to W 44th St' }, since: ago(40) });
    expect(team.Jo).toMatchObject({ state: 'asked', on: null, asked: { id: 'st-2', title: 'W 42nd St from Rosedale Ave to Shoalwood Ave', at: ago(1), seenAt: null, note: 'Check the alley.', byName: 'Avery', holds: true } });
    // The street walked last is kept: it is the nearest thing to where they are that the search knows.
    expect(team.Sam).toMatchObject({ state: 'free', walked: 2, lastWalkedAt: ago(10), lastOn: { unit: 'street', id: 'st-3', title: 'W 43rd St from W 40th St to W 44th St' } });
    // Someone signed in who walked a street is on the roster too, as a member.
    expect(team.Sarah).toMatchObject({ kind: 'member', state: 'free', walked: 1 });
  });

  test('free people come first, then the asked, then those walking', () => {
    const team = roster({
      caseId: CASE,
      helpers: [helper(), helper({ id: 'vol-2', displayName: 'Jo', joinedAt: ago(2) }), helper({ id: 'vol-3', displayName: 'Sam', joinedAt: ago(90) })],
      streets: [street({ status: 'IN_PROGRESS', claimedById: 'v:vol-1', claimedAt: ago(40) }), street({ id: 'st-2', askedOfId: 'v:vol-3', askedAt: ago(3) })],
      now: NOW,
    });
    expect(team.map((p) => [p.name, p.state])).toEqual([['Jo', 'free'], ['Sam', 'asked'], ['Dana', 'walking']]);
  });

  test('someone walking the street they were asked to walk is walking, and still shown as asked for it', () => {
    const [dana] = roster({ caseId: CASE, helpers: [helper()], streets: [street({ status: 'IN_PROGRESS', claimedById: 'v:vol-1', claimedAt: ago(5), askedOfId: 'v:vol-1', askedAt: ago(9), askedSeenAt: ago(8) })], now: NOW });
    expect(dana).toMatchObject({ state: 'walking', on: { id: 'st-1' }, asked: { id: 'st-1', seenAt: ago(8) } });
  });

  test('the owner runs the search and is not one of the people helping it', () => {
    const team = roster({ caseId: CASE, ownerId: 'u-avery', streets: [street({ status: 'IN_PROGRESS', claimedById: 'u-avery', claimedByName: 'Avery', claimedAt: ago(5) }), street({ id: 'st-2', status: 'SEARCHED', searchedById: 'u-avery', searchedAt: ago(30), searchCount: 1 })], now: NOW });
    expect(team).toEqual([]);
  });

  test('a street put down as walked from the desk adds nobody', () => {
    const team = roster({ caseId: CASE, streets: [street({ status: 'SEARCHED', searchedById: 'm:u-avery', searchedByName: 'Avery', searchedAt: ago(5), searchCount: 1 })], now: NOW });
    expect(team).toEqual([]);
  });

  test('squares count the same, by the key the board keeps for a helper with no account', () => {
    const cell = { id: 'c-1', row: 0, col: 2, status: 'SEARCHED', claimedById: null, claimedAt: null, searchedById: null, searchedByKey: 'v:vol-1', searchedAt: ago(15), searchCount: 1 };
    const held = { id: 'c-2', row: 1, col: 2, status: 'IN_PROGRESS', claimedById: 'u-mike', claimedAt: ago(4), searchedById: null, searchedByKey: null, searchedAt: null, searchCount: 0 };
    const team = by(roster({ caseId: CASE, helpers: [helper()], cells: [cell, held], users: { 'u-mike': 'Mike Okafor' }, now: NOW }));
    expect(team.Dana).toMatchObject({ walked: 1, lastWalkedAt: ago(15) });
    expect(team.Mike).toMatchObject({ kind: 'member', state: 'walking', on: { unit: 'block', id: 'c-2', title: 'Block C2' } });
  });

  test('someone signed in who also joined from the link is one person', () => {
    const team = roster({ caseId: CASE, helpers: [helper({ userId: 'u-dana' })], streets: [street({ status: 'IN_PROGRESS', claimedById: 'u-dana', claimedByName: 'Dana', claimedAt: ago(3) })], now: NOW });
    expect(team).toHaveLength(1);
    expect(team[0]).toMatchObject({ id: 'u-dana', kind: 'member', state: 'walking' });
  });

  test('everyone the desk has exchanged a word with stays on the roster, whatever became of their street', () => {
    // Pat (an account, in no force) took a street, was written to, and gave the street back: nothing on the board
    // names Pat any more. Sam, in the force, never took a street and wrote to the desk. Both must stay people
    // the owner can answer, and Pat must stay able to write back.
    const messages = [
      { fromId: 'u-avery', fromName: 'Avery', fromDesk: true, toId: 'u-pat', toName: 'Pat' },
      { fromId: 'u-sam', fromName: 'Sam', fromDesk: false, toId: null, toName: null },
    ];
    const team = by(roster({ caseId: CASE, helpers: [], streets: [street()], messages, ownerId: 'u-avery', now: NOW }));
    expect(Object.keys(team).sort()).toEqual(['Pat', 'Sam']);
    expect(team.Pat).toMatchObject({ id: 'u-pat', state: 'free', kind: 'member', walked: 0, joinedAt: null });
    expect(team.Sam).toMatchObject({ id: 'u-sam', state: 'free' });
    // The owner wrote the first one and is still not one of the people helping.
    expect(roster({ caseId: CASE, messages, ownerId: 'u-avery', now: NOW }).some((p) => p.id === 'u-avery')).toBe(false);
  });

  test('a name is one word and not a paragraph: a helper types their own', () => {
    const long = `${'A'.repeat(200)} Smith`;
    const [p] = roster({ caseId: CASE, helpers: [helper({ displayName: long })], now: NOW });
    expect(p.name).toHaveLength(NAME_MAX);
    expect(NAME_MAX).toBeLessThanOrEqual(40);
  });

  test('a person nobody can name is "A helper", never an id', () => {
    const [p] = roster({ caseId: CASE, streets: [street({ status: 'IN_PROGRESS', claimedById: 'u-gone', claimedAt: ago(3) })], now: NOW });
    expect(p.name).toBe('A helper');
  });
});

describe('an ask keeps a street for the person asked for half an hour', () => {
  test('held until then, and open to anyone after', () => {
    expect(ASK_HOLD_MS).toBe(30 * 60 * 1000);
    expect(askHolds(ago(29), NOW)).toBe(true);
    expect(askHolds(ago(31), NOW)).toBe(false);
    expect(askHolds(null, NOW)).toBe(false);
    const [jo] = roster({ caseId: CASE, helpers: [helper({ id: 'vol-2', displayName: 'Jo' })], streets: [street({ askedOfId: 'v:vol-2', askedAt: ago(45) })], now: NOW });
    expect(jo.asked.holds).toBe(false);
    expect(jo.state).toBe('asked');
  });
});

describe('a person is known to the desk by a handle, never by their id', () => {
  test('the handle is steady for a person on a pet, and different on another pet', () => {
    expect(handleFor(CASE, 'v:vol-1')).toBe(handleFor(CASE, 'v:vol-1'));
    expect(handleFor(CASE, 'v:vol-1')).not.toBe(handleFor('case-luna', 'v:vol-1'));
    expect(handleFor(CASE, 'v:vol-1')).not.toBe(handleFor(CASE, 'v:vol-2'));
    expect(handleFor(CASE, 'v:vol-1')).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(handleFor(CASE, 'v:vol-1')).not.toContain('vol-1');
  });

  test('what is sent to the desk has no id in it', () => {
    const team = roster({ caseId: CASE, helpers: [helper()], streets: [street({ status: 'IN_PROGRESS', claimedById: 'v:vol-1', claimedAt: ago(4) })], now: NOW });
    const sent = team.map((p) => forDesk(p));
    expect(sent[0]).not.toHaveProperty('id');
    expect(sent[0].handle).toBe(handleFor(CASE, 'v:vol-1'));
    expect(JSON.stringify(sent)).not.toMatch(/vol-1/);
  });

  test('the note on an ask goes to whoever runs the search, and to nobody else who sees the roster', () => {
    // A member of a Rescue Force that is looking sees names. The note is the owner's word to one person
    // ("Her gate code is 4411"), and joining a force takes one tap.
    const asked = street({ askedOfId: 'v:vol-1', askedOfName: 'Dana', askedByName: 'Avery', askedAt: ago(3), askedNote: 'Her gate code is 4411, go round the back.' });
    const team = roster({ caseId: CASE, helpers: [helper()], streets: [asked], now: NOW });
    const forOwner = team.map((p) => forDesk(p, { notes: true }));
    expect(forOwner[0].asked).toMatchObject({ note: 'Her gate code is 4411, go round the back.', byName: 'Avery', title: 'Ramsey Ave from W 40th St to W 44th St' });
    for (const sent of [team.map((p) => forDesk(p)), team.map((p) => forDesk(p, { notes: false }))]) {
      // That she was asked, for which street and when: yes. What was said: no.
      expect(sent[0].asked).toMatchObject({ title: 'Ramsey Ave from W 40th St to W 44th St', at: ago(3), seenAt: null, holds: true });
      expect(sent[0].asked).not.toHaveProperty('note');
      expect(sent[0].asked).not.toHaveProperty('byName');
      expect(JSON.stringify(sent)).not.toMatch(/4411|gate code/);
    }
    // Someone with no ask is sent as they are.
    expect(forDesk({ id: 'x', handle: 'h', name: 'Jo', asked: null })).toEqual({ handle: 'h', name: 'Jo', asked: null });
  });
});

describe('teamOf and personByHandle: read from the database', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.missionVolunteer.findMany.mockResolvedValue([helper()]);
    prisma.searchStreet.findMany.mockResolvedValue([street({ status: 'IN_PROGRESS', claimedById: 'v:vol-1', claimedByName: 'Dana', claimedAt: ago(4) })]);
    prisma.searchGrid.findUnique.mockResolvedValue({ cells: [{ id: 'c-1', row: 0, col: 0, status: 'IN_PROGRESS', claimedById: 'u-mike', claimedAt: ago(2), searchedById: null, searchedByKey: null, searchedAt: null, searchCount: 0 }] });
    prisma.user.findMany.mockResolvedValue([{ id: 'u-mike', firstName: 'Mike' }]);
    prisma.searchMessage.findMany.mockResolvedValue([]);
  });

  test('reads this pet only, never the streets outside the board, and names whoever the rows do not', async () => {
    const team = await teamOf(CASE, { ownerId: 'u-avery', now: NOW });
    expect(team.map((p) => p.name).sort()).toEqual(['Dana', 'Mike']);
    expect(prisma.missionVolunteer.findMany.mock.calls[0][0].where).toEqual({ mission: { caseId: CASE } });
    expect(prisma.searchStreet.findMany.mock.calls[0][0].where).toEqual({ caseId: CASE, context: false });
    expect(prisma.searchGrid.findUnique.mock.calls[0][0].where).toEqual({ caseId: CASE });
    // Only the one nobody named already is looked up, and by first name.
    expect(prisma.user.findMany).toHaveBeenCalledWith({ where: { id: { in: ['u-mike'] } }, select: { id: true, firstName: true } });
  });

  test('someone the desk has only talked with is read too, so the owner can answer them', async () => {
    prisma.searchMessage.findMany.mockResolvedValue([{ fromId: 'u-sam', fromName: 'Sam', fromDesk: false, toId: null, toName: null }]);
    const team = await teamOf(CASE, { ownerId: 'u-avery', now: NOW });
    expect(team.map((p) => p.name).sort()).toEqual(['Dana', 'Mike', 'Sam']);
    expect(prisma.searchMessage.findMany.mock.calls[0][0]).toMatchObject({ where: { caseId: CASE }, select: { fromId: true, fromName: true, fromDesk: true, toId: true, toName: true } });
    expect(await personByHandle(CASE, handleFor(CASE, 'u-sam'), { ownerId: 'u-avery', now: NOW })).toMatchObject({ id: 'u-sam', name: 'Sam' });
  });

  test('a handle finds its person on this pet, and nobody on another', async () => {
    const dana = await personByHandle(CASE, handleFor(CASE, 'v:vol-1'), { now: NOW });
    expect(dana).toMatchObject({ id: 'v:vol-1', name: 'Dana' });
    expect(await personByHandle(CASE, handleFor('case-luna', 'v:vol-1'), { now: NOW })).toBeNull();
    expect(await personByHandle(CASE, 'v:vol-1', { now: NOW })).toBeNull();
    expect(await personByHandle(CASE, '', { now: NOW })).toBeNull();
    expect(await personByHandle(CASE, null, { now: NOW })).toBeNull();
  });
});
