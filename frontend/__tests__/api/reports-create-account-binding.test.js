/**
 * An anonymous lost-pet report must not be filed against somebody else's account.
 *
 * Found by the 2026-08 launch audit. /api/reports/create looked the submitted
 * email up with findUnique and, if a user existed, attached the case to them -
 * with nothing proving the submitter owned that address. One unauthenticated
 * POST published a fabricated case under a real member's account and copied
 * their stored phone onto the public record.
 *
 * SCOPE: this file covers the REFUSAL only. The guard throws early, before the
 * route's geocoding / recovery-kit / notification work, so it is the one branch
 * that can be exercised without standing the whole pipeline up in jest. The
 * three paths that must keep working - a brand new reporter, a repeat guest,
 * and a signed-in owner - are verified end to end against a real server and
 * database instead; see docs/LAUNCH_AUDIT_2026-08.md (B7).
 *
 * The gate is emailVerified, NOT passwordHash: this endpoint hashes a random
 * temp password for every guest, so a password proves nothing about ownership.
 * An earlier attempt at this fix keyed off passwordHash and silently broke
 * repeat guest reporting - the single most important path in the product.
 */

import { NextRequest } from 'next/server';

const mockTx = {
  user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  pet: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  case: { create: jest.fn() },
};

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(async (fn) => fn(mockTx)),
    case: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    rescueForce: { findMany: jest.fn().mockResolvedValue([]) },
    squadPost: { create: jest.fn() },
    alert: { create: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/email', () => ({
  __esModule: true,
  sendEmail: jest.fn().mockResolvedValue({ ok: true }),
  escapeHtml: (v) => String(v ?? ''),
}));

import { getServerSession } from 'next-auth';
import { POST } from '@/app/api/reports/create/route';

const VALID_BODY = {
  email: 'someone@example.com',
  firstName: 'Reporter',
  petName: 'Max',
  color: 'Golden',
  lastSeenAddress: '1 Main St, Austin, TX 78701',
  center: [30.27, -97.74],
  petType: 'DOG',
  timeElapsed: 'less_than_hour',
};

const req = () =>
  new NextRequest('http://localhost:3000/api/reports/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(VALID_BODY),
  });

const VERIFIED_VICTIM = {
  id: 'victim',
  email: 'someone@example.com',
  phone: '555-0147',
  passwordHash: 'hashed',
  emailVerified: new Date('2026-01-01T00:00:00Z'),
};

describe('POST /api/reports/create - anonymous account binding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue(null);
    mockTx.user.findFirst.mockResolvedValue(null);
  });

  it('refuses an anonymous report against a verified account', async () => {
    mockTx.user.findUnique.mockResolvedValue(VERIFIED_VICTIM);

    const res = await POST(req());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('ACCOUNT_EXISTS');
  }, 15000);

  it('does not write the case when it refuses', async () => {
    mockTx.user.findUnique.mockResolvedValue(VERIFIED_VICTIM);

    await POST(req());

    expect(mockTx.case.create).not.toHaveBeenCalled();
    expect(mockTx.user.create).not.toHaveBeenCalled();
  }, 15000);

  it('does not echo the account holder stored phone back to the caller', async () => {
    mockTx.user.findUnique.mockResolvedValue(VERIFIED_VICTIM);

    const res = await POST(req());
    const body = await res.json();

    // The original bug copied this onto a public record; the refusal must not
    // hand it over either.
    expect(JSON.stringify(body)).not.toContain('555-0147');
  }, 15000);

  it('points the caller at sign-in rather than dead-ending them', async () => {
    mockTx.user.findUnique.mockResolvedValue(VERIFIED_VICTIM);

    const res = await POST(req());
    const body = await res.json();

    expect(body.signInUrl).toContain('/login');
    expect(body.error).toMatch(/sign in/i);
  }, 15000);
});
