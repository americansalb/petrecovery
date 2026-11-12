/**
 * The last of the older routes about one pet's search, and three routes
 * that anyone could call without limit:
 *
 *   /api/mission/[missionId]/tasks/[taskId]   one task, and joining it
 *   /api/mission/[missionId]/tips/[tipId]     putting a tip away, or marking it posted
 *   /api/shelters/animals                     asks outside services on this site's keys
 *   /api/mapping/heatmap                      every sighting of a pet
 *   /api/users/[id]/profile                   a person's public profile
 *
 * The first two answered any account, for any pet; the task route named
 * people by account id and full name and let anyone put themselves on a
 * pet's tasks. They are for the owner, the forces looking and staff. The
 * other three are counted per connection and take sensible sizes.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    user: { findUnique: jest.fn() },
    squadTask: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    taskParticipant: { findFirst: jest.fn(async () => null), create: jest.fn(async () => ({})), deleteMany: jest.fn(async () => ({ count: 0 })) },
    rescueForce: { findFirst: jest.fn(async () => null) },
    mascotTip: { findFirst: jest.fn() },
    caseSighting: { findMany: jest.fn(async () => []) },
    caseAssignment: { findMany: jest.fn(async () => []) },
    searchArea: { findMany: jest.fn(async () => []) },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn(async () => null) }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: jest.fn(async () => ({ success: true })),
  rateLimitResponse: () => new Response('{}', { status: 429 }),
  RateLimitPresets: { SEARCH_READ: { name: 'read' }, PUBLIC_READ: { name: 'public' } },
}));
jest.mock('@/lib/actions', () => {
  const tips = { dismissTip: jest.fn(async () => {}), markPostedToChat: jest.fn(async () => {}) };
  return { __esModule: true, getTipService: () => tips, __tips: tips };
});
jest.mock('@/app/lib/shelterApi', () => ({ __esModule: true, searchPetfinder: jest.fn(async () => []), searchRescueGroups: jest.fn(async () => []), getConfiguredSources: () => [] }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { searcherFor } from '@/app/lib/searcher';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import * as actions from '@/lib/actions';
import { searchPetfinder } from '@/app/lib/shelterApi';
import { GET as taskGET, POST as taskPOST } from '@/app/api/mission/[missionId]/tasks/[taskId]/route';
import { DELETE as tipDELETE, POST as tipPOST } from '@/app/api/mission/[missionId]/tips/[tipId]/route';
import { GET as animalsGET } from '@/app/api/shelters/animals/route';
import { GET as heatGET } from '@/app/api/mapping/heatmap/route';
import { GET as profileGET } from '@/app/api/users/[id]/profile/route';

const CASE = 'case-max';
const ctx = { params: Promise.resolve({ missionId: CASE, taskId: 'FLYERS', tipId: 'tip-1' }) };
const req = (path, body, method = 'POST') => new NextRequest(`http://localhost/api/${path}`, body === undefined ? undefined : { method, headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const OWNER = { userId: 'u-avery', seesNames: true, isOwner: true };
const STRANGER = { userId: 'u-x', seesNames: false, isOwner: false };
const as = (who) => {
  getServerSession.mockResolvedValue(who ? { user: { id: who.userId, email: `${who.userId}@example.com` } } : null);
  searcherFor.mockResolvedValue(who);
};

beforeEach(() => {
  jest.clearAllMocks();
  withRateLimitAsync.mockResolvedValue({ success: true });
  prisma.user.findUnique.mockImplementation(async ({ where }) => ({ id: where.id || String(where.email || '').split('@')[0], role: 'USER', firstName: 'Kim', lastName: 'Lee', _count: {} }));
  prisma.case.findUnique.mockResolvedValue({ id: CASE, reporterId: 'u-avery', lastSeenLatitude: 30.3, lastSeenLongitude: -97.7 });
  prisma.squadTask.findFirst.mockResolvedValue({
    id: 't-1', status: 'OPEN', ownerRequestedHelp: true, ownerRequestedAt: new Date(0), ownerRequestedMessage: 'Please help with flyers',
    participants: [{ joinedAt: new Date(0), user: { id: 'u-dana', firstName: 'Dana Lee', lastName: 'Okafor' } }, { joinedAt: new Date(0), user: { id: 'u-avery', firstName: 'Avery' } }],
    completedAt: null, completedBy: null, createdBy: { id: 'u-sarah', firstName: 'Sarah', lastName: 'Ng' },
  });
  prisma.mascotTip.findFirst.mockResolvedValue({ id: 'tip-1', tipType: 'FLYER', title: 'Flyers', message: 'Put up flyers' });
  as(OWNER);
});

describe('one task on a pet\'s search', () => {
  const read = () => taskGET(req(`mission/${CASE}/tasks/FLYERS`), ctx);

  test('nobody signed in: 401; a signed-in stranger: 403, and the task is not read', async () => {
    as(null);
    expect((await read()).status).toBe(401);
    as(STRANGER);
    expect((await read()).status).toBe(403);
    expect(prisma.squadTask.findFirst).not.toHaveBeenCalled();
  });

  test('the owner reads it, with people by first name and no account id or last name', async () => {
    const res = await read();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.squadTask.participants.map((p) => [p.name, p.mine])).toEqual([['Dana', false], ['Avery', true]]);
    expect(body.squadTask.createdBy).toEqual({ firstName: 'Sarah' });
    expect(JSON.stringify(body)).not.toMatch(/Okafor|Ng"|u-dana|u-sarah|userId/);
    const asked = prisma.squadTask.findFirst.mock.calls[0][0];
    expect(asked.include.completedBy.select).toEqual({ firstName: true });
    expect(asked.include.createdBy.select).toEqual({ firstName: true });
  });

  test('a stranger cannot put themselves on a pet\'s task', async () => {
    as(STRANGER);
    const res = await taskPOST(req(`mission/${CASE}/tasks/FLYERS`, { action: 'join' }), ctx);
    expect(res.status).toBe(403);
    expect(prisma.taskParticipant.create).not.toHaveBeenCalled();
    expect(prisma.squadTask.create).not.toHaveBeenCalled();
  });

  test('a body that is not an object is an action nobody knows: 400, not a crash', async () => {
    expect((await taskPOST(req(`mission/${CASE}/tasks/FLYERS`, 'junk'), ctx)).status).toBe(400);
  });

  test('writes are counted per connection', async () => {
    withRateLimitAsync.mockResolvedValue({ success: false });
    expect((await taskPOST(req(`mission/${CASE}/tasks/FLYERS`, { action: 'join' }), ctx)).status).toBe(429);
    expect(prisma.case.findUnique).not.toHaveBeenCalled();
  });
});

describe('a tip on a pet\'s search', () => {
  test('a stranger neither puts it away nor marks it posted', async () => {
    as(STRANGER);
    expect((await tipDELETE(req(`mission/${CASE}/tips/tip-1`, {}, 'DELETE'), ctx)).status).toBe(403);
    expect((await tipPOST(req(`mission/${CASE}/tips/tip-1`, { action: 'post_to_chat' }), ctx)).status).toBe(403);
    expect(actions.__tips.dismissTip).not.toHaveBeenCalled();
    expect(actions.__tips.markPostedToChat).not.toHaveBeenCalled();
    expect(prisma.mascotTip.findFirst).not.toHaveBeenCalled();
  });

  test('the owner does both', async () => {
    expect((await tipDELETE(req(`mission/${CASE}/tips/tip-1`, {}, 'DELETE'), ctx)).status).toBe(200);
    expect(actions.__tips.dismissTip).toHaveBeenCalledWith('tip-1', 'u-avery');
    expect((await tipPOST(req(`mission/${CASE}/tips/tip-1`, { action: 'post_to_chat' }), ctx)).status).toBe(200);
    expect(actions.__tips.markPostedToChat).toHaveBeenCalledWith('tip-1');
  });

  test('a body that is not an object: 400', async () => {
    expect((await tipPOST(req(`mission/${CASE}/tips/tip-1`, 'junk'), ctx)).status).toBe(400);
    expect(actions.__tips.markPostedToChat).not.toHaveBeenCalled();
  });
});

describe('routes anyone can call are counted', () => {
  test('shelter animals: counted before any outside service is asked, with sizes that are sizes', async () => {
    await animalsGET(new NextRequest('http://localhost/api/shelters/animals?type=dog&limit=100000&page=-4&distance=abc'));
    expect(withRateLimitAsync.mock.calls[0][2]).toBe('shelters:animals');
    expect(withRateLimitAsync.mock.calls[0][1]).toMatchObject({ windowMs: 60000, maxRequests: 10 });
    expect(searchPetfinder.mock.calls[0][0]).toMatchObject({ limit: 50, page: 1, distance: 50 });
    searchPetfinder.mockClear();
    withRateLimitAsync.mockResolvedValue({ success: false });
    expect((await animalsGET(new NextRequest('http://localhost/api/shelters/animals?type=dog'))).status).toBe(429);
    expect(searchPetfinder).not.toHaveBeenCalled();
  });

  test('the heatmap: counted, and a pet\'s sightings are read up to a number', async () => {
    const res = await heatGET(new NextRequest(`http://localhost/api/mapping/heatmap?missionId=${CASE}&type=sightings`));
    expect(res.status).toBe(200);
    expect(withRateLimitAsync.mock.calls[0][2]).toBe('mapping:heatmap');
    expect(prisma.caseSighting.findMany.mock.calls[0][0].take).toBe(500);
  });

  test('a profile: counted, and an id that is not text is nobody', async () => {
    withRateLimitAsync.mockResolvedValueOnce({ success: false });
    expect((await profileGET(new NextRequest('http://localhost/api/users/u-1/profile'), { params: { id: 'u-1' } })).status).toBe(429);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect((await profileGET(new NextRequest('http://localhost/api/users/x/profile'), { params: {} })).status).toBe(404);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(withRateLimitAsync.mock.calls.at(-1)[2]).toBe('users:profile');
  });
});
