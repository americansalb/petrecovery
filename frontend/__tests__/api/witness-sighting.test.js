/**
 * A witness with the pet's link and no account reports a sighting
 * (app/lib/witness.js, POST /api/public/missions/[caseNumber]/sighting):
 * it is checked in words, recorded without an author, and told to the
 * owner and the forces looking for the pet.
 *
 * A sighting is a place and a time. There is nothing to change after it
 * is sent: the same place sent again a few minutes later is the same
 * sighting with its time moved up, and anywhere else is a new one.
 */

const fs = require('fs');
const path = require('path');

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findFirst: jest.fn(), update: jest.fn(async () => ({})) },
    caseSighting: {
      create: jest.fn(async ({ data }) => ({ id: 'sight-1', ...data })),
      findFirst: jest.fn(),
      count: jest.fn(async () => 0),
      update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })),
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
jest.mock('@/app/lib/email', () => ({ __esModule: true, escapeHtml: jest.requireActual('@/app/lib/email').escapeHtml, sendEmail: jest.fn(async () => ({})) }));
jest.mock('@/app/lib/config', () => ({ __esModule: true, getEmailBaseUrl: () => 'https://reunitepets.test' }));
jest.mock('@/app/lib/sse/missionStream', () => ({ __esModule: true, broadcast: jest.fn() }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: jest.fn(async () => ({ success: true })),
  RateLimitPresets: { PUBLIC_WRITE: {}, PUBLIC_READ: {} },
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
import { logEvent } from '@/lib/logging';
import * as witness from '@/app/lib/witness';
import * as route from '@/app/api/public/missions/[caseNumber]/sighting/route';
import { broadcast } from '@/app/lib/sse/missionStream';

const { checkWitnessSighting, recordWitnessSighting, agoPhrase } = witness;
const { POST } = route;

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
// Two streets of a board that cross at (30.3105, -97.7470).
const BOARD = [
  { name: 'Ramsey Ave', path: '[[30.3105,-97.7470],[30.3148,-97.7442]]' },
  { name: 'W 40th St', path: '[[30.3112,-97.7483],[30.3098,-97.7457]]' },
];
const everyoneTold = [wakeForces, sendEmail, sendPushToUser, prisma.notification.create, postToForces, broadcast];

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findFirst.mockResolvedValue(MAX);
  prisma.caseSighting.findFirst.mockResolvedValue(null);
  prisma.caseSighting.count.mockResolvedValue(0);
  prisma.searchStreet.findMany.mockResolvedValue([]);
});

describe('checkWitnessSighting', () => {
  test('a place on the map is the one thing required; the rest is tidied', () => {
    expect(checkWitnessSighting({}).error).toMatch(/Mark where/);
    expect(checkWitnessSighting({ lat: 'x', lng: 1 }).error).toMatch(/Mark where/);
    expect(checkWitnessSighting({ lat: 30.26, lng: -97.74, sure: 'maybe' }).error).toMatch(/how sure/);
    expect(checkWitnessSighting({ lat: 30.26, lng: -97.74, direction: 'up' }).error).toMatch(/direction/);
    const { value } = checkWitnessSighting({ lat: '30.26', lng: '-97.74', sure: 'sure', direction: 'west', name: '  Jo  Lee ', note: ' blue   collar ' });
    expect(value).toEqual({ lat: 30.26, lng: -97.74, sure: 'SURE', direction: 'WEST', minutesAgo: 0, name: 'Jo Lee', note: 'blue collar', address: '' });
  });

  test('a sighting can be for earlier, up to a week back, and never the future', () => {
    expect(checkWitnessSighting({ lat: 1, lng: 1, minutesAgo: '30' }).value.minutesAgo).toBe(30);
    expect(checkWitnessSighting({ lat: 1, lng: 1, minutesAgo: 999999 }).value.minutesAgo).toBe(7 * 24 * 60);
    expect(checkWitnessSighting({ lat: 1, lng: 1, minutesAgo: -5 }).value.minutesAgo).toBe(0);
  });

  test('what the search screen sends is a place and a time, and that is all that is kept of it', () => {
    const { value } = checkWitnessSighting({ lat: 30.31, lng: -97.74, address: 'W 42nd St', minutesAgo: 0, sure: 'LIKELY' });
    expect(value).toEqual({ lat: 30.31, lng: -97.74, sure: 'LIKELY', direction: null, minutesAgo: 0, name: '', note: '', address: 'W 42nd St' });
    // Fields an older screen sent (a state, a street it went toward, a key) are not read.
    const old = checkWitnessSighting({ lat: 1, lng: 1, state: 'WITH_WITNESS', toward: 'Rosedale Ave', key: 'abc' }).value;
    expect(Object.keys(old).sort()).toEqual(['address', 'direction', 'lat', 'lng', 'minutesAgo', 'name', 'note', 'sure']);
  });
});

