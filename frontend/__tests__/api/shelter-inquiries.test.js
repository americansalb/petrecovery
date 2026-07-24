/**
 * Adoption inquiries: the public form only reaches claimed + active
 * shelters (404 otherwise, non-probeable), is rate limited and
 * validated, tags a pet only when it belongs to that shelter, and
 * notifies staff. The portal side is team-only and other shelters'
 * inquiries read as 404.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logging', () => ({ logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/notifications-inapp', () => ({
  createInAppNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock('@/app/lib/push', () => ({
  sendPushToUser: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/app/lib/shelterAuth', () => ({
  getShelterForUser: jest.fn(),
  getShelterStaffUserIds: jest.fn().mockResolvedValue(['staff-1', 'staff-2']),
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
    shelter: { findUnique: jest.fn() },
    shelterProfile: { findUnique: jest.fn() },
    shelterInquiry: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    pet: { findFirst: jest.fn() },
  },
}));

import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { getShelterForUser } from '@/app/lib/shelterAuth';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { POST as publicPost } from '@/app/api/shelters/[id]/inquiries/route';
import { GET as portalList } from '@/app/api/shelter/inquiries/route';
import { PATCH as portalPatch } from '@/app/api/shelter/inquiries/[inquiryId]/route';

const shelterParams = { params: Promise.resolve({ id: 'shelter-1' }) };
const inquiryParams = { params: Promise.resolve({ inquiryId: 'inq-1' }) };

const req = (body) => ({ json: async () => body });

const validBody = {
  name: 'Jamie Doe',
  email: 'Jamie@Example.com',
  message: 'We have a fenced yard and two calm dogs; Clover sounds perfect.',
};

function claimedActiveShelter() {
  prisma.shelter.findUnique.mockResolvedValue({ id: 'shelter-1', isActive: true, name: 'Austin Animal Center' });
  prisma.shelterProfile.findUnique.mockResolvedValue({ claimedById: 'claimer-1' });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWithRateLimitAsync.mockResolvedValue({ success: true });
  prisma.shelterInquiry.create.mockImplementation(async ({ data }) => ({ id: 'inq-1', ...data }));
  prisma.pet.findFirst.mockResolvedValue(null);
});

describe('POST /api/shelters/[id]/inquiries (public)', () => {
  test('a valid inquiry is stored lowercase-email and staff are notified', async () => {
    claimedActiveShelter();
    const res = await publicPost(req(validBody), shelterParams);
    expect(res.status).toBe(201);
    expect(mockWithRateLimitAsync).toHaveBeenCalledWith(expect.anything(), 'PUBLIC_WRITE', 'shelter:inquiry');
    const { data } = prisma.shelterInquiry.create.mock.calls[0][0];
    expect(data.email).toBe('jamie@example.com');
    expect(data.shelterId).toBe('shelter-1');
    expect(data.petId).toBeNull();
    expect(createInAppNotification).toHaveBeenCalledTimes(2);
  });

  test('unclaimed or inactive shelters read as 404', async () => {
    prisma.shelter.findUnique.mockResolvedValue({ id: 'shelter-1', isActive: true, name: 'X' });
    prisma.shelterProfile.findUnique.mockResolvedValue(null);
    expect((await publicPost(req(validBody), shelterParams)).status).toBe(404);

    prisma.shelter.findUnique.mockResolvedValue({ id: 'shelter-1', isActive: false, name: 'X' });
    prisma.shelterProfile.findUnique.mockResolvedValue({ claimedById: 'claimer-1' });
    expect((await publicPost(req(validBody), shelterParams)).status).toBe(404);
    expect(prisma.shelterInquiry.create).not.toHaveBeenCalled();
  });

  test('validation: short name, bad email, short message all 400', async () => {
    claimedActiveShelter();
    expect((await publicPost(req({ ...validBody, name: 'J' }), shelterParams)).status).toBe(400);
    expect((await publicPost(req({ ...validBody, email: 'nope' }), shelterParams)).status).toBe(400);
    expect((await publicPost(req({ ...validBody, message: 'hi' }), shelterParams)).status).toBe(400);
    expect(prisma.shelterInquiry.create).not.toHaveBeenCalled();
  });

  test('a pathological email cannot burn CPU: bounded before the regex', async () => {
    claimedActiveShelter();
    // This shape backtracks quadratically against a permissive email regex.
    // Uncapped it stalled the whole single-threaded server for ~25 seconds.
    const evil = 'a@' + 'b.'.repeat(80000) + '\tx';
    const started = Date.now();
    const res = await publicPost(req({ ...validBody, email: evil }), shelterParams);
    const elapsed = Date.now() - started;

    expect(res.status).toBe(400);
    expect(elapsed).toBeLessThan(250);
    expect(prisma.shelterInquiry.create).not.toHaveBeenCalled();
  });

  test('emails that would inject mailto headers are rejected', async () => {
    claimedActiveShelter();
    // '?cc=' / '&bcc=' would otherwise ride into the reply link staff click
    const injections = [
      'adopter@shelter.org?cc=harvest%40evil.com',
      'adopter@shelter.org&bcc=harvest%40evil.com',
      'adopter@shelter.org?subject=Re:%20your%20application',
    ];
    for (const email of injections) {
      expect((await publicPost(req({ ...validBody, email }), shelterParams)).status).toBe(400);
    }
    expect(prisma.shelterInquiry.create).not.toHaveBeenCalled();

    // ordinary addresses still pass
    const ok = await publicPost(req({ ...validBody, email: 'first.last+tag@sub.shelter-org.co.uk' }), shelterParams);
    expect(ok.status).toBe(201);
  });

  test('a petId from another shelter becomes a general inquiry, not an error', async () => {
    claimedActiveShelter();
    prisma.pet.findFirst.mockResolvedValue(null);
    const res = await publicPost(req({ ...validBody, petId: 'someone-elses-pet' }), shelterParams);
    expect(res.status).toBe(201);
    expect(prisma.shelterInquiry.create.mock.calls[0][0].data.petId).toBeNull();
  });

  test("the shelter's own pet is tagged", async () => {
    claimedActiveShelter();
    prisma.pet.findFirst.mockResolvedValue({ id: 'pet-9' });
    const res = await publicPost(req({ ...validBody, petId: 'pet-9' }), shelterParams);
    expect(res.status).toBe(201);
    expect(prisma.shelterInquiry.create.mock.calls[0][0].data.petId).toBe('pet-9');
  });
});

describe('portal inquiry routes', () => {
  test('a stranger cannot list inquiries', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'rando-1', email: 'r@x.com' } });
    getShelterForUser.mockResolvedValue(null);
    expect((await portalList()).status).toBe(403);
  });

  test('a team member lists their shelter inbox', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'staff-1', email: 's@x.com' } });
    getShelterForUser.mockResolvedValue({ shelterId: 'shelter-1', role: 'STAFF' });
    prisma.shelterInquiry.findMany.mockResolvedValue([{ id: 'inq-1', status: 'NEW' }]);
    const res = await portalList();
    expect(res.status).toBe(200);
    expect(prisma.shelterInquiry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shelterId: 'shelter-1' } })
    );
  });

  test("another shelter's inquiry reads as 404 on PATCH", async () => {
    getServerSession.mockResolvedValue({ user: { id: 'staff-1', email: 's@x.com' } });
    getShelterForUser.mockResolvedValue({ shelterId: 'shelter-1', role: 'STAFF' });
    prisma.shelterInquiry.findUnique.mockResolvedValue({ id: 'inq-1', shelterId: 'shelter-2' });
    const res = await portalPatch(req({ status: 'REPLIED' }), inquiryParams);
    expect(res.status).toBe(404);
    expect(prisma.shelterInquiry.update).not.toHaveBeenCalled();
  });

  test('status updates are validated and applied', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'staff-1', email: 's@x.com' } });
    getShelterForUser.mockResolvedValue({ shelterId: 'shelter-1', role: 'STAFF' });
    prisma.shelterInquiry.findUnique.mockResolvedValue({ id: 'inq-1', shelterId: 'shelter-1' });

    expect((await portalPatch(req({ status: 'SPAM' }), inquiryParams)).status).toBe(400);

    const ok = await portalPatch(req({ status: 'REPLIED' }), inquiryParams);
    expect(ok.status).toBe(200);
    expect(prisma.shelterInquiry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REPLIED' } })
    );
  });
});
