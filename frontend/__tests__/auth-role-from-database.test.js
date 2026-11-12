/**
 * The role in a sign-in token is the account's own, from the database.
 *
 * Until 2026-11-12 a session update copied `role` from the browser's
 * request into the token: any signed-in account could send one request and
 * become an admin, and every route that trusts the session's role (closing
 * a search, editing someone else's report, posting an update on any pet's
 * page) then let it through. It was proven on a local server before this
 * test was written.
 *
 * A session update is now only a request to read the account again. And a
 * token that claims more than an ordinary account is checked against the
 * database every time it is used, so one forged before the fix is put
 * right.
 */

jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: { user: { findUnique: jest.fn(), update: jest.fn(async () => ({})) } } }));
jest.mock('bcryptjs', () => ({ __esModule: true, default: { compare: jest.fn() } }));

import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

const jwt = (given) => authOptions.callbacks.jwt(given);
const DAVID = { id: 'u-david', email: 'david@example.com', role: 'USER', firstName: 'David', lastName: 'Lee' };
const tokenOf = (over = {}) => ({ id: DAVID.id, email: DAVID.email, role: 'USER', firstName: 'David', lastName: 'Lee', ...over });
const inDatabase = (row) => prisma.user.findUnique.mockResolvedValue(row);

beforeEach(() => {
  jest.clearAllMocks();
  inDatabase({ role: 'USER', firstName: 'David', lastName: 'Lee', emailVerified: null });
});

describe('a session update asks for the account to be read again, and what it sends is not believed', () => {
  test('sending a role does not make anyone an admin', async () => {
    const token = await jwt({ token: tokenOf(), trigger: 'update', session: { role: 'ADMIN' } });
    expect(token.role).toBe('USER');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u-david' }, select: { role: true, firstName: true, lastName: true, emailVerified: true } });
  });

  test.each(['ADMIN', 'MODERATOR', 'PATROL', 'SUPER_ADMIN', { $ne: 'USER' }, ['ADMIN']])('whatever is sent as the role (%p), the token has the database\'s', async (role) => {
    const token = await jwt({ token: tokenOf(), trigger: 'update', session: { role } });
    expect(token.role).toBe('USER');
  });

  test('a name sent with it is not taken either: the name is the account\'s', async () => {
    inDatabase({ role: 'USER', firstName: 'Dave', lastName: 'Lee-Park', emailVerified: new Date(0) });
    const token = await jwt({ token: tokenOf(), trigger: 'update', session: { firstName: 'Avery', lastName: 'The Owner' } });
    expect(token).toMatchObject({ firstName: 'Dave', lastName: 'Lee-Park', role: 'USER', emailVerified: new Date(0) });
  });

  test('it does bring a real change across: someone made a moderator is one after an update', async () => {
    inDatabase({ role: 'MODERATOR', firstName: 'David', lastName: 'Lee', emailVerified: null });
    expect((await jwt({ token: tokenOf(), trigger: 'update', session: {} })).role).toBe('MODERATOR');
  });

  test('with no body at all it still reads the account', async () => {
    await jwt({ token: tokenOf(), trigger: 'update' });
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe('a token that claims more than an ordinary account is checked every time it is used', () => {
  test('one forged before the fix is put right', async () => {
    const token = await jwt({ token: tokenOf({ role: 'ADMIN' }) });
    expect(token.role).toBe('USER');
  });

  test('a real admin stays one', async () => {
    inDatabase({ role: 'ADMIN', firstName: 'Sam', lastName: 'Staff', emailVerified: null });
    expect((await jwt({ token: tokenOf({ role: 'ADMIN' }) })).role).toBe('ADMIN');
  });

  test('an admin whose role was taken away stops being one', async () => {
    inDatabase({ role: 'USER', firstName: 'Sam', lastName: 'Staff', emailVerified: null });
    expect((await jwt({ token: tokenOf({ role: 'ADMIN' }) })).role).toBe('USER');
  });

  test('an account that is gone is nobody\'s admin', async () => {
    inDatabase(null);
    expect((await jwt({ token: tokenOf({ role: 'ADMIN' }) })).role).toBe('USER');
  });

  test('an ordinary token costs no database read', async () => {
    const token = await jwt({ token: tokenOf() });
    expect(token.role).toBe('USER');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test('when the database cannot be read the token is left as it was, so an outage signs no admin out', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('connection refused'));
    expect((await jwt({ token: tokenOf({ role: 'ADMIN' }) })).role).toBe('ADMIN');
    expect((await jwt({ token: tokenOf(), trigger: 'update', session: { role: 'ADMIN' } })).role).toBe('USER');
  });

  test('the name is not rewritten on an ordinary use, only on an update', async () => {
    inDatabase({ role: 'ADMIN', firstName: 'Changed', lastName: 'Name', emailVerified: null });
    expect((await jwt({ token: tokenOf({ role: 'ADMIN' }) })).firstName).toBe('David');
  });
});

describe('signing in is unchanged', () => {
  test('the role comes from the account that signed in', async () => {
    const token = await jwt({ token: { email: DAVID.email }, user: DAVID });
    expect(token).toMatchObject({ id: 'u-david', role: 'USER', firstName: 'David', lastName: 'Lee' });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test('the session a page reads carries that role', async () => {
    const session = await authOptions.callbacks.session({ session: { user: { email: DAVID.email } }, token: tokenOf() });
    expect(session.user).toMatchObject({ id: 'u-david', role: 'USER' });
  });
});
