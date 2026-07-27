/**
 * Shelter staff seats: invite authz tiers, dup/cap handling, rate
 * limiting (it emails arbitrary addresses), revoke-keeps-the-row, and
 * accept linking the invitee's account.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logging', () => ({ logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  renderBrandedEmail: jest.fn(() => '<html>mail</html>'),
  escapeHtml: (s) => String(s ?? ''),
}));
jest.mock('@/app/lib/config', () => ({ getEmailBaseUrl: () => 'https://reunitepets.org' }));
jest.mock('@/app/lib/notifications-inapp', () => ({
  createInAppNotification: jest.fn().mockResolvedValue({}),
}));
const mockWithRateLimitAsync = jest.fn();
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: (...args) => mockWithRateLimitAsync(...args),
  RateLimitPresets: { PUBLIC_WRITE: 'PUBLIC_WRITE' },
  rateLimitResponse: jest.fn(() => new Response('rate limited', { status: 429 })),
}));
jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    shelter: { findUnique: jest.fn() },
    shelterProfile: { findFirst: jest.fn(), findUnique: jest.fn() },
    shelterMember: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { sendEmail } from '@/app/lib/email';
import { GET as listMembers, POST as inviteMember } from '@/app/api/shelter/members/route';
import { DELETE as removeMember } from '@/app/api/shelter/members/[memberId]/route';
import { POST as acceptInvite } from '@/app/api/shelter/members/accept/route';

const memberParams = { params: Promise.resolve({ memberId: 'seat-1' }) };

function loginAs(id, email) {
  getServerSession.mockResolvedValue(id ? { user: { id, email } } : null);
}

function asOwner() {
  loginAs('claimer-1', 'owner@shelter.org');
  prisma.shelterProfile.findFirst.mockResolvedValue({ shelterId: 'shelter-1' });
}

function asStranger() {
  loginAs('rando-1', 'rando@x.com');
  prisma.shelterProfile.findFirst.mockResolvedValue(null);
  prisma.shelterMember.findFirst.mockResolvedValue(null);
}

const req = (body) => ({ json: async () => body });

beforeEach(() => {
  jest.clearAllMocks();
  mockWithRateLimitAsync.mockResolvedValue({ success: true });
  prisma.shelterMember.findFirst.mockResolvedValue(null);
  prisma.shelterMember.findUnique.mockResolvedValue(null);
  prisma.shelterMember.count.mockResolvedValue(1);
  prisma.shelterMember.create.mockImplementation(async ({ data }) => ({ id: 'seat-1', ...data }));
  prisma.shelterMember.update.mockImplementation(async ({ data }) => ({ id: 'seat-1', ...data }));
  prisma.user.findUnique.mockResolvedValue(null);
  prisma.shelter.findUnique.mockResolvedValue({ name: 'Austin Animal Center' });
});

describe('GET /api/shelter/members', () => {
  test('returns the owner seat plus members with linked names, without userIds', async () => {
    asOwner();
    prisma.shelterMember.findMany.mockResolvedValue([
      {
        id: 'seat-1', email: 'sarah@x.com', role: 'STAFF', status: 'ACTIVE',
        userId: 'u-sarah', createdAt: new Date('2026-06-01'), respondedAt: new Date('2026-06-02'),
      },
      {
        id: 'seat-2', email: 'new@x.com', role: 'STAFF', status: 'PENDING',
        userId: null, createdAt: new Date('2026-07-20'), respondedAt: null,
      },
    ]);
    prisma.shelterProfile.findUnique.mockResolvedValue({
      claimedById: 'claimer-1', claimedAt: new Date('2026-01-05'),
    });
    prisma.user.findMany.mockResolvedValue([
      { id: 'claimer-1', firstName: 'Avery', lastName: 'Admin', email: 'owner@shelter.org' },
      { id: 'u-sarah', firstName: 'Sarah', lastName: 'Chen', email: 'sarah@x.com' },
    ]);

    const res = await listMembers();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.owner).toEqual(
      expect.objectContaining({ name: 'Avery Admin', email: 'owner@shelter.org' })
    );
    expect(body.members).toHaveLength(2);
    expect(body.members[0]).toEqual(expect.objectContaining({ name: 'Sarah Chen', status: 'ACTIVE' }));
    expect(body.members[0].userId).toBeUndefined();
    expect(body.members[1].name).toBeNull();
    expect(body.myRole).toBe('OWNER');
  });
});

describe('POST /api/shelter/members (invite)', () => {
  test('the owner invites by email; seat is PENDING and the invite is rate limited', async () => {
    asOwner();
    const res = await inviteMember(req({ email: ' NewStaff@Shelter.ORG ', role: 'STAFF' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.member.status).toBe('PENDING');
    expect(mockWithRateLimitAsync).toHaveBeenCalledWith(expect.anything(), 'PUBLIC_WRITE', 'shelter:member-invite');
    expect(prisma.shelterMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shelterId: 'shelter-1',
          email: 'newstaff@shelter.org',
          status: 'PENDING',
        }),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'newstaff@shelter.org' }));
  });

  test('strangers cannot invite', async () => {
    asStranger();
    const res = await inviteMember(req({ email: 'x@y.com' }));
    expect(res.status).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('STAFF seats cannot invite (managers only)', async () => {
    loginAs('staff-1', 'staff@shelter.org');
    prisma.shelterProfile.findFirst.mockResolvedValue(null);
    prisma.shelterMember.findFirst.mockResolvedValue({ shelterId: 'shelter-1', role: 'STAFF' });
    const res = await inviteMember(req({ email: 'x@y.com' }));
    expect(res.status).toBe(403);
  });

  test('duplicates 409, cap 400, bad email 400, self-invite 400', async () => {
    asOwner();

    prisma.shelterMember.findUnique.mockResolvedValue({ id: 'seat-1', status: 'ACTIVE' });
    expect((await inviteMember(req({ email: 'dupe@x.com' }))).status).toBe(409);

    prisma.shelterMember.findUnique.mockResolvedValue(null);
    prisma.shelterMember.count.mockResolvedValue(15);
    expect((await inviteMember(req({ email: 'x@y.com' }))).status).toBe(400);

    prisma.shelterMember.count.mockResolvedValue(1);
    expect((await inviteMember(req({ email: 'not-an-email' }))).status).toBe(400);
    expect((await inviteMember(req({ email: 'Owner@Shelter.org' }))).status).toBe(400);
  });

  test('an existing account is linked immediately but the seat still waits for accept', async () => {
    asOwner();
    prisma.user.findUnique.mockResolvedValue({ id: 'invitee-9' });
    const res = await inviteMember(req({ email: 'known@x.com' }));
    expect(res.status).toBe(201);
    const data = prisma.shelterMember.create.mock.calls[0][0].data;
    expect(data.userId).toBe('invitee-9');
    expect(data.status).toBe('PENDING');
  });
});

describe('DELETE /api/shelter/members/[memberId]', () => {
  test('revoke keeps the row as REVOKED', async () => {
    asOwner();
    prisma.shelterMember.findUnique.mockResolvedValue({
      id: 'seat-1', shelterId: 'shelter-1', email: 'staff@x.com', userId: null, role: 'STAFF', status: 'ACTIVE',
    });
    const res = await removeMember({}, memberParams);
    expect(res.status).toBe(200);
    expect(prisma.shelterMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REVOKED' }) })
    );
  });

  test('a stranger cannot see the seat (404)', async () => {
    asStranger();
    prisma.shelterMember.findUnique.mockResolvedValue({
      id: 'seat-1', shelterId: 'shelter-1', email: 'staff@x.com', userId: null, role: 'STAFF', status: 'ACTIVE',
    });
    const res = await removeMember({}, memberParams);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/shelter/members/accept', () => {
  test('the invitee accepts and their account is linked', async () => {
    loginAs('invitee-9', 'NewStaff@Shelter.org');
    prisma.shelterMember.findFirst.mockResolvedValue({
      id: 'seat-1', shelterId: 'shelter-1', invitedById: 'claimer-1',
    });
    const res = await acceptInvite();
    expect(res.status).toBe(200);
    expect(prisma.shelterMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'seat-1' },
        data: expect.objectContaining({ status: 'ACTIVE', userId: 'invitee-9' }),
      })
    );
  });

  test('no pending invite reads as 404', async () => {
    loginAs('rando-1', 'rando@x.com');
    prisma.shelterMember.findFirst.mockResolvedValue(null);
    const res = await acceptInvite();
    expect(res.status).toBe(404);
  });
});
