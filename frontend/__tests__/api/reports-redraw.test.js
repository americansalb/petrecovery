/**
 * Drawing a lost report's flyer again when the first try did not make it
 * (POST /api/reports/[id]/redraw).
 *
 * When the cascade ended PARTIAL, the page after posting said "The flyer is
 * on the page when it is ready" with nothing coming and no way to try again.
 * Now it says the flyer did not draw and offers this, to the owner only,
 * once in ten minutes, and only while a piece is missing.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { case: { findUnique: jest.fn() }, caseAsset: { findMany: jest.fn() } },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn(async () => null) }));
jest.mock('@/app/lib/cascade/redrawLater', () => ({ __esModule: true, scheduleKitRedraw: jest.fn() }));
jest.mock('@/app/lib/rateLimit', () => {
  const { NextResponse } = require('next/server');
  return {
    __esModule: true,
    checkRateLimitForKeyAsync: jest.fn(async () => ({ success: true })),
    rateLimitResponse: jest.fn(() => NextResponse.json({ error: 'Too many requests' }, { status: 429 })),
  };
});

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { scheduleKitRedraw } from '@/app/lib/cascade/redrawLater';
import { checkRateLimitForKeyAsync } from '@/app/lib/rateLimit';
import { signDetailsToken } from '@/app/lib/detailsToken';
import { POST } from '@/app/api/reports/[id]/redraw/route';

const CASE = { id: 'case-1', reportType: 'LOST', reporterId: 'u-owner', resolvedAt: null, ownerKeyHash: null, ownerKeyAt: null };
const redraw = (headers = {}) =>
  POST(new NextRequest('http://localhost:3000/api/reports/case-1/redraw', { method: 'POST', headers }), { params: { id: 'case-1' } });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXTAUTH_SECRET = 'test-secret';
  prisma.case.findUnique.mockResolvedValue(CASE);
  prisma.caseAsset.findMany.mockResolvedValue([]);
  getServerSession.mockResolvedValue(null);
});

test('the owner, with the token from the page after posting, starts a second drawing when the flyer is missing', async () => {
  const res = await redraw({ 'x-details-token': signDetailsToken('case-1') });
  expect(res.status).toBe(202);
  expect(await res.json()).toEqual({ started: true });
  expect(scheduleKitRedraw).toHaveBeenCalledWith('case-1', { delayMs: 0 });
  expect(checkRateLimitForKeyAsync.mock.calls[0][0]).toBe('reports:redraw:case-1');
});

test('a signed-in owner may too; anyone else may not', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'u-owner' } });
  expect((await redraw()).status).toBe(202);
  getServerSession.mockResolvedValue({ user: { id: 'u-stranger' } });
  expect((await redraw()).status).toBe(403);
  getServerSession.mockResolvedValue(null);
  expect((await redraw({ 'x-details-token': signDetailsToken('case-2') })).status).toBe(403);
  expect(scheduleKitRedraw).toHaveBeenCalledTimes(1);
});

test('nothing is drawn when the flyer and share image are already there, or more than once in ten minutes', async () => {
  const token = { 'x-details-token': signDetailsToken('case-1') };
  prisma.caseAsset.findMany.mockResolvedValueOnce([{ kind: 'FLYER_LETTER' }, { kind: 'SOCIAL_SQUARE' }]);
  expect(await (await redraw(token)).json()).toEqual({ started: false, code: 'ALREADY_DRAWN' });
  checkRateLimitForKeyAsync.mockResolvedValueOnce({ success: false });
  expect((await redraw(token)).status).toBe(429);
  expect(scheduleKitRedraw).not.toHaveBeenCalled();
});
