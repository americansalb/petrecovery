/**
 * CRIT-D: when the owner marks the pet home or closes the search, the
 * people who helped are told, so they can stop (POST
 * /api/missions/[missionId]/status, app/lib/searchEnd.js).
 *
 * Testing before launch found that only helpers with a signed-in volunteer
 * row were told: everyone who searched areas through Mission Control has
 * none, so 0 "home" notices were written while 8 helpers held areas, the
 * forces looking got a Discussion post and no bell, the areas people were
 * on stayed open, and the thank-you screen said "1 person searched 1
 * area". These run the route against the real end-of-search code, with
 * only the database mocked.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findUnique: jest.fn() },
    $transaction: jest.fn(),
    // The roster (app/lib/searchTeam.js, teamOf).
    missionVolunteer: { findMany: jest.fn(async () => []) },
    searchMessage: { findMany: jest.fn(async () => []) },
    searchStreet: { findMany: jest.fn(async () => []) },
    searchGrid: { findUnique: jest.fn(async () => null) },
    searchZone: { findMany: jest.fn(async () => []) },
    user: { findMany: jest.fn(async () => []) },
    searchZoneVisit: { updateMany: jest.fn(async () => ({ count: 0 })) },
    caseSighting: { findMany: jest.fn(async () => []) },
    caseParticipant: { findMany: jest.fn(async () => []) },
    // The forces looking for the pet, their members, and their Discussion.
    caseAssignment: { findMany: jest.fn(async () => []) },
    rescueForceMember: { findMany: jest.fn(async () => []) },
    squadPost: { createMany: jest.fn(async () => ({ count: 1 })) },
    notification: { createMany: jest.fn(async ({ data }) => ({ count: data.length })) },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn().mockResolvedValue(undefined) }));

import { POST } from '@/app/api/missions/[missionId]/status/route';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';

const PARAMS = { params: { missionId: 'case-pip' } };
const at = new Date('2026-11-14T19:48:00Z');

function post(body) {
  return POST(new NextRequest('http://localhost:5757/api/missions/case-pip/status', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), PARAMS);
}

/** Who was told, and what: { userId: { title, message, type, actionUrl, data } }. */
function told() {
  const rows = prisma.notification.createMany.mock.calls.flatMap(([arg]) => arg.data);
  const byUser = {};
  for (const row of rows) {
    expect(byUser[row.userId]).toBeUndefined(); // one notice a person
    byUser[row.userId] = row;
  }
  return byUser;
}

// Pip's search: eight helpers on areas when Pip came home (six with an account, two who joined from the link
// without one), David who searched four areas and said so, a witness who sent a sighting, a force with two
// members (one of them also out on an area), and Avery, the owner, on an area of her own.
const visit = (searcherId, searcherName, over = {}) => ({ searcherId, searcherName, askedAt: null, askedSeenAt: null, askedNote: null, askedByName: null, startedAt: at, endedAt: null, outcome: null, ...over });
const ZONES = [
  { id: 'z-middle', name: 'Middle', visits: [visit('u-david', 'David', { endedAt: at, outcome: 'SEARCHED' }), visit('u-jo', 'Jo'), visit('v:vol-1', 'Sam')] },
  { id: 'z-north', name: 'North side', visits: [visit('u-david', 'David', { endedAt: at, outcome: 'SEARCHED' }), visit('u-kim', 'Kim'), visit('u-lee', 'Lee')] },
  { id: 'z-east', name: 'East side', visits: [visit('u-david', 'David', { endedAt: at, outcome: 'SEARCHED' }), visit('u-max', 'Max'), visit('v:vol-2', 'Ola')] },
  { id: 'z-south', name: 'South side', visits: [visit('u-david', 'David', { endedAt: at, outcome: 'SEARCHED' }), visit('u-ned', 'Ned'), visit('u-avery', 'Avery')] },
  { id: 'z-west', name: 'West side', visits: [visit('u-pat', 'Pat'), visit('u-rae', 'Rae', { startedAt: null, askedAt: at, askedByName: 'Avery' })] },
];

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: 'u-avery' } });
  prisma.case.findUnique.mockResolvedValue({
    id: 'case-pip', caseNumber: 'AUS-2026-0042', status: 'ACTIVE', reporterId: 'u-avery',
    petName: 'Pip', ownerName: 'Avery Stone', ownerEmail: 'avery@example.com',
  });
  prisma.$transaction.mockImplementation(async (cb) => cb({
    case: { update: jest.fn().mockResolvedValue({ id: 'case-pip', caseNumber: 'AUS-2026-0042', petName: 'Pip', petSpecies: 'DOG', ownerName: 'Avery Stone', status: 'REUNITED', lastSeenAddress: '1200 Burnet Rd, Austin, TX' }) },
    caseUpdate: { create: jest.fn().mockResolvedValue({}) },
  }));
  prisma.searchZone.findMany.mockResolvedValue(ZONES);
  prisma.missionVolunteer.findMany.mockResolvedValue([
    { id: 'vol-1', displayName: 'Sam', joinedAt: at, userId: null },
    { id: 'vol-2', displayName: 'Ola', joinedAt: at, userId: null },
  ]);
  prisma.searchZoneVisit.updateMany.mockResolvedValue({ count: 9 });
  prisma.notification.createMany.mockImplementation(async ({ data }) => ({ count: data.length }));
  prisma.caseSighting.findMany.mockResolvedValue([{ reportedById: 'u-wit' }, { reportedById: 'u-avery' }]);
  prisma.caseAssignment.findMany.mockResolvedValue([{ rescueSquadId: 'force-austin' }]);
  prisma.rescueForceMember.findMany.mockResolvedValue([{ userId: 'u-fay' }, { userId: 'u-jo' }]);
});

