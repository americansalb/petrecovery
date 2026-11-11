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
    caseSighting: {
      create: jest.fn(async ({ data }) => ({ id: 'sight-1', ...data })),
      findFirst: jest.fn(),
      update: jest.fn(async ({ data }) => ({ id: 'sight-1', sightedAt: new Date('2026-11-03T18:00:00Z'), direction: null, towardName: null, witnessState: null, witnessStateAt: null, description: '', ...data })),
    },
    searchStreet: { findMany: jest.fn(async () => []) },
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
import { checkWitnessSighting, recordWitnessSighting, checkWitnessUpdate, updateWitnessSighting, headingWords } from '@/app/lib/witness';
import { POST, PATCH } from '@/app/api/public/missions/[caseNumber]/sighting/route';
import { broadcast } from '@/app/lib/sse/missionStream';

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
    expect(value).toEqual({ lat: 30.26, lng: -97.74, sure: 'SURE', direction: 'WEST', toward: '', state: null, minutesAgo: 0, name: 'Jo Lee', note: 'blue collar', address: '' });
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

describe('one tap from the search screen: the place, and nothing about the person', () => {
  test('what the screen may send with a sighting is checked', () => {
    const { value } = checkWitnessSighting({ lat: 30.31, lng: -97.74, state: 'watching', direction: 'southeast', toward: '  Rosedale   Ave ', minutesAgo: '30' });
    expect(value).toMatchObject({ state: 'WATCHING', direction: 'SOUTHEAST', toward: 'Rosedale Ave', minutesAgo: 30, name: '', note: '' });
    expect(checkWitnessSighting({ lat: 1, lng: 1, direction: 'staying' }).value.direction).toBe('STAYING');
    expect(checkWitnessSighting({ lat: 1, lng: 1, state: 'LEFT' }).error).toMatch(/see the pet now/);
    // A sighting can be for earlier, up to a week back, and never the future.
    expect(checkWitnessSighting({ lat: 1, lng: 1, minutesAgo: 999999 }).value.minutesAgo).toBe(7 * 24 * 60);
    expect(checkWitnessSighting({ lat: 1, lng: 1, minutesAgo: -5 }).value.minutesAgo).toBe(0);
  });

  test('which way it went, in words', () => {
    expect(headingWords({ direction: 'SOUTHEAST', toward: 'Rosedale Ave' })).toBe('Going toward Rosedale Ave.');
    expect(headingWords({ direction: 'NORTH' })).toBe('Heading north.');
    expect(headingWords({ direction: 'STAYING' })).toBe('Staying there.');
    expect(headingWords({})).toBe('');
  });

  test('a position with no address is named by the corner it is on, from the board\'s streets', async () => {
    prisma.searchStreet.findMany.mockResolvedValueOnce([
      { name: 'Ramsey Ave', path: '[[30.3105,-97.7470],[30.3148,-97.7442]]' },
      { name: 'W 40th St', path: '[[30.3112,-97.7483],[30.3098,-97.7457]]' },
    ]);
    const out = await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 30.3105, lng: -97.747, state: 'WATCHING' }).value, { now: NOW });
    const data = prisma.caseSighting.create.mock.calls[0][0].data;
    expect(data.address).toBe('Ramsey Ave and W 40th St');
    expect(out.place).toBe('Ramsey Ave and W 40th St');
    expect(data).toMatchObject({ witnessState: 'WATCHING', reporterName: null, reportedById: null });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Max was just seen near Ramsey Ave and W 40th St' }));
  });

  test('off every street it is still recorded, as marked on the map', async () => {
    await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 30.4, lng: -97.9 }).value, { now: NOW });
    expect(prisma.caseSighting.create.mock.calls[0][0].data.address).toBe('Marked on the map');
  });

  test('the witness gets a key to their own sighting, kept with it and sent to nobody else', async () => {
    const out = await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 1, lng: 1 }).value, { now: NOW });
    expect(out.key).toMatch(/^[0-9a-f]{36}$/);
    expect(prisma.caseSighting.create.mock.calls[0][0].data.witnessKey).toBe(out.key);
    // Not in what everyone watching the board hears.
    expect(JSON.stringify(broadcast.mock.calls)).not.toContain(out.key);
    const two = await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 1, lng: 1 }).value, { now: NOW });
    expect(two.key).not.toBe(out.key);
  });

  test('"with me" says so to the owner and the force, and an earlier sighting is timed earlier', async () => {
    await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 1, lng: 1, state: 'WITH_WITNESS' }).value, { now: NOW });
    expect(prisma.caseSighting.create.mock.calls[0][0].data.description).toBe('The person who reported this has Max with them.');
    expect(wakeForces.mock.calls[0][0].body).toContain('Someone has Max with them.');
    await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 1, lng: 1, minutesAgo: 30 }).value, { now: NOW });
    expect(prisma.caseSighting.create.mock.calls[1][0].data.sightedAt).toEqual(new Date(NOW.getTime() - 30 * 60000));
  });
});

