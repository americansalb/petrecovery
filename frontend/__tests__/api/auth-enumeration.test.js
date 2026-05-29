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

/**
 * Auth-regression discriminator (EA msg 649): if a known login symptom is
 * "200 but no session", confirm the login->session CHAIN itself isn't broken at
 * the code level. This proves session establishment works for a valid user, so
 * a credential failing in the wild points to a rotated/changed cred (SEC-18
 * resolved) rather than a universal auth regression. Also locks the jwt/session
 * callbacks, which were previously untested.
 */
describe('login -> jwt -> session chain is intact', () => {
  const { jwt, session } = authOptions.callbacks;

  test('a valid verified user flows authorize -> jwt -> session and gets a populated session', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1', email: 'a@x.com', firstName: 'A', lastName: 'D', role: 'ADMIN',
      passwordHash: 'h', emailVerified: new Date(), profileImage: null,
    });
    bcrypt.compare.mockResolvedValue(true);

    const user = await authorize(creds);
    expect(user).toMatchObject({ id: 'admin-1', role: 'ADMIN' });

    const token = await jwt({ token: {}, user });
    expect(token.id).toBe('admin-1');
    expect(token.role).toBe('ADMIN');

    const sess = await session({ session: { user: {} }, token });
    expect(sess.user.id).toBe('admin-1');
    expect(sess.user.role).toBe('ADMIN');
  });
});