describe('recordWitnessSighting', () => {
  test('recorded with no author, the case marked seen, the owner and the force told', async () => {
    const out = await recordWitnessSighting('AUS-2026-0001', { lat: 30.26, lng: -97.74, sure: 'SURE', direction: 'WEST', name: 'Jo', note: 'Blue collar', address: 'Zilker Park, Austin' }, { now: NOW });
    expect(out.error).toBeUndefined();
    expect(prisma.caseSighting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ missionId: 'case-max', reportedById: null, reporterName: 'Jo', certaintyLevel: 5, description: 'Blue collar Heading west.', address: 'Zilker Park', sightedAt: NOW }),
      })
    );
    expect(prisma.case.update).toHaveBeenCalledWith({ where: { id: 'case-max' }, data: { status: 'SIGHTING_REPORTED' } });
    // No account, no Discussion post; the wake-up goes out regardless.
    expect(postToForces).not.toHaveBeenCalled();
    expect(wakeForces).toHaveBeenCalledWith(expect.objectContaining({ forceIds: ['force-1'], exceptUserId: null, title: 'Max was just seen', url: '/mission-control?mission=AUS-2026-0001' }));
    // What to do on seeing the pet is the searcher's brief's own first sentence.
    expect(wakeForces.mock.calls[0][0].body).toBe("Near Zilker Park. Heading west. Jo is sure it was Max. If you see Max, don't chase or call out.");
    // The owner: bell, push, email.
    expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'avery', type: 'SIGHTING', actionUrl: '/mission-control?mission=AUS-2026-0001' }) }));
    expect(sendPushToUser).toHaveBeenCalledWith(prisma, 'avery', expect.objectContaining({ title: 'Max was just seen' }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'avery@example.test', subject: 'Max was just seen near Zilker Park' }));
    expect(out).toEqual({ sighting: { id: 'sight-1', sightedAt: NOW }, place: 'Zilker Park', told: { owner: true, bell: 3, pushed: 1 }, caseNumber: 'AUS-2026-0001', ownerName: 'Avery' });
  });

  test('nothing is stored that marks whose phone sent it, and nothing of the kind is handed back', async () => {
    const out = await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 1, lng: 1 }).value, { now: NOW });
    const stored = prisma.caseSighting.create.mock.calls[0][0].data;
    expect(Object.keys(stored).sort()).toEqual(['address', 'certaintyLevel', 'description', 'direction', 'isVerified', 'latitude', 'longitude', 'missionId', 'photoUrls', 'reportedById', 'reporterName', 'sightedAt']);
    expect(Object.keys(out).sort()).toEqual(['caseNumber', 'ownerName', 'place', 'sighting', 'told']);
    expect(Object.keys(out.sighting).sort()).toEqual(['id', 'sightedAt']);
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

