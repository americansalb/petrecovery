/**
 * A recorded walk is its walker's own (POST /api/mission/[missionId]/search:
 * ping, mark, end, cancel).
 *
 * A walk was found by its id alone. With someone else's id, an account
 * could put points into their path, or end their walk; and what the walk
 * had earned went to whoever ended it. Each is now found as this person's
 * own walk for this pet.
 *
 * And a walk can be ended at all. The end asked the database for the walk's
 * pet through the walk, which the schema has no link for, so every end that
 * named a walk failed. A mocked database accepts any field, so the last
 * test reads the schema itself.
 */

import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    case: { findFirst: jest.fn(), findUnique: jest.fn() },
    searchSession: { updateMany: jest.fn(async () => ({ count: 0 })), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    locationPing: { create: jest.fn() },
    caseParticipant: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn(async () => ({ user: { id: 'u-mike', email: 'mike@example.com' } })) }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => {}) }));
jest.mock('@/app/lib/sse/missionStream', () => ({ __esModule: true, broadcast: jest.fn() }));
jest.mock('@/lib/actions', () => ({ __esModule: true, getPointsService: jest.fn() }));
jest.mock('@/app/lib/volunteer/quickJoin', () => ({ __esModule: true, quickJoinCase: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { getPointsService } from '@/lib/actions';
import { POST } from '@/app/api/mission/[missionId]/search/route';

const CASE = 'cmuh8qki0000d3zr9v5n1kdjy';
const post = (body) => POST(new NextRequest(`http://localhost/api/mission/${CASE}/search`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: { missionId: CASE } });

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue({ id: 'u-mike' });
  prisma.searchSession.updateMany.mockResolvedValue({ count: 0 });
  // Someone else's walk is not this person's: asked for as their own, it is not found.
  prisma.searchSession.findFirst.mockResolvedValue(null);
});

test.each([
  ['ping', { action: 'ping', sessionId: 'walk-of-dana', latitude: 30.3, longitude: -97.7 }],
  ['mark', { action: 'mark', sessionId: 'walk-of-dana', point: { lat: 30.3, lng: -97.7, accuracy: 9, inZone: true } }],
])('%s with someone else\'s walk id finds no walk, and writes nothing', async (_what, body) => {
  const res = await post(body);
  expect(res.status).toBe(404);
  expect(prisma.searchSession.findFirst.mock.calls.at(-1)[0].where).toEqual({ id: 'walk-of-dana', userId: 'u-mike', missionId: CASE });
  expect(prisma.searchSession.findUnique).not.toHaveBeenCalled();
  expect(prisma.searchSession.update).not.toHaveBeenCalled();
  expect(prisma.locationPing.create).not.toHaveBeenCalled();
});

test.each(['end', 'cancel'])('%s with someone else\'s walk id ends nothing of theirs', async (action) => {
  const res = await post({ action, sessionId: 'walk-of-dana' });
  expect(res.status).toBe(200);
  expect(prisma.searchSession.findFirst.mock.calls.some(([q]) => JSON.stringify(q.where) === JSON.stringify({ id: 'walk-of-dana', userId: 'u-mike', missionId: CASE }))).toBe(true);
  // Their walk is not looked up by its id alone, and is not written to.
  expect(prisma.searchSession.findUnique).not.toHaveBeenCalled();
  expect(prisma.searchSession.update).not.toHaveBeenCalled();
  // Whatever is ended as a fallback is this person's own, for this pet.
  for (const [q] of prisma.searchSession.updateMany.mock.calls) expect(q.where).toMatchObject({ userId: 'u-mike', missionId: CASE });
});

test('a walk id that is not text is not looked for', async () => {
  expect((await post({ action: 'ping', sessionId: { $ne: null }, latitude: 30.3, longitude: -97.7 })).status).toBe(400);
  await post({ action: 'end', sessionId: { $ne: null } });
  expect(prisma.searchSession.findUnique).not.toHaveBeenCalled();
  expect(prisma.searchSession.update).not.toHaveBeenCalled();
});

test('their own walk is found and takes the point', async () => {
  prisma.searchSession.findFirst.mockResolvedValue({ id: 'walk-of-mike', status: 'ACTIVE', userId: 'u-mike', missionId: CASE, locationPings: [], totalDistanceMiles: 0, validatedDistanceMiles: 0 });
  prisma.searchSession.update.mockResolvedValue({});
  prisma.locationPing.create.mockResolvedValue({});
  const res = await post({ action: 'ping', sessionId: 'walk-of-mike', latitude: 30.3, longitude: -97.7, accuracy: 8 });
  expect(res.status).toBe(200);
  expect(prisma.locationPing.create).toHaveBeenCalledTimes(1);
});

describe('ending a walk', () => {
  const walk = {
    id: 'walk-of-mike',
    status: 'ACTIVE',
    startedAt: new Date(Date.now() - 20 * 60 * 1000),
    totalDistanceMiles: 0.4,
    validatedDistanceMiles: 0.4,
    gridCellsCovered: 2,
    lastSeenLat: 30.3,
    lastSeenLng: -97.7,
    locationPings: [],
  };
  const award = jest.fn(async () => ({ verifiedActionId: 'va-1', awardedPoints: 10 }));

  beforeEach(() => {
    award.mockClear();
    getPointsService.mockReturnValue({ awardVerifiedPoints: award });
  });

  test('their own walk is finished, with the pet read on its own', async () => {
    prisma.searchSession.findFirst.mockResolvedValue({ ...walk });
    prisma.case.findUnique.mockResolvedValue({ createdAt: new Date(), petSpecies: 'DOG', petSize: 'MEDIUM', lastSeenAt: new Date() });
    prisma.searchSession.update.mockResolvedValue({});
    const res = await post({ action: 'cancel', sessionId: 'walk-of-mike' });
    expect(res.status).toBe(200);
    expect(prisma.searchSession.update).toHaveBeenCalledTimes(1);
    const { where, data } = prisma.searchSession.update.mock.calls[0][0];
    expect(where).toEqual({ id: 'walk-of-mike' });
    expect(data).toMatchObject({ status: 'COMPLETED', endReason: 'CANCELLED' });
    expect(prisma.case.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: CASE } }));
    // What the walk earned goes to the walker, for this pet.
    expect(award).toHaveBeenCalledTimes(1);
    expect(award.mock.calls[0][0]).toMatchObject({ userId: 'u-mike', missionId: CASE });
  });

  test('every field a walk is asked for is one a walk has', async () => {
    const schema = fs.readFileSync(path.join(__dirname, '../../prisma/schema.prisma'), 'utf8');
    const model = schema.match(/model SearchSession \{([\s\S]*?)\n\}/)[1];
    const fields = model
      .split('\n')
      .map((line) => line.replace(/\/\/.*/, '').trim())
      .filter((line) => line && !line.startsWith('@@'))
      .map((line) => line.split(/\s+/)[0]);
    expect(fields).toEqual(expect.arrayContaining(['id', 'status', 'userId', 'missionId', 'locationPings']));

    prisma.searchSession.findFirst.mockResolvedValue({ ...walk });
    prisma.case.findUnique.mockResolvedValue({ createdAt: new Date(), petSpecies: 'DOG', petSize: 'MEDIUM', lastSeenAt: new Date() });
    prisma.searchSession.update.mockResolvedValue({});
    prisma.locationPing.create.mockResolvedValue({});
    await post({ action: 'ping', sessionId: 'walk-of-mike', latitude: 30.3, longitude: -97.7 });
    await post({ action: 'end', sessionId: 'walk-of-mike' });

    const asked = prisma.searchSession.findFirst.mock.calls.flatMap(([q]) => [...Object.keys(q.where || {}), ...Object.keys(q.select || {}), ...Object.keys(q.include || {})]);
    expect(asked.length).toBeGreaterThan(5);
    expect(asked.filter((name) => !fields.includes(name))).toEqual([]);
  });
});
