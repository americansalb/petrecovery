/**
 * CRIT-C regression: a sighting must only claim "the owner has been notified"
 * when it actually delivered (no false hope), and must actually deliver when the
 * case has an owner. EA found /api/sightings returned "the owner has been
 * notified" while the send was a TODO (a false confirmation on a sighting of a
 * missing pet - the worst cruelty-class failure).
 *
 * That was fixed in this route, and this file tested the fix against a
 * database stand-in that accepts any field. The real database did not: the
 * route's first write named a field the Sighting table does not have, so on
 * the site every report failed, the person was told so, and the owner heard
 * nothing. The first test below reads the schema to show it.
 *
 * So the route is switched off, and the page that sent to it opens the
 * working form (__tests__/api/witness-sighting.test.js covers that path: it
 * tells the owner, and says who was told only when they were). What is
 * asserted here is that the old route claims nothing and writes nothing.
 */

import fs from 'fs';
import path from 'path';

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    sighting: { create: jest.fn() },
    caseSighting: { create: jest.fn() },
    case: { findUnique: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimit: jest.fn().mockReturnValue({ success: true }),
  RateLimitPresets: { PUBLIC_WRITE: {} },
  rateLimitResponse: jest.fn(),
}));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/notifications-inapp', () => ({ __esModule: true, createInAppNotification: jest.fn() }));
jest.mock('@/app/lib/email', () => ({ __esModule: true, sendEmail: jest.fn() }));
jest.mock('@/app/lib/config', () => ({ __esModule: true, getEmailBaseUrl: () => 'http://localhost:5757' }));

import { POST } from '@/app/api/sightings/route';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { sendEmail } from '@/app/lib/email';

function report() {
  return POST(new NextRequest('http://localhost:5757/api/sightings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alertId: 'case-1', location: '123 Main St', details: 'Saw the dog', timeOfSighting: 'just_now' }),
  }));
}

describe('the older sighting route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: 'reporter-u', email: 'r@x.com', name: 'R' } });
    prisma.sighting.create.mockResolvedValue({ id: 'sight-1' });
    prisma.caseSighting.create.mockResolvedValue({});
    prisma.case.findUnique.mockResolvedValue({ caseNumber: 'CASE-2026-000001', petName: 'Rex', reporterId: 'owner-1', reporter: { email: 'owner@example.com' } });
    createInAppNotification.mockResolvedValue(undefined);
    sendEmail.mockResolvedValue(undefined);
  });

  test('why it never worked: it wrote a field the Sighting table does not have', () => {
    const schema = fs.readFileSync(path.join(__dirname, '../../prisma/schema.prisma'), 'utf8');
    const model = schema.match(/model Sighting \{([\s\S]*?)\n\}/)[1];
    const fields = model.split('\n').map((line) => line.trim().split(/\s+/)[0]).filter(Boolean);
    expect(fields).toContain('caseId');
    expect(fields).not.toContain('missionId');
    const route = fs.readFileSync(path.join(__dirname, '../../app/api/sightings/route.js'), 'utf8');
    expect(route).toMatch(/prisma\.sighting\.create\(\{\s*data: \{\s*missionId:/);
  });

  test('it is switched off: 410, with where a sighting is sent from', async () => {
    const res = await report();
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: "Send a sighting from the pet's own page.", code: 'NOT_AVAILABLE' });
  });

  test('it claims nothing: no "owner has been notified", and nobody is told', async () => {
    const res = await report();
    expect(JSON.stringify(await res.json())).not.toContain('notified');
    expect(createInAppNotification).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('and writes nothing, signed in or not', async () => {
    await report();
    getServerSession.mockResolvedValue(null);
    expect((await report()).status).toBe(410);
    expect(prisma.sighting.create).not.toHaveBeenCalled();
    expect(prisma.caseSighting.create).not.toHaveBeenCalled();
    expect(prisma.case.findUnique).not.toHaveBeenCalled();
  });
});

describe('the page that sent to it', () => {
  const open = async (query, findFirst = jest.fn(async () => ({ caseNumber: 'AUS-2026-0001' }))) => {
    jest.resetModules();
    jest.doMock('@/app/lib/prisma', () => ({ __esModule: true, default: { case: { findFirst } } }));
    jest.doMock('@/app/lib/config', () => ({ __esModule: true, getBaseUrl: () => 'https://www.reunitepets.org' }));
    const { GET } = await import('@/app/sightings/report/route');
    const res = await GET(new Request(`http://internal-host:10000/sightings/report${query}`));
    return { res, findFirst };
  };

  test('opens the working form for the pet it names, on the site\'s own address', async () => {
    const { res, findFirst } = await open('?alertId=cmw6n56y5005jf3ibf6fr90j2');
    expect(res.status).toBe(302);
    // The site's address, never the host the request happened to arrive on.
    expect(res.headers.get('location')).toBe('https://www.reunitepets.org/mission-control?mission=AUS-2026-0001&action=sighting');
    expect(findFirst.mock.calls[0][0]).toEqual({ where: { id: 'cmw6n56y5005jf3ibf6fr90j2' }, select: { caseNumber: true } });
  });

  test('a pet named by its number is found by its number', async () => {
    const { res, findFirst } = await open('?alertId=AUS-2026-0001');
    expect(res.headers.get('location')).toContain('/mission-control?mission=AUS-2026-0001&action=sighting');
    expect(findFirst.mock.calls[0][0].where).toEqual({ caseNumber: 'AUS-2026-0001' });
  });

  test('with no pet named, or one that does not exist, it goes to the board', async () => {
    const none = await open('', jest.fn(async () => null));
    expect(none.res.headers.get('location')).toBe('https://www.reunitepets.org/lost-and-found');
    expect(none.findFirst).not.toHaveBeenCalled();
    const gone = await open('?alertId=nope', jest.fn(async () => null));
    expect(gone.res.headers.get('location')).toBe('https://www.reunitepets.org/lost-and-found');
    const long = await open(`?alertId=${'x'.repeat(500)}`);
    expect(long.res.headers.get('location')).toBe('https://www.reunitepets.org/lost-and-found');
    expect(long.findFirst).not.toHaveBeenCalled();
  });

  test('a lookup that fails still sends the person somewhere', async () => {
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { res } = await open('?alertId=AUS-2026-0001', jest.fn(async () => { throw new Error('db down'); }));
    quiet.mockRestore();
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://www.reunitepets.org/lost-and-found');
  });
});