describe('the place is a street or a corner, never a house', () => {
  test('a point on the board is named by the corner it is on', async () => {
    prisma.searchStreet.findMany.mockResolvedValueOnce(BOARD);
    const out = await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 30.3105, lng: -97.747 }).value, { now: NOW });
    const data = prisma.caseSighting.create.mock.calls[0][0].data;
    expect(data.address).toBe('Ramsey Ave and W 40th St');
    expect(out.place).toBe('Ramsey Ave and W 40th St');
    expect(data).toMatchObject({ reporterName: null, reportedById: null });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Max was just seen near Ramsey Ave and W 40th St' }));
  });

  test('the board\'s corner is used even when the map lookup typed a house number', async () => {
    prisma.searchStreet.findMany.mockResolvedValueOnce(BOARD);
    const out = await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 30.3105, lng: -97.747, address: '4001 Ramsey Ave, Austin, TX 78756' }).value, { now: NOW });
    expect(prisma.caseSighting.create.mock.calls[0][0].data.address).toBe('Ramsey Ave and W 40th St');
    expect(out.place).toBe('Ramsey Ave and W 40th St');
    expect(JSON.stringify([wakeForces.mock.calls, sendEmail.mock.calls, broadcast.mock.calls, prisma.notification.create.mock.calls])).not.toContain('4001');
  });

  test('off the board, the place is what was typed without its number, and the number is not kept either', async () => {
    const out = await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 30.26, lng: -97.77, address: '2100 Barton Springs Rd, Austin' }).value, { now: NOW });
    expect(out.place).toBe('Barton Springs Rd');
    expect(wakeForces.mock.calls[0][0].body).toMatch(/^Near Barton Springs Rd\./);
    // Older routes hand whole sighting rows to anyone, so the row holds the street and the pin, never the number.
    const stored = prisma.caseSighting.create.mock.calls[0][0].data;
    expect(stored.address).toBe('Barton Springs Rd');
    expect(JSON.stringify(stored)).not.toContain('2100');
    expect(stored).toMatchObject({ latitude: 30.26, longitude: -97.77 });
  });

  test('a corner on numbered streets is a place like any other', async () => {
    prisma.searchStreet.findMany.mockResolvedValueOnce([
      { name: '5th St', path: '[[30.3105,-97.7470],[30.3148,-97.7442]]' },
      { name: 'Main St', path: '[[30.3112,-97.7483],[30.3098,-97.7457]]' },
    ]);
    const out = await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 30.3105, lng: -97.747 }).value, { now: NOW });
    expect(out.place).toBe('5th St and Main St');
    expect(prisma.caseSighting.create.mock.calls[0][0].data.address).toBe('5th St and Main St');
    expect(wakeForces.mock.calls[0][0].body).toMatch(/^Near 5th St and Main St\./);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Max was just seen near 5th St and Main St' }));
  });

  test('a house number never goes out, however it is written, and an address that is only a number is no place', async () => {
    const out = await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 30.26, lng: -97.77, address: '4001 1/2 Ramsey Ave, Austin' }).value, { now: NOW });
    expect(out.place).toBe('Ramsey Ave');
    expect(JSON.stringify([wakeForces.mock.calls, broadcast.mock.calls, prisma.notification.create.mock.calls, sendEmail.mock.calls, prisma.caseSighting.create.mock.calls])).not.toMatch(/4001|1\/2/);
    // The number behind the street, as most of the world writes it.
    prisma.caseSighting.create.mockClear();
    wakeForces.mockClear();
    expect((await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 52.5, lng: 13.4, address: 'Hauptstrasse 12, Berlin' }).value, { now: NOW })).place).toBe('Hauptstrasse');
    expect(JSON.stringify([wakeForces.mock.calls, prisma.caseSighting.create.mock.calls])).not.toContain('12');
    // Nothing but a number: recorded by its pin, with no place.
    prisma.caseSighting.create.mockClear();
    wakeForces.mockClear();
    expect((await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 30.26, lng: -97.77, address: '4001' }).value, { now: NOW })).place).toBeNull();
    expect(wakeForces.mock.calls[0][0].body).toMatch(/^Marked on the map\./);
    expect(prisma.caseSighting.create.mock.calls[0][0].data.address).toBe('Marked on the map');
    // A landmark with no number in it is a place.
    prisma.caseSighting.create.mockClear();
    expect((await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 30.26, lng: -97.77, address: 'Zilker Park' }).value, { now: NOW })).place).toBe('Zilker Park');
  });

  test('off every street, with nothing typed, it is still recorded, as marked on the map', async () => {
    await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 30.4, lng: -97.9 }).value, { now: NOW });
    expect(prisma.caseSighting.create.mock.calls[0][0].data.address).toBe('Marked on the map');
    expect(wakeForces.mock.calls[0][0].body).toMatch(/^Marked on the map\./);
  });
});

