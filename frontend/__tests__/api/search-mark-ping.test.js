/**
 * Live-search CRIT regression (EA msg 569/588): the client (useSearchSession)
 * sends action 'mark' with a { point } object, but the server only handled
 * start/ping/end - so every breadcrumb fell through to 400, sessions recorded 0
 * pings → 0 distance → 0 points → empty coverage map. The headline gamified-search
 * feature was dead. Fixed by an adapter: 'mark' → handlePing with renamed fields.
 *
 * Anti-theater: assert 'mark' actually PERSISTS a LocationPing with the mapped
 * coords (not just "doesn't 400") - a relabel that still dropped would be theater.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    searchSession: { updateMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    locationPing: { create: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/lib/actions', () => ({ __esModule: true, getPointsService: jest.fn() }));
jest.mock('@/app/lib/volunteer/quickJoin', () => ({ __esModule: true, quickJoinCase: jest.fn() }));

import { POST } from '@/app/api/mission/[missionId]/search/route';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';

function post(body) {
  return POST(
    new NextRequest('http://localhost:5757/api/mission/case-1/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: { missionId: 'case-1' } }
  );
}

describe('Live search: mark -> ping adapter (CRIT)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { email: 'searcher@example.com' } });
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.searchSession.updateMany.mockResolvedValue({ count: 0 });
    prisma.searchSession.findUnique.mockResolvedValue({
      id: 's1', status: 'ACTIVE', locationPings: [], lastSeenLat: null, lastSeenLng: null,
    });
    prisma.searchSession.update.mockResolvedValue({});
    prisma.locationPing.create.mockResolvedValue({});
  });

  test('KEYSTONE: a "mark" breadcrumb persists a LocationPing with the mapped coords (not a 400)', async () => {
    const res = await post({
      action: 'mark',
      sessionId: 's1',
      point: { lat: 40.0, lng: -75.0, accuracy: 5, inZone: true },
    });
    expect(res.status).toBe(200);
    expect(prisma.locationPing.create).toHaveBeenCalledTimes(1);
    const data = prisma.locationPing.create.mock.calls[0][0].data;
    expect(data.latitude).toBe(40.0);   // point.lat -> latitude (the rename)
    expect(data.longitude).toBe(-75.0); // point.lng -> longitude
    expect(data.isValid).toBe(true);    // point.inZone -> isValid, in-zone + valid speed
  });

  test('an unknown action still 400s (so "mark" being handled is meaningful)', async () => {
    const res = await post({ action: 'totally-bogus', sessionId: 's1' });
    expect(res.status).toBe(400);
    expect(prisma.locationPing.create).not.toHaveBeenCalled();
  });

  test('an out-of-zone mark is recorded but flagged invalid (scoring integrity)', async () => {
    prisma.searchSession.findUnique.mockResolvedValue({
      id: 's1', status: 'ACTIVE', locationPings: [], lastSeenLat: 40.0, lastSeenLng: -75.0,
    });
    // far from the last-seen point => out of search radius => isValid false
    const res = await post({ action: 'mark', sessionId: 's1', point: { lat: 10.0, lng: 10.0, inZone: true } });
    expect(res.status).toBe(200);
    expect(prisma.locationPing.create.mock.calls[0][0].data.isValid).toBe(false);
  });
});
