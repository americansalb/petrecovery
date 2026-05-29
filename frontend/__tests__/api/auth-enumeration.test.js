/**
 * SEC-22 regression: the credentials authorize() must NOT leak a registration
 * oracle. Previously it threw EMAIL_NOT_VERIFIED for a registered-but-unverified
 * account while returning null for a bad password — so the raw
 * /api/auth/callback/credentials response distinguished "registered" from
 * "unknown email". Fix: return null for unverified too (same as bad password).
 *
 * Keystone: bad-password, unknown-email, and registered-but-unverified all
 * produce the SAME result (null, no throw) — no distinguishable signal.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { user: { findUnique: jest.fn() } },
}));
jest.mock('bcryptjs', () => ({ __esModule: true, default: { compare: jest.fn() } }));

import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import bcrypt from 'bcryptjs';

// The credentials provider. next-auth wraps p.authorize into a normalized
// handler; the RAW async authorize we wrote lives at p.options.authorize — use
// that so we exercise our actual logic, not next-auth's wrapper.
const credProvider = authOptions.providers.find((p) => p?.options?.authorize || p?.authorize);
const authorize = credProvider.options?.authorize || credProvider.authorize;

const creds = { email: 'user@example.com', password: 'pw' };

describe('SEC-22: login does not leak an account-enumeration oracle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('unknown email => null', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(authorize(creds)).resolves.toBeNull();
  });

  test('registered + verified + WRONG password => null (no throw)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'h', emailVerified: new Date() });
    bcrypt.compare.mockResolvedValue(false);
    await expect(authorize(creds)).resolves.toBeNull();
  });

  test('KEYSTONE: registered + correct password but UNVERIFIED => null, NOT a distinct error/throw', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'h', emailVerified: null });
    bcrypt.compare.mockResolvedValue(true);
    // Must not throw EMAIL_NOT_VERIFIED (the old oracle) and must be null —
    // indistinguishable from the wrong-password case above.
    await expect(authorize(creds)).resolves.toBeNull();
  });

  test('registered + verified + correct password => returns the user (login still works)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'user@example.com', firstName: 'U', role: 'USER',
      passwordHash: 'h', emailVerified: new Date(),
    });
    bcrypt.compare.mockResolvedValue(true);
    const result = await authorize(creds);
    expect(result).toMatchObject({ id: 'u1', role: 'USER' });
  });
});