describe('the same place sent again is the same sighting', () => {
  const HERE = { lat: 30.3105, lng: -97.747 };
  const ago = (minutes) => new Date(NOW.getTime() - minutes * 60000);
  // The newest sighting on the search: first sent `sent` minutes ago, and saying the pet was seen `seen` minutes ago.
  const newest = ({ sent = 3, seen = sent, at = HERE } = {}) => ({ id: 'sight-0', latitude: at.lat, longitude: at.lng, createdAt: ago(sent), sightedAt: ago(seen) });

  test('within ten minutes of the first send and a few steps of it, its time moves up and nobody is told twice', async () => {
    prisma.caseSighting.findFirst.mockResolvedValueOnce(newest());
    // About thirty metres along the street.
    const out = await recordWitnessSighting('case-max', checkWitnessSighting({ lat: HERE.lat + 0.00027, lng: HERE.lng }).value, { now: NOW });
    // It is the newest sighting on the search that is looked at, whoever sent it.
    expect(prisma.caseSighting.findFirst).toHaveBeenCalledWith({
      where: { missionId: 'case-max' },
      orderBy: { sightedAt: 'desc' },
      select: { id: true, latitude: true, longitude: true, sightedAt: true, createdAt: true },
    });
    expect(prisma.caseSighting.update).toHaveBeenCalledWith({ where: { id: 'sight-0' }, data: { sightedAt: NOW }, select: { id: true, sightedAt: true } });
    expect(out).toMatchObject({ sighting: { id: 'sight-0', sightedAt: NOW }, again: true, told: { owner: false, bell: 0, pushed: 0 }, caseNumber: 'AUS-2026-0001', ownerName: 'Avery' });
    expect(prisma.caseSighting.create).not.toHaveBeenCalled();
    expect(prisma.case.update).not.toHaveBeenCalled();
    for (const sent of everyoneTold) expect(sent).not.toHaveBeenCalled();
  });

  test('the quiet cannot be kept going: ten minutes after the first send, the same spot is a new sighting and everyone hears it', async () => {
    // First sent two hours ago, and re-sent every few minutes since, so its time reads two minutes ago.
    prisma.caseSighting.findFirst.mockResolvedValueOnce(newest({ sent: 120, seen: 2 }));
    const out = await recordWitnessSighting('case-max', checkWitnessSighting(HERE).value, { now: NOW });
    expect(out.again).toBeUndefined();
    expect(prisma.caseSighting.update).not.toHaveBeenCalled();
    expect(prisma.caseSighting.create).toHaveBeenCalledTimes(1);
    expect(wakeForces).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  test('at the edge of the ten minutes it still folds, and a minute past it does not', async () => {
    prisma.caseSighting.findFirst.mockResolvedValueOnce(newest({ sent: 10 }));
    expect((await recordWitnessSighting('case-max', checkWitnessSighting(HERE).value, { now: NOW })).again).toBe(true);
    prisma.caseSighting.findFirst.mockResolvedValueOnce(newest({ sent: 11, seen: 1 }));
    expect((await recordWitnessSighting('case-max', checkWitnessSighting(HERE).value, { now: NOW })).again).toBeUndefined();
  });

  test('a report for earlier is never turned into "now": sent a minute ago for half an hour back, it stays as it is', async () => {
    prisma.caseSighting.findFirst.mockResolvedValueOnce(newest({ sent: 1, seen: 30 }));
    const out = await recordWitnessSighting('case-max', checkWitnessSighting(HERE).value, { now: NOW });
    expect(out.again).toBeUndefined();
    expect(prisma.caseSighting.update).not.toHaveBeenCalled();
    expect(wakeForces.mock.calls[0][0].title).toBe('Max was just seen');
  });

  test('further along than a few steps, it is a new sighting and everyone is told', async () => {
    prisma.caseSighting.findFirst.mockResolvedValueOnce(newest());
    // About two hundred metres on: the pet has moved.
    const out = await recordWitnessSighting('case-max', checkWitnessSighting({ lat: HERE.lat + 0.0018, lng: HERE.lng }).value, { now: NOW });
    expect(out.again).toBeUndefined();
    expect(prisma.caseSighting.create).toHaveBeenCalledTimes(1);
    expect(prisma.caseSighting.update).not.toHaveBeenCalled();
    expect(wakeForces).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
  });

  test('with no sighting on the search there is nothing to be the same as', async () => {
    const out = await recordWitnessSighting('case-max', checkWitnessSighting(HERE).value, { now: NOW });
    expect(out.again).toBeUndefined();
    expect(prisma.caseSighting.create).toHaveBeenCalledTimes(1);
  });

  test('a sighting sent for earlier is never folded into one happening now', async () => {
    prisma.caseSighting.findFirst.mockResolvedValue(newest());
    await recordWitnessSighting('case-max', checkWitnessSighting({ ...HERE, minutesAgo: 30 }).value, { now: NOW });
    expect(prisma.caseSighting.findFirst).not.toHaveBeenCalled();
    expect(prisma.caseSighting.create.mock.calls[0][0].data.sightedAt).toEqual(new Date(NOW.getTime() - 30 * 60000));
  });
});

describe('one pet takes only so many sightings in an hour, from everyone together', () => {
  const at = { lat: 30.3105, lng: -97.747, sure: 'SURE', direction: '', minutesAgo: 0, name: '', note: '', address: '' };

  test('the hour is counted for the pet, whoever sent them', async () => {
    await recordWitnessSighting('AUS-2026-0001', at, { now: NOW });
    const { where } = prisma.caseSighting.count.mock.calls[0][0];
    expect(where.missionId).toBe('case-max');
    expect(NOW.getTime() - where.createdAt.gte.getTime()).toBe(60 * 60 * 1000);
  });

  test('past the number, nothing is kept and nobody is told', async () => {
    prisma.caseSighting.count.mockResolvedValue(witness.SIGHTINGS_PER_HOUR);
    const out = await recordWitnessSighting('AUS-2026-0001', at, { now: NOW });
    expect(out).toEqual({ error: 'TOO_MANY', caseNumber: 'AUS-2026-0001' });
    expect(prisma.caseSighting.create).not.toHaveBeenCalled();
    expect(prisma.case.update).not.toHaveBeenCalled();
    for (const told of everyoneTold) expect(told).not.toHaveBeenCalled();
  });

  test('one under the number is still taken', async () => {
    prisma.caseSighting.count.mockResolvedValue(witness.SIGHTINGS_PER_HOUR - 1);
    const out = await recordWitnessSighting('AUS-2026-0001', at, { now: NOW });
    expect(out.error).toBeUndefined();
    expect(prisma.caseSighting.create).toHaveBeenCalledTimes(1);
  });

  test('the same sighting sent again is not counted against the hour', async () => {
    prisma.caseSighting.count.mockResolvedValue(witness.SIGHTINGS_PER_HOUR);
    prisma.caseSighting.findFirst.mockResolvedValue({ id: 'sight-0', latitude: at.lat, longitude: at.lng, sightedAt: new Date(NOW.getTime() - 60000), createdAt: new Date(NOW.getTime() - 60000) });
    const out = await recordWitnessSighting('AUS-2026-0001', at, { now: NOW });
    expect(out.again).toBe(true);
    expect(out.error).toBeUndefined();
  });

  test('the owner is emailed about the first few in an hour; the bell and the push go out for every one', async () => {
    prisma.caseSighting.count.mockResolvedValue(witness.OWNER_EMAILS_PER_HOUR - 1);
    await recordWitnessSighting('AUS-2026-0001', at, { now: NOW });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();
    prisma.case.findFirst.mockResolvedValue(MAX);
    prisma.caseSighting.findFirst.mockResolvedValue(null);
    prisma.caseSighting.count.mockResolvedValue(witness.OWNER_EMAILS_PER_HOUR);
    const out = await recordWitnessSighting('AUS-2026-0001', at, { now: NOW });
    expect(out.told.owner).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
  });

  test('the numbers are what they are meant to be', () => {
    expect(witness.SIGHTINGS_PER_HOUR).toBe(40);
    expect(witness.OWNER_EMAILS_PER_HOUR).toBe(8);
  });

  test('the route says so in a sentence, with when to try again, and keeps a record', async () => {
    prisma.caseSighting.count.mockResolvedValue(witness.SIGHTINGS_PER_HOUR);
    const res = await POST(
      new Request('http://localhost/api/public/missions/AUS-2026-0001/sighting', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lat: 30.3105, lng: -97.747 }) }),
      { params: { caseNumber: 'AUS-2026-0001' } }
    );
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('600');
    expect(await res.json()).toEqual({ error: 'Too many sightings came in this hour to take another. Try again in a few minutes.', code: 'TOO_MANY' });
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'case.sighting_refused', error_code: 'TOO_MANY' }));
  });
});