describe('the pet is home', () => {
  test('everyone with an account who helped gets one "home" notice: on an area, searched one, asked for one, or sent a sighting', async () => {
    const res = await post({ status: 'REUNITED', resolution: 'REUNITED' });
    expect(res.status).toBe(200);
    const byUser = told();
    for (const id of ['u-david', 'u-jo', 'u-kim', 'u-lee', 'u-max', 'u-ned', 'u-pat', 'u-rae', 'u-wit']) {
      expect(byUser[id]).toMatchObject({
        type: 'CASE_UPDATE',
        title: 'Pip is home',
        message: 'Pip is back with the family and the search is over. Thank you for helping.',
        actionUrl: '/cases/AUS-2026-0042',
      });
      expect(JSON.parse(byUser[id].data)).toEqual({ caseId: 'case-pip', caseNumber: 'AUS-2026-0042', kind: 'HOME' });
    }
  });

  test('the forces looking for the pet get the bell too, and a member who also searched is told once', async () => {
    await post({ status: 'REUNITED' });
    const byUser = told();
    expect(byUser['u-fay']).toMatchObject({ title: 'Pip is home', message: 'Pip is back with the family and the search is over.' });
    expect(byUser['u-jo'].message).toMatch(/Thank you for helping\.$/);
    expect(prisma.rescueForceMember.findMany).toHaveBeenCalledWith({ where: { rescueSquadId: { in: ['force-austin'] }, isActive: true }, select: { userId: true } });
    // The Discussion post is still written.
    expect(prisma.squadPost.createMany.mock.calls[0][0].data[0]).toMatchObject({ rescueSquadId: 'force-austin', kind: 'HOME', title: 'Pip is home' });
  });

  test('the owner is not told what she did, and a helper with no account has no bell', async () => {
    await post({ status: 'REUNITED' });
    const ids = Object.keys(told()).sort();
    expect(ids).toEqual(['u-david', 'u-fay', 'u-jo', 'u-kim', 'u-lee', 'u-max', 'u-ned', 'u-pat', 'u-rae', 'u-wit']);
    expect(ids.some((id) => id.startsWith('v:'))).toBe(false);
  });

  test('the areas people were still on, and an ask nobody started, are closed as ended', async () => {
    await post({ status: 'REUNITED' });
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledTimes(1);
    const { where, data } = prisma.searchZoneVisit.updateMany.mock.calls[0][0];
    expect(where).toEqual({ caseId: 'case-pip', endedAt: null });
    expect(data.outcome).toBe('ENDED');
    expect(data.endedAt).toBeInstanceOf(Date);
  });

  test('the words are plain: no emoji, no dash between clauses, nothing promised', async () => {
    await post({ status: 'REUNITED' });
    for (const row of Object.values(told())) {
      expect(`${row.title} ${row.message}`).not.toMatch(/[\u{1F300}-\u{1FAFF}]|—|!/u);
    }
  });

  test('a database that will not take the notices does not fail the status change', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    prisma.notification.createMany.mockRejectedValue(new Error('db down'));
    prisma.searchZoneVisit.updateMany.mockRejectedValue(new Error('db down'));
    const res = await post({ status: 'REUNITED' });
    expect(res.status).toBe(200);
    console.error.mockRestore();
  });
});

describe('the search is closed, or not over', () => {
  test('a closed search tells the same people, in words for a close', async () => {
    prisma.$transaction.mockImplementation(async (cb) => cb({
      case: { update: jest.fn().mockResolvedValue({ id: 'case-pip', caseNumber: 'AUS-2026-0042', petName: 'Pip', ownerName: 'Avery Stone', status: 'CLOSED_OTHER' }) },
      caseUpdate: { create: jest.fn().mockResolvedValue({}) },
    }));
    await post({ status: 'CLOSED_OTHER', resolution: 'SEARCH_CEASED' });
    const byUser = told();
    expect(byUser['u-david']).toMatchObject({ title: 'The search for Pip has ended', message: 'Avery closed the search for Pip. Thank you for helping.' });
    expect(byUser['u-fay'].message).toBe('Avery closed the search for Pip.');
    expect(JSON.parse(byUser['u-david'].data).kind).toBe('CLOSED');
    expect(prisma.searchZoneVisit.updateMany.mock.calls[0][0].data.outcome).toBe('ENDED');
  });

  test('a status change that does not end the search tells nobody and closes nothing', async () => {
    const res = await post({ status: 'SIGHTING_REPORTED' });
    expect(res.status).toBeLessThan(300);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(prisma.searchZoneVisit.updateMany).not.toHaveBeenCalled();
  });

  test('a non-owner / non-admin cannot change status (403), and nobody is told', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'stranger' } });
    const res = await post({ status: 'REUNITED' });
    expect(res.status).toBe(403);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(prisma.searchZoneVisit.updateMany).not.toHaveBeenCalled();
  });
});
