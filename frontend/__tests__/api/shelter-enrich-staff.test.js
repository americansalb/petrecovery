/**
 * Saving a shelter's phone, website and hours (POST /api/shelters/enrich).
 *
 * The directory and a search's shelter list show these as the number to
 * call and the site to open. The route took no sign-in and checked
 * nothing: anyone could change them for any shelter, and one request with
 * a filter in place of an id changed every shelter at once. It is for
 * staff, by the role the database has; ids are text; and only a number, an
 * http(s) address and hours of a sensible length are kept.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    shelter: { update: jest.fn(async () => ({})), updateMany: jest.fn(async () => ({ count: 1 })) },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/rateLimit', () => ({ __esModule: true, withRateLimitAsync: jest.fn(async () => ({ success: true })), rateLimitResponse: () => new Response('{}', { status: 429 }) }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import { POST } from '@/app/api/shelters/enrich/route';

const post = (body) => POST(new NextRequest('http://localhost/api/shelters/enrich', { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const GOOD = { id: 'sh-1', phone: '(512) 555-0100', website: 'https://shelter.example/', hours: 'Mon to Fri 9 to 5' };

beforeEach(() => {
  jest.clearAllMocks();
  withRateLimitAsync.mockResolvedValue({ success: true });
  getServerSession.mockResolvedValue({ user: { id: 'u-staff', role: 'ADMIN' } });
  prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
});

describe('who may', () => {
  test('nobody signed in: 401, and nothing is written', async () => {
    getServerSession.mockResolvedValue(null);
    expect((await post({ shelters: [GOOD] })).status).toBe(401);
    expect(prisma.shelter.update).not.toHaveBeenCalled();
    expect(prisma.shelter.updateMany).not.toHaveBeenCalled();
  });

  test('an ordinary account: 403, and nothing is written', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u-x', role: 'USER' } });
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
    expect((await post({ shelters: [GOOD] })).status).toBe(403);
    expect(prisma.shelter.update).not.toHaveBeenCalled();
  });

  test('a session that says ADMIN for an account the database says is not: 403', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
    expect((await post({ shelters: [GOOD] })).status).toBe(403);
    expect(prisma.shelter.update).not.toHaveBeenCalled();
  });

  test('staff save one', async () => {
    const res = await post({ shelters: [GOOD] });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, updatedCount: 1 });
    expect(prisma.shelter.update).toHaveBeenCalledWith({ where: { id: 'sh-1' }, data: { phone: '(512) 555-0100', website: 'https://shelter.example/', hours: 'Mon to Fri 9 to 5' } });
  });
});

describe('what is kept, even from staff', () => {
  test('a filter in place of an id is no id: it does not change every shelter at once', async () => {
    const res = await post({ shelters: [{ appleMapKitId: { not: null }, phone: '5125550199', website: 'https://evil.example' }, { id: { not: '' }, phone: '5125550199' }] });
    expect(await res.json()).toMatchObject({ updatedCount: 0, skippedNoId: 2 });
    expect(prisma.shelter.update).not.toHaveBeenCalled();
    expect(prisma.shelter.updateMany).not.toHaveBeenCalled();
  });

  test('by the map\'s own id, as text', async () => {
    await post({ shelters: [{ appleMapKitId: 'I6C2F3A1B', phone: '512-555-0100' }] });
    expect(prisma.shelter.updateMany).toHaveBeenCalledWith({ where: { appleMapKitId: 'I6C2F3A1B' }, data: { phone: '512-555-0100' } });
  });

  test('a website that is not an http(s) address is not kept', async () => {
    const res = await post({ shelters: [{ id: 'sh-1', website: 'javascript:alert(document.cookie)' }, { id: 'sh-2', website: 'data:text/html,x', phone: '5125550100' }] });
    expect(await res.json()).toMatchObject({ updatedCount: 1, skippedNoData: 1 });
    expect(prisma.shelter.update).toHaveBeenCalledTimes(1);
    expect(prisma.shelter.update.mock.calls[0][0]).toEqual({ where: { id: 'sh-2' }, data: { phone: '5125550100' } });
  });

  test('a phone that is not a number is not kept', async () => {
    await post({ shelters: [{ id: 'sh-1', phone: 'Call our new line at <b>900</b>', hours: 'Daily' }] });
    expect(prisma.shelter.update.mock.calls[0][0].data).toEqual({ hours: 'Daily' });
  });

  test('hours are text or the listing\'s own object, of a sensible length', async () => {
    await post({ shelters: [{ id: 'sh-1', hours: { mon: '9-5' } }, { id: 'sh-2', hours: 'h'.repeat(5000), phone: '5125550100' }] });
    expect(prisma.shelter.update.mock.calls[0][0].data).toEqual({ hours: '{"mon":"9-5"}' });
    expect(prisma.shelter.update.mock.calls[1][0].data).toEqual({ phone: '5125550100' });
  });

  test('a hundred at most, a list, and a body that is an object', async () => {
    expect((await post({ shelters: Array.from({ length: 101 }, (_, i) => ({ id: `s${i}`, phone: '5125550100' })) })).status).toBe(400);
    expect((await post({ shelters: 'all' })).status).toBe(400);
    expect((await post({ shelters: [] })).status).toBe(400);
    expect((await post('junk')).status).toBe(400);
    expect((await post([GOOD])).status).toBe(400);
    expect(prisma.shelter.update).not.toHaveBeenCalled();
  });

  test('a row that is not an object is skipped, not a crash', async () => {
    const res = await post({ shelters: [null, 'x', 7, GOOD] });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ updatedCount: 1, skippedNoId: 3 });
  });

  test('counted per connection, before anything else', async () => {
    withRateLimitAsync.mockResolvedValue({ success: false });
    expect((await post({ shelters: [GOOD] })).status).toBe(429);
    expect(getServerSession).not.toHaveBeenCalled();
  });

  test('a failure says only that it failed', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u-staff' } });
    prisma.user.findUnique.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post({ shelters: [GOOD] });
    quiet.mockRestore();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|details/);
  });
});