describe('POST /api/public/missions/[caseNumber]/sighting', () => {
  const call = (body) => POST(new Request('http://localhost/api/public/missions/AUS-2026-0001/sighting', { method: 'POST', body: JSON.stringify(body) }), { params: { caseNumber: 'AUS-2026-0001' } });

  test('201 with where it landed and who was told', async () => {
    const res = await call({ lat: 30.26, lng: -97.74, address: 'Zilker Park, Austin', sure: 'LIKELY', name: 'Jo' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ place: 'Zilker Park', told: { owner: true, bell: 3 }, again: false, caseNumber: 'AUS-2026-0001', ownerName: 'Avery' });
    expect(Object.keys(body).sort()).toEqual(['again', 'caseNumber', 'ownerName', 'place', 'sighting', 'told']);
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'case.sighting_reported' }));
  });

  test('200 and "again" when it is the same sighting, kept on record as a re-send', async () => {
    const justNow = new Date(Date.now() - 60000);
    prisma.caseSighting.findFirst.mockResolvedValueOnce({ id: 'sight-0', latitude: 30.26, longitude: -97.74, createdAt: justNow, sightedAt: justNow });
    const res = await call({ lat: 30.26, lng: -97.74 });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ again: true, sighting: { id: 'sight-0' }, told: { owner: false, bell: 0, pushed: 0 } });
    expect(prisma.caseSighting.create).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'case.sighting_resent', action: 'update' }));
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

  test('a sighting is sent, and that is all: nothing changes one afterwards', () => {
    expect(Object.keys(route).filter((name) => /^(GET|POST|PUT|PATCH|DELETE)$/.test(name))).toEqual(['POST']);
    // Two numbers (how many an hour) and the same four as before: still nothing that changes a sighting once sent.
    expect(Object.keys(witness).sort()).toEqual(['OWNER_EMAILS_PER_HOUR', 'SIGHTINGS_PER_HOUR', 'SURE', 'agoPhrase', 'checkWitnessSighting', 'recordWitnessSighting']);
    expect(Object.keys(witness).filter((name) => typeof witness[name] === 'function').sort()).toEqual(['agoPhrase', 'checkWitnessSighting', 'recordWitnessSighting']);
  });
});

