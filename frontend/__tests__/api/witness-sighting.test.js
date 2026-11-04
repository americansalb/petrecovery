/**
 * A witness with the pet's link and no account reports a sighting
 * (app/lib/witness.js, POST /api/public/missions/[caseNumber]/sighting):
 * it is checked in words, recorded without an author, and told to the
 * owner and the forces looking for the pet.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findFirst: jest.fn(), update: jest.fn(async () => ({})) },
    caseSighting: { create: jest.fn(async ({ data }) => ({ id: 'sight-1', ...data })) },
    notification: { create: jest.fn(async () => ({})) },
  },
}));
jest.mock('@/app/lib/forceFeed', () => ({
  __esModule: true,
  forcesOf: jest.fn(async () => ['force-1']),
  feedPost: jest.fn(() => ({ title: 't', content: 'c' })),
  postToForces: jest.fn(async () => 1),
}));
jest.mock('@/app/lib/wake', () => ({
  __esModule: true,
  WAKE_KINDS: { SIGHTING: 'FORCE_SIGHTING' },
  wakeForces: jest.fn(async () => ({ bell: 3, pushed: 1 })),
}));
jest.mock('@/app/lib/push', () => ({ __esModule: true, isPushConfigured: () => true, sendPushToUser: jest.fn(async () => ({ sent: 1 })) }));
jest.mock('@/app/lib/email', () => ({ __esModule: true, sendEmail: jest.fn(async () => ({})) }));
jest.mock('@/app/lib/config', () => ({ __esModule: true, getEmailBaseUrl: () => 'https://reunitepets.test' }));
jest.mock('@/app/lib/sse/missionStream', () => ({ __esModule: true, broadcast: jest.fn() }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: jest.fn(async () => ({ success: true })),
  RateLimitPresets: { PUBLIC_WRITE: {} },
  rateLimitResponse: () => new Response('slow down', { status: 429 }),
}));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn(async () => null) }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => {}) }));

import prisma from '@/app/lib/prisma';
import { postToForces } from '@/app/lib/forceFeed';
import { wakeForces } from '@/app/lib/wake';
import { sendPushToUser } from '@/app/lib/push';
import { sendEmail } from '@/app/lib/email';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import { getServerSession } from 'next-auth';
import { checkWitnessSighting, recordWitnessSighting } from '@/app/lib/witness';
import { POST } from '@/app/api/public/missions/[caseNumber]/sighting/route';

const MAX = {
  id: 'case-max',
  caseNumber: 'AUS-2026-0001',
  status: 'ACTIVE',
  petName: 'Max',
  petSpecies: 'DOG',
  lastSeenAddress: '1200 Barton Springs Rd, Austin, TX',
  reporter: { id: 'avery', email: 'avery@example.test', firstName: 'Avery' },
};
const NOW = new Date('2026-11-03T18:00:00Z');

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findFirst.mockResolvedValue(MAX);
});

describe('checkWitnessSighting', () => {
  test('a place on the map is the one thing required; the rest is tidied', () => {
    expect(checkWitnessSighting({}).error).toMatch(/Mark where/);
    expect(checkWitnessSighting({ lat: 'x', lng: 1 }).error).toMatch(/Mark where/);
    expect(checkWitnessSighting({ lat: 30.26, lng: -97.74, sure: 'maybe' }).error).toMatch(/how sure/);
    expect(checkWitnessSighting({ lat: 30.26, lng: -97.74, direction: 'up' }).error).toMatch(/direction/);
    const { value } = checkWitnessSighting({ lat: '30.26', lng: '-97.74', sure: 'sure', direction: 'west', name: '  Jo  Lee ', note: ' blue   collar ' });
    expect(value).toEqual({ lat: 30.26, lng: -97.74, sure: 'SURE', direction: 'WEST', name: 'Jo Lee', note: 'blue collar', address: '' });
  });
});

describe('recordWitnessSighting', () => {
  test('recorded with no author, the case marked seen, the owner and the force told', async () => {
    const out = await recordWitnessSighting('AUS-2026-0001', { lat: 30.26, lng: -97.74, sure: 'SURE', direction: 'WEST', name: 'Jo', note: 'Blue collar', address: 'Zilker Park, Austin' }, { now: NOW });
    expect(out.error).toBeUndefined();
    expect(prisma.caseSighting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ missionId: 'case-max', reportedById: null, reporterName: 'Jo', certaintyLevel: 5, description: 'Blue collar Heading west.', address: 'Zilker Park, Austin' }),
      })
    );
    expect(prisma.case.update).toHaveBeenCalledWith({ where: { id: 'case-max' }, data: { status: 'SIGHTING_REPORTED' } });
    // No account, no Discussion post; the wake-up goes out regardless.
    expect(postToForces).not.toHaveBeenCalled();
    expect(wakeForces).toHaveBeenCalledWith(expect.objectContaining({ forceIds: ['force-1'], exceptUserId: null, title: 'Max was just seen', url: '/cases/AUS-2026-0001' }));
    expect(wakeForces.mock.calls[0][0].body).toBe("Near Zilker Park. Heading west. Jo is sure it was Max. Don't chase. Say where it goes.");
    // The owner: bell, push, email.
    expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'avery', type: 'SIGHTING', actionUrl: '/cases/AUS-2026-0001' }) }));
    expect(sendPushToUser).toHaveBeenCalledWith(prisma, 'avery', expect.objectContaining({ title: 'Max was just seen' }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'avery@example.test', subject: 'Max was just seen near Zilker Park' }));
    expect(out).toMatchObject({ place: 'Zilker Park', told: { owner: true, bell: 3, pushed: 1 }, caseNumber: 'AUS-2026-0001', ownerName: 'Avery' });
  });

  test('a signed-in witness also posts to the Discussion, and is not woken by their own sighting', async () => {
    await recordWitnessSighting('case-max', { lat: 30.26, lng: -97.74, sure: 'LIKELY', direction: null, name: '', note: '', address: '' }, { userId: 'sarah', now: NOW });
    expect(postToForces).toHaveBeenCalledWith(expect.objectContaining({ authorId: 'sarah', kind: 'SIGHTING' }));
    expect(wakeForces).toHaveBeenCalledWith(expect.objectContaining({ exceptUserId: 'sarah' }));
    expect(prisma.caseSighting.create.mock.calls[0][0].data.description).toBe('Seen by someone with the link.');
  });

  test('the owner reporting their own pet is not told about it', async () => {
    const out = await recordWitnessSighting('case-max', { lat: 1, lng: 1, sure: 'LIKELY', direction: null, name: '', note: '', address: '' }, { userId: 'avery' });
    expect(out.told.owner).toBe(false);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  test('no pet, or a search that has ended', async () => {
    prisma.case.findFirst.mockResolvedValueOnce(null);
    expect(await recordWitnessSighting('nope', { lat: 1, lng: 1, sure: 'LIKELY' })).toEqual({ error: 'NOT_FOUND' });
    prisma.case.findFirst.mockResolvedValueOnce({ ...MAX, status: 'REUNITED' });
    expect(await recordWitnessSighting('case-max', { lat: 1, lng: 1, sure: 'LIKELY' })).toEqual({ error: 'CLOSED' });
    expect(prisma.caseSighting.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/public/missions/[caseNumber]/sighting', () => {
  const call = (body) => POST(new Request('http://localhost/api/public/missions/AUS-2026-0001/sighting', { method: 'POST', body: JSON.stringify(body) }), { params: { caseNumber: 'AUS-2026-0001' } });

  test('201 with where it landed and who was told', async () => {
    const res = await call({ lat: 30.26, lng: -97.74, address: 'Zilker Park, Austin', sure: 'LIKELY', name: 'Jo' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ place: 'Zilker Park', told: { owner: true, bell: 3 }, caseNumber: 'AUS-2026-0001', ownerName: 'Avery' });
  });

  test('400 in words, 404, 409 when closed, 429 when hammered', async () => {
    expect((await call({ note: 'no place' })).status).toBe(400);
    expect((await (await call({})).json()).error).toMatch(/Mark where/);
    prisma.case.findFirst.mockResolvedValueOnce(null);
    expect((await call({ lat: 1, lng: 1 })).status).toBe(404);
    prisma.case.findFirst.mockResolvedValueOnce({ ...MAX, status: 'CLOSED_OTHER' });
    expect((await call({ lat: 1, lng: 1 })).status).toBe(409);
    withRateLimitAsync.mockResolvedValueOnce({ success: false });
    expect((await call({ lat: 1, lng: 1 })).status).toBe(429);
  });

  test('a signed-in witness is recorded as themselves', async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: 'mike' } });
    await call({ lat: 1, lng: 1 });
    expect(prisma.caseSighting.create.mock.calls[0][0].data.reportedById).toBe('mike');
  });
});
