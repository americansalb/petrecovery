/**
 * Joining a Rescue Force while signed out (app/rescue-forces/[id]/
 * JoinForcePanel.js): sign up and ask to join in one step, become a member
 * by confirming the email.
 *
 * POST /api/auth/register with joinForceId creates the account and a
 * PENDING membership (isActive false, no leftAt) in one transaction.
 * POST /api/auth/verify-email makes pending memberships real and tells the
 * page which force, so sign-in can send the person back to it.
 *
 * Locks: a pending row is never active before the email is confirmed; an
 * unknown or deleted force is refused before any account exists; a row that
 * was left or removed (leftAt set) is not what confirmation activates; and a
 * failure activating never fails the confirmation itself.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => {
  const mock = {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    rescueForce: { findFirst: jest.fn() },
    rescueForceMember: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    squadActivity: { create: jest.fn() },
    legalDocument: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(async (fn) => fn(mock)),
  };
  return { __esModule: true, default: mock };
});

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$mockedHashValue'),
}));

jest.mock('@/app/lib/rateLimit', () => ({
  withRateLimit: jest.fn().mockReturnValue({ success: true }),
  withRateLimitAsync: jest.fn().mockResolvedValue({ success: true }),
  RateLimitPresets: { AUTH: {} },
  rateLimitResponse: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/lib/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));

import { POST as register } from '@/app/api/auth/register/route';
import { POST as verify, GET as resend } from '@/app/api/auth/verify-email/route';
import prisma from '@/app/lib/prisma';
import { sendVerificationEmail } from '@/app/lib/email';

function post(url, body) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const signup = (extra = {}) =>
  post('/api/auth/register', {
    firstName: 'Rita',
    email: 'Rita@Example.com',
    password: 'correct-horse-9',
    acceptedTerms: true,
    ...extra,
  });

describe('POST /api/auth/register with joinForceId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }) => ({ id: 'user-1', ...data }));
    prisma.rescueForce.findFirst.mockResolvedValue({ id: 'force-1', name: 'Austin Rescue Force' });
  });

  it('creates the account and a PENDING membership in the same transaction', async () => {
    const res = await register(signup({ joinForceId: 'force-1' }));
    expect(res.status).toBe(200);

    expect(prisma.rescueForce.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'force-1', isDeleted: false } })
    );
    expect(prisma.rescueForceMember.create).toHaveBeenCalledTimes(1);
    const { data } = prisma.rescueForceMember.create.mock.calls[0][0];
    expect(data).toEqual({ rescueSquadId: 'force-1', userId: 'user-1', role: 'MEMBER', isActive: false });
    // Pending means no leftAt: a left or removed row always has one.
    expect(data.leftAt).toBeUndefined();

    // The account itself still needs the email confirmed before sign-in.
    expect(prisma.user.create.mock.calls[0][0].data.emailVerified).toBeNull();
  });

  it('says which force the confirmation email finishes joining', async () => {
    await register(signup({ joinForceId: 'force-1' }));
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      'rita@example.com',
      'Rita',
      expect.stringContaining('/verify-email?token='),
      { joiningForce: 'Austin Rescue Force' }
    );
  });

  it('refuses a force that does not exist (or was deleted) before creating anyone', async () => {
    prisma.rescueForce.findFirst.mockResolvedValue(null);
    const res = await register(signup({ joinForceId: 'gone' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/no longer exists/);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.rescueForceMember.create).not.toHaveBeenCalled();
  });

  it('refuses a joinForceId that is not a string', async () => {
    const res = await register(signup({ joinForceId: { id: 'force-1' } }));
    expect(res.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('answers a registered address the same general way and joins nobody', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'someone', email: 'rita@example.com' });
    const res = await register(signup({ joinForceId: 'force-1' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('Unable to create account. Please try again or use a different email.');
    expect(prisma.rescueForceMember.create).not.toHaveBeenCalled();
  });

  it('plain sign-up (no force) creates no membership and a plain email', async () => {
    const res = await register(signup());
    expect(res.status).toBe(200);
    expect(prisma.rescueForce.findFirst).not.toHaveBeenCalled();
    expect(prisma.rescueForceMember.create).not.toHaveBeenCalled();
    expect(sendVerificationEmail.mock.calls[0][3]).toEqual({ joiningForce: undefined });
  });
});

describe('POST /api/auth/verify-email activates pending joins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1', email: 'rita@example.com' });
    prisma.user.update.mockResolvedValue({});
    prisma.rescueForceMember.update.mockResolvedValue({});
    prisma.squadActivity.create.mockResolvedValue({});
  });

  it('makes the pending membership real and names the force', async () => {
    prisma.rescueForceMember.findMany.mockResolvedValue([
      { id: 'm-1', rescueSquadId: 'force-1', rescueSquad: { id: 'force-1', name: 'Austin Rescue Force', isDeleted: false } },
    ]);

    const res = await verify(post('/api/auth/verify-email', { token: 'raw-token' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    // Only rows that were never active and never left.
    expect(prisma.rescueForceMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', isActive: false, leftAt: null } })
    );
    expect(prisma.rescueForceMember.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { isActive: true, joinedAt: expect.any(Date) },
    });
    expect(prisma.squadActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ rescueSquadId: 'force-1', type: 'MEMBER_JOINED', actorId: 'user-1' }),
    });
    expect(body.forces).toEqual([{ id: 'force-1', name: 'Austin Rescue Force' }]);
    expect(body.email).toBe('rita@example.com');
  });

  it('skips a force deleted while the email waited', async () => {
    prisma.rescueForceMember.findMany.mockResolvedValue([
      { id: 'm-1', rescueSquadId: 'force-1', rescueSquad: { id: 'force-1', name: 'Gone', isDeleted: true } },
    ]);
    const body = await (await verify(post('/api/auth/verify-email', { token: 'raw-token' }))).json();
    expect(prisma.rescueForceMember.update).not.toHaveBeenCalled();
    expect(body.forces).toEqual([]);
  });

  it('a plain sign-up confirms with no forces', async () => {
    prisma.rescueForceMember.findMany.mockResolvedValue([]);
    const res = await verify(post('/api/auth/verify-email', { token: 'raw-token' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.forces).toEqual([]);
  });

  it('a failure activating never fails the confirmation', async () => {
    prisma.rescueForceMember.findMany.mockRejectedValue(new Error('db down'));
    const res = await verify(post('/api/auth/verify-email', { token: 'raw-token' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.forces).toEqual([]);
    // The email was still marked verified.
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ emailVerified: expect.any(Date) }) })
    );
  });

  it('a bad token activates nothing', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const res = await verify(post('/api/auth/verify-email', { token: 'nope' }));
    expect(res.status).toBe(400);
    expect(prisma.rescueForceMember.findMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/auth/verify-email (send the link again)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.update.mockResolvedValue({});
  });

  const again = (email) => new NextRequest(`http://localhost:3000/api/auth/verify-email?email=${encodeURIComponent(email)}`);

  it('names the force the person is still waiting to join', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'rita@example.com', firstName: 'Rita', emailVerified: null });
    prisma.rescueForceMember.findFirst.mockResolvedValue({ rescueSquad: { name: 'Austin Rescue Force' } });
    const res = await resend(again('rita@example.com'));
    expect(res.status).toBe(200);
    expect(prisma.rescueForceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', isActive: false, leftAt: null, rescueSquad: { isDeleted: false } },
      })
    );
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      'rita@example.com', 'Rita', expect.stringContaining('/verify-email?token='), { joiningForce: 'Austin Rescue Force' }
    );
  });

  it('a plain account gets the plain email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'sam@example.com', firstName: 'Sam', emailVerified: null });
    prisma.rescueForceMember.findFirst.mockResolvedValue(null);
    await resend(again('sam@example.com'));
    expect(sendVerificationEmail.mock.calls[0][3]).toEqual({ joiningForce: undefined });
  });

  it('an unknown or confirmed address still gets the same generic answer and no email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await resend(again('nobody@example.com'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.message).toMatch(/If an account exists/);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });
});