describe('what a stranger types never reaches other people as written', () => {
  test('the owner\'s email escapes every word that came from outside', async () => {
    await recordWitnessSighting(
      'case-max',
      checkWitnessSighting({ lat: 1, lng: 1, address: '<a href="https://evil.example">Main St</a>', name: '<b>Jo</b>', note: '<img src=x onerror=alert(1)> by the creek' }).value,
      { now: NOW }
    );
    const html = sendEmail.mock.calls[0][0].html;
    expect(html).not.toMatch(/<img|<b>|<a href="https:\/\/evil/);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; by the creek');
    // The one link in it is the site's own.
    expect(html.match(/<a href="([^"]+)"/g)).toEqual(['<a href="https://reunitepets.test/mission-control?mission=AUS-2026-0001"']);
  });

  test('everyone watching hears the place and the time, never who sent it or what they wrote', async () => {
    await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 1, lng: 1, address: '2100 Barton Springs Rd, Austin', name: 'Jo Whitfield', note: 'Blue collar, by my gate.' }).value, { now: NOW, userId: 'witness-1' });
    const heard = broadcast.mock.calls[0][1];
    expect(heard.type).toBe('SIGHTING_REPORTED');
    expect(Object.keys(heard.sighting).sort()).toEqual(['direction', 'id', 'latitude', 'longitude', 'place', 'sightedAt']);
    expect(JSON.stringify(heard)).not.toMatch(/Jo|Blue collar|2100/);
    expect(heard.sighting.place).toBe('Barton Springs Rd');
  });
});