describe('the witness changes their own sighting', () => {
  const MINE = { id: 'sight-1', description: 'Seen by someone with the link.', direction: null, towardName: null, reporterName: null };

  test('what may be changed is checked', () => {
    expect(checkWitnessUpdate({}).error).toMatch(/cannot be changed/);
    expect(checkWitnessUpdate({ id: 's', key: 'k' }).error).toBe('Nothing to change.');
    expect(checkWitnessUpdate({ id: 's', key: 'k', state: 'gone' }).error).toBe('Say what happened.');
    expect(checkWitnessUpdate({ id: 's', key: 'k', direction: 'up' }).error).toMatch(/direction/);
    expect(checkWitnessUpdate({ id: 's', key: 'k', direction: 'southeast', toward: 'Rosedale Ave' }).value).toEqual({ id: 's', key: 'k', direction: 'SOUTHEAST', toward: 'Rosedale Ave' });
    expect(checkWitnessUpdate({ id: 's', key: 'k', state: 'lost_sight' }).value).toEqual({ id: 's', key: 'k', state: 'LOST_SIGHT' });
  });

  test('only the phone that holds the key can change it', async () => {
    prisma.caseSighting.findFirst.mockResolvedValue(null);
    expect(await updateWitnessSighting('case-max', { id: 'sight-1', key: 'wrong', state: 'LEFT' })).toEqual({ error: 'NOT_FOUND' });
    expect(prisma.caseSighting.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'sight-1', missionId: 'case-max', witnessKey: 'wrong' } }));
    expect(prisma.caseSighting.update).not.toHaveBeenCalled();
  });

  test('which way it went is added to the sighting, and replaces an earlier answer', async () => {
    prisma.caseSighting.findFirst.mockResolvedValue(MINE);
    await updateWitnessSighting('case-max', { id: 'sight-1', key: 'k', direction: 'SOUTHEAST', toward: 'Rosedale Ave' }, { now: NOW });
    expect(prisma.caseSighting.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sight-1' }, data: { direction: 'SOUTHEAST', towardName: 'Rosedale Ave', description: 'Going toward Rosedale Ave.' } })
    );
    prisma.caseSighting.findFirst.mockResolvedValue({ ...MINE, description: 'Blue collar. Going toward Rosedale Ave.', direction: 'SOUTHEAST', towardName: 'Rosedale Ave' });
    await updateWitnessSighting('case-max', { id: 'sight-1', key: 'k', direction: 'STAYING', toward: '' }, { now: NOW });
    expect(prisma.caseSighting.update.mock.calls[1][0].data).toEqual({ direction: 'STAYING', towardName: null, description: 'Blue collar. Staying there.' });
  });

  test('what they are doing now is recorded with its time, and everyone watching hears it', async () => {
    prisma.caseSighting.findFirst.mockResolvedValue(MINE);
    const out = await updateWitnessSighting('case-max', { id: 'sight-1', key: 'k', state: 'LOST_SIGHT' }, { now: NOW });
    expect(prisma.caseSighting.update.mock.calls[0][0].data).toEqual({ witnessState: 'LOST_SIGHT', witnessStateAt: NOW });
    expect(out.sighting.witnessState).toBe('LOST_SIGHT');
    expect(broadcast).toHaveBeenCalledWith('case-max', expect.objectContaining({ type: 'SIGHTING_UPDATED', sighting: expect.objectContaining({ id: 'sight-1', witnessState: 'LOST_SIGHT' }) }));
  });

  test('PATCH: 200, 400 in words, 404 without the key, 429 when hammered', async () => {
    const call = (body) => PATCH(new Request('http://localhost/api/public/missions/AUS-2026-0001/sighting', { method: 'PATCH', body: JSON.stringify(body) }), { params: { caseNumber: 'AUS-2026-0001' } });
    prisma.caseSighting.findFirst.mockResolvedValue(MINE);
    const res = await call({ id: 'sight-1', key: 'k', state: 'NOT_THE_PET' });
    expect(res.status).toBe(200);
    expect((await res.json()).sighting.witnessState).toBe('NOT_THE_PET');
    expect((await call({ id: 'sight-1' })).status).toBe(400);
    prisma.caseSighting.findFirst.mockResolvedValue(null);
    const gone = await call({ id: 'sight-1', key: 'nope', state: 'LEFT' });
    expect(gone.status).toBe(404);
    expect((await gone.json()).error).toMatch(/cannot be changed from this phone/);
    withRateLimitAsync.mockResolvedValueOnce({ success: false });
    expect((await call({ id: 'sight-1', key: 'k', state: 'LEFT' })).status).toBe(429);
  });
});
