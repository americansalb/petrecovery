/**
 * The Rescue Force member area: the routes its new pages call, with the real
 * logEvent (its validation is what broke three of them in production).
 *
 * - Leaving a force answered 500 on every request after the member had been
 *   taken out: logEvent refuses action 'leave', and the catch block then
 *   threw on a `session` it could not see. A founder with no successor got
 *   that 500 instead of the explanation.
 * - Claiming leadership of a leaderless force logged actor_role 'LEADER',
 *   which logEvent refuses, so it answered 500 while the promotion saved.
 * - Saving a force's settings logged the force role ('FOUNDER'), so every
 *   save answered 500 after writing the change.
 * - Divisions take an area from a ZIP code; announcements mark the canned
 *   welcome post; members-only pages send outsiders away before rendering.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    rescueForceMember: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
    rescueForce: { findFirst: jest.fn(), update: jest.fn() },
    caseParticipant: { findMany: jest.fn(), update: jest.fn() },
    division: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    squadActivity: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    eventLog: { create: jest.fn() },
  },
}));
// The real logEvent runs (its validation is under test); only its id
// generator is stubbed, because Jest cannot load uuid's ESM build.
jest.mock('uuid', () => ({ __esModule: true, v4: () => '00000000-0000-4000-8000-000000000000' }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('next/navigation', () => ({
  __esModule: true,
  redirect: jest.fn((url) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { url });
  }),
}));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { POST as leave } from '@/app/api/rescue-forces/[id]/leave/route';
import { POST as claim } from '@/app/api/rescue-forces/[id]/claim-leadership/route';
import { PATCH as saveSettings } from '@/app/api/rescue-forces/[id]/route';
import { POST as createDivision } from '@/app/api/rescue-forces/[id]/divisions/route';
import { GET as announcements } from '@/app/api/rescue-forces/[id]/announcements/route';
import { requireForceMember } from '@/app/lib/forceViewer';
import { memberName } from '@/app/lib/forceRoles';

const FORCE = 'force-1';
const ctx = { params: { id: FORCE } };
const post = (url, body) => new Request(`http://localhost${url}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  getServerSession.mockResolvedValue({ user: { id: 'user-1', role: 'USER' } });
  prisma.eventLog.create.mockResolvedValue({});
});
afterEach(() => console.error.mockRestore());

describe('leaving a force', () => {
  test('a member leaves and gets a 200', async () => {
    prisma.rescueForceMember.findUnique.mockResolvedValue({ id: 'm-1', role: 'MEMBER', isActive: true });
    prisma.caseParticipant.findMany.mockResolvedValue([]);
    const res = await leave(post(`/api/rescue-forces/${FORCE}/leave`), ctx);
    expect(res.status).toBe(200);
    expect(prisma.rescueForceMember.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }));
    expect(prisma.eventLog.create).toHaveBeenCalled();
  });

  test('a founder with no other leader is told what to do, not given a 500', async () => {
    prisma.rescueForceMember.findUnique.mockResolvedValue({ id: 'm-1', role: 'FOUNDER', isActive: true });
    prisma.rescueForceMember.count.mockResolvedValue(0);
    const res = await leave(post(`/api/rescue-forces/${FORCE}/leave`), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/promote another member to leader/);
    expect(prisma.rescueForceMember.update).not.toHaveBeenCalled();
  });

  test('a moderator account can leave too', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1', role: 'MODERATOR' } });
    prisma.rescueForceMember.findUnique.mockResolvedValue({ id: 'm-1', role: 'MEMBER', isActive: true });
    prisma.caseParticipant.findMany.mockResolvedValue([]);
    expect((await leave(post(`/api/rescue-forces/${FORCE}/leave`), ctx)).status).toBe(200);
  });
});

test('claiming leadership of a leaderless force answers 200', async () => {
  prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'm-1', role: 'MEMBER', isActive: true });
  prisma.rescueForceMember.count.mockResolvedValue(0);
  prisma.rescueForceMember.update.mockResolvedValue({ id: 'm-1', role: 'LEADER' });
  const res = await claim(post(`/api/rescue-forces/${FORCE}/claim-leadership`), ctx);
  expect(res.status).toBe(200);
  expect(prisma.rescueForceMember.update).toHaveBeenCalledWith({ where: { id: 'm-1' }, data: { role: 'LEADER' } });
});

test('saving settings as a founder answers 200', async () => {
  prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'm-1', role: 'FOUNDER', isActive: true });
  prisma.rescueForce.update.mockResolvedValue({ id: FORCE, availableNight: true });
  const res = await saveSettings(new Request(`http://localhost/api/rescue-forces/${FORCE}`, { method: 'PATCH', body: JSON.stringify({ availableNight: true }) }), ctx);
  expect(res.status).toBe(200);
  expect(prisma.rescueForce.update.mock.calls[0][0].data).toEqual({ availableNight: true });
});

describe('division areas', () => {
  beforeEach(() => {
    prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'm-1', role: 'LEADER', isActive: true });
    prisma.division.findFirst.mockResolvedValue(null);
    prisma.division.create.mockImplementation(async ({ data }) => ({ id: 'div-1', createdAt: new Date(), ...data }));
  });

  test('a ZIP code gives the division its centre', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [{ latitude: '30.2426', longitude: '-97.7658', 'place name': 'Austin', 'state abbreviation': 'TX' }] }),
    });
    const res = await createDivision(post(`/api/rescue-forces/${FORCE}/divisions`, { name: 'Zilker', zipCode: '78704', radiusMiles: 2 }), ctx);
    expect(res.status).toBe(200);
    expect(prisma.division.create.mock.calls[0][0].data).toMatchObject({
      name: 'Zilker',
      radiusMiles: 2,
      centerLatitude: 30.2426,
      centerLongitude: -97.7658,
      zipCodes: '["78704"]',
    });
    expect((await res.json()).division).toMatchObject({ zipCode: '78704', radiusMiles: 2, hasArea: true });
  });

  test('an unknown ZIP code is a clear 400', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    const res = await createDivision(post(`/api/rescue-forces/${FORCE}/divisions`, { name: 'Nowhere', zipCode: '00000' }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/00000/);
    expect(prisma.division.create).not.toHaveBeenCalled();
  });
});

test('announcements mark the canned welcome post', async () => {
  prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'm-1', role: 'MEMBER', isActive: true });
  prisma.squadActivity.findMany.mockResolvedValue([
    { id: 'a1', actorId: 's', message: 'Welcome...', details: '{"isSystemPost":true}', createdAt: new Date(), actor: { firstName: 'Sarama', lastName: '' } },
    { id: 'a2', actorId: 'u', message: 'Search Saturday', details: '{"title":"Search"}', createdAt: new Date(), actor: { firstName: 'Kim', lastName: 'Lee' } },
  ]);
  const res = await announcements(new Request(`http://localhost/api/rescue-forces/${FORCE}/announcements`), ctx);
  const list = (await res.json()).announcements;
  expect(list.map((a) => [a.id, a.isSystemPost, a.authorName])).toEqual([
    ['a1', true, 'Sarama'],
    ['a2', false, 'Kim L.'],
  ]);
});

describe('members-only pages', () => {
  beforeEach(() => {
    prisma.rescueForce.findFirst.mockResolvedValue({ id: FORCE, name: 'Austin Rescue Force', city: 'Austin', state: 'TX' });
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
  });

  test('signed out goes to sign in, and back here after', async () => {
    getServerSession.mockResolvedValue(null);
    await expect(requireForceMember(FORCE, `/rescue-forces/${FORCE}/chat`)).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith(`/login?callbackUrl=${encodeURIComponent(`/rescue-forces/${FORCE}/chat`)}`);
  });

  test('a signed-in outsider goes to the public page', async () => {
    prisma.rescueForceMember.findFirst.mockResolvedValue(null);
    await expect(requireForceMember(FORCE, `/rescue-forces/${FORCE}/chat`)).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith(`/rescue-forces/${FORCE}`);
  });

  test('a member gets in; a member is not a leader', async () => {
    prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'm-1', role: 'MEMBER', divisionId: null });
    const viewer = await requireForceMember(FORCE, `/rescue-forces/${FORCE}/chat`);
    expect(viewer.membership.role).toBe('MEMBER');
    await expect(requireForceMember(FORCE, `/rescue-forces/${FORCE}/settings`, { leadersOnly: true })).rejects.toThrow('NEXT_REDIRECT');
  });

  test('a leader gets into settings', async () => {
    prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'm-1', role: 'LEADER', divisionId: null });
    const viewer = await requireForceMember(FORCE, `/rescue-forces/${FORCE}/settings`, { leadersOnly: true });
    expect(viewer.isLeader).toBe(true);
    expect(redirect).not.toHaveBeenCalled();
  });
});

test('memberName shows a first name and last initial', () => {
  expect(memberName({ firstName: 'Kim', lastName: 'lee' })).toBe('Kim L.');
  expect(memberName({ firstName: 'Kim', lastName: '' })).toBe('Kim');
  expect(memberName({ firstName: '', lastName: '' })).toBe('A member');
});