describe('a sighting sent for earlier is not announced as happening now', () => {
  test('how long ago, in words', () => {
    expect(agoPhrase(10)).toBe('10 minutes ago');
    expect(agoPhrase(30)).toBe('30 minutes ago');
    expect(agoPhrase(60)).toBe('about an hour ago');
    expect(agoPhrase(180)).toBe('3 hours ago');
    expect(agoPhrase(1440)).toBe('yesterday');
    expect(agoPhrase(4320)).toBe('3 days ago');
  });

  test('the four times on the form reach the owner in words that mean the same', () => {
    const form = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'mission-control', 'steps', 'Witness.js'), 'utf8');
    const chips = [...form.matchAll(/\{ minutes: (\d+), label: '([^']+)' \}/g)].map((m) => [m[2], Number(m[1])]);
    expect(chips).toEqual([['Just now', 0], ['Last hour', 30], ['Today', 180], ['Yesterday', 1440]]);
    expect(chips.slice(1).map(([, minutes]) => agoPhrase(minutes))).toEqual(['30 minutes ago', '3 hours ago', 'yesterday']);
  });

  test('"yesterday" reaches the owner and the force as yesterday, with no word about what to do on seeing the pet', async () => {
    await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 1, lng: 1, address: 'Zilker Park, Austin', minutesAgo: 1440 }).value, { now: NOW });
    expect(wakeForces.mock.calls[0][0].title).toBe('Max was seen yesterday');
    expect(wakeForces.mock.calls[0][0].body).toBe('Near Zilker Park. Someone thinks it was Max.');
    expect(prisma.notification.create.mock.calls[0][0].data.title).toBe('Max was seen yesterday');
    expect(sendEmail.mock.calls[0][0].subject).toBe('Max was seen yesterday near Zilker Park');
    expect(JSON.stringify([wakeForces.mock.calls, prisma.notification.create.mock.calls, sendEmail.mock.calls])).not.toMatch(/just seen|don't chase/i);
  });

  test('a sighting sent as it happens is "just seen", and carries the brief\'s line on what to do', async () => {
    await recordWitnessSighting('case-max', checkWitnessSighting({ lat: 1, lng: 1, minutesAgo: 0 }).value, { now: NOW });
    expect(wakeForces.mock.calls[0][0].title).toBe('Max was just seen');
    expect(wakeForces.mock.calls[0][0].body).toMatch(/If you see Max, don't chase or call out\.$/);
    // The owner is told where, not how to behave around their own pet.
    expect(prisma.notification.create.mock.calls[0][0].data.message).not.toMatch(/chase/);
  });
});
