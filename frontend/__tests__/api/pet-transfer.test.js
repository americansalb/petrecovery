/**
 * The adoption handoff (PetTransfer): the owner invites an adopter by
 * email; acceptance is keyed to that email and, in one transaction, flips
 * ownership, clears the shelter roster tag, removes old shares, and
 * rotates off the public view token. Strangers can't create transfers
 * (404 via requirePetOwner) and a forwarded link can't be accepted from
 * a different account (403).
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logging', () => ({ logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ ok: true }),
  renderBrandedEmail: jest.fn(() => '<html>mail</html>'),
}));
jest.mock('@/app/lib/config', () => ({
  getEmailBaseUrl: () => 'https://reunitepets.org',
}));
jest.mock('@/app/lib/rateLimit', () => ({
  withRateLimitAsync: jest.fn().mockResolvedValue({ success: true }),
  RateLimitPresets: { PUBLIC_WRITE: 'PUBLIC_WRITE' },
  rateLimitResponse: jest.fn(() => new Response('rate limited', { status: 429 })),
}));
jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    pet: { findUnique: jest.fn(), update: jest.fn() },
    petShare: { findFirst: jest.fn(), deleteMany: jest.fn() },
    petTransfer: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((ops) => Promise.all(ops)),
  },
}));

import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { sendEmail } from '@/app/lib/email';
import { POST as createTransfer, DELETE as cancelTransfer } from '@/app/api/pets/[id]/transfer/route';
import { GET as previewInvite, POST as acceptInvite } from '@/app/api/pets/transfer/[token]/route';

const PET = {
  id: 'pet-1',
  ownerId: 'shelter-user',
  name: 'Biscuit',
  species: 'DOG',
  primaryPhotoUrl: 'https://cdn.example/b.jpg',
};

const petParams = { params: Promise.resolve({ id: 'pet-1' }) };
const tokenParams = { params: Promise.resolve({ token: 'tok-123' }) };

function loginAs(user) {
  getServerSession.mockResolvedValue(user ? { user: { email: user.email } } : null);
  prisma.user.findUnique.mockResolvedValue(user);
}

function makeRequest(body) {
  return { json: async () => body };
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.pet.findUnique.mockResolvedValue(PET);
  prisma.petShare.findFirst.mockResolvedValue(null);
  prisma.petTransfer.updateMany.mockResolvedValue({ count: 0 });
  prisma.petTransfer.create.mockResolvedValue({
    id: 'tr-1',
    toEmail: 'adopter@x.com',
    createdAt: new Date('2026-07-20'),
  });
  prisma.$transaction.mockImplementation((ops) => Promise.all(ops));
});

describe('POST /api/pets/[id]/transfer (owner invites adopter)', () => {
  test('owner creates the invite and the adopter is emailed the accept link', async () => {
    loginAs({ id: 'shelter-user', email: 'staff@shelter.org' });

    const res = await createTransfer(makeRequest({ email: 'Adopter@X.com ' }), petParams);
    const body = await res.json();

    expect(res.status).toBe(201);
    // email normalized lowercase, prior pendings replaced
    expect(prisma.petTransfer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { petId: 'pet-1', status: 'PENDING' },
      })
    );
    expect(prisma.petTransfer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          petId: 'pet-1',
          toEmail: 'adopter@x.com',
          invitedById: 'shelter-user',
          token: expect.any(String),
        }),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'adopter@x.com' })
    );
    expect(body.acceptUrl).toMatch(/^https:\/\/reunitepets\.org\/pets\/transfer\//);
  });

  test('a non-owner gets 404 (ids stay unprobeable), nothing is created', async () => {
    loginAs({ id: 'stranger', email: 'stranger@x.com' });
    const res = await createTransfer(makeRequest({ email: 'adopter@x.com' }), petParams);
    expect(res.status).toBe(404);
    expect(prisma.petTransfer.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('bad email and self-transfer are rejected with 400', async () => {
    loginAs({ id: 'shelter-user', email: 'staff@shelter.org' });

    const bad = await createTransfer(makeRequest({ email: 'not-an-email' }), petParams);
    expect(bad.status).toBe(400);

    const self = await createTransfer(makeRequest({ email: 'Staff@Shelter.org' }), petParams);
    expect(self.status).toBe(400);
    expect(prisma.petTransfer.create).not.toHaveBeenCalled();
  });

  test('DELETE cancels the pending invite', async () => {
    loginAs({ id: 'shelter-user', email: 'staff@shelter.org' });
    const res = await cancelTransfer({}, petParams);
    expect(res.status).toBe(200);
    expect(prisma.petTransfer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { petId: 'pet-1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'CANCELED' }),
      })
    );
  });
});

describe('/api/pets/transfer/[token] (adopter side)', () => {
  const PENDING = {
    id: 'tr-1',
    toEmail: 'adopter@x.com',
    pet: {
      id: 'pet-1',
      name: 'Biscuit',
      species: 'DOG',
      breed: 'Beagle',
      primaryPhotoUrl: 'https://cdn.example/b.jpg',
      isDeleted: false,
      managedByShelterId: 'shelter-1',
      managedByShelter: { name: 'Happy Tails Shelter' },
    },
    invitedBy: { firstName: 'Sam', lastName: 'Staff' },
  };

  beforeEach(() => {
    prisma.petTransfer.findFirst.mockResolvedValue(PENDING);
  });

  test('unauthenticated preview gets 401', async () => {
    loginAs(null);
    const res = await previewInvite({}, tokenParams);
    expect(res.status).toBe(401);
  });

  test('the invited adopter previews the pet, from the shelter by name', async () => {
    loginAs({ id: 'adopter-1', email: 'adopter@x.com' });
    const res = await previewInvite({}, tokenParams);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.pet.name).toBe('Biscuit');
    expect(body.fromName).toBe('Happy Tails Shelter');
  });

  test('a different account holding the link is refused with 403', async () => {
    loginAs({ id: 'mallory', email: 'mallory@x.com' });
    const res = await acceptInvite({}, tokenParams);
    expect(res.status).toBe(403);
    expect(prisma.pet.update).not.toHaveBeenCalled();
  });

  test('accepting flips ownership, leaves the roster, and wipes old access', async () => {
    loginAs({ id: 'adopter-1', email: 'adopter@x.com' });
    const res = await acceptInvite({}, tokenParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.petId).toBe('pet-1');
    expect(prisma.pet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pet-1' },
        data: {
          ownerId: 'adopter-1',
          managedByShelterId: null,
          publicViewToken: null,
          // Leaving a shelter roster via an accepted handoff is an adoption
          shelterStatus: 'ADOPTED',
        },
      })
    );
    expect(prisma.petShare.deleteMany).toHaveBeenCalledWith({ where: { petId: 'pet-1' } });
    expect(prisma.petTransfer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tr-1' },
        data: expect.objectContaining({ status: 'ACCEPTED' }),
      })
    );
  });

  test('accepting a personal (non-shelter) handoff sets no shelter status', async () => {
    loginAs({ id: 'adopter-1', email: 'adopter@x.com' });
    prisma.petTransfer.findFirst.mockResolvedValue({
      ...PENDING,
      pet: { ...PENDING.pet, managedByShelterId: null, managedByShelter: null },
    });
    const res = await acceptInvite({}, tokenParams);
    expect(res.status).toBe(200);
    const data = prisma.pet.update.mock.calls[0][0].data;
    expect(data.shelterStatus).toBeUndefined();
  });

  test('an expired/canceled token reads as 404', async () => {
    loginAs({ id: 'adopter-1', email: 'adopter@x.com' });
    prisma.petTransfer.findFirst.mockResolvedValue(null);
    const res = await previewInvite({}, tokenParams);
    expect(res.status).toBe(404);
  });
});
