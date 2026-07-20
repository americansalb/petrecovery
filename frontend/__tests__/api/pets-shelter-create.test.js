/**
 * Shelter accounts: POST /api/pets accepts an optional shelterId that tags
 * the record onto a shelter's roster, but ONLY when the caller manages
 * that shelter (the claimer, or an ACTIVE ShelterMember seat). Anyone
 * else gets a 403 and no pet is created, so rosters can't be polluted.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logging', () => ({ logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    pet: { create: jest.fn() },
    shelterProfile: { findFirst: jest.fn() },
    shelterMember: { findFirst: jest.fn() },
  },
}));

import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { POST } from '@/app/api/pets/route';

const VALID_BODY = {
  name: 'Biscuit',
  species: 'DOG',
  color: 'Brown',
  size: 'MEDIUM',
};

function makeRequest(body) {
  return { json: async () => body };
}

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { email: 'staff@shelter.org' } });
  prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
  prisma.pet.create.mockImplementation(async ({ data }) => ({
    id: 'pet-1',
    ...data,
  }));
  prisma.shelterMember.findFirst.mockResolvedValue(null);
});

describe('POST /api/pets with shelterId', () => {
  test('the claiming user tags the pet onto the shelter roster', async () => {
    prisma.shelterProfile.findFirst.mockResolvedValue({ shelterId: 'shelter-1' });

    const res = await POST(makeRequest({ ...VALID_BODY, shelterId: 'shelter-1' }));
    expect(res.status).toBe(201);

    expect(prisma.shelterProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shelterId: 'shelter-1', claimedById: 'user-1' },
      })
    );
    expect(prisma.pet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ managedByShelterId: 'shelter-1' }),
      })
    );
  });

  test('a stranger (no claim, no seat) gets 403 and no pet is created', async () => {
    prisma.shelterProfile.findFirst.mockResolvedValue(null);
    prisma.shelterMember.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ ...VALID_BODY, shelterId: 'shelter-1' }));
    expect(res.status).toBe(403);
    expect(prisma.pet.create).not.toHaveBeenCalled();
  });

  test('an ACTIVE staff seat tags the roster too', async () => {
    prisma.shelterProfile.findFirst.mockResolvedValue(null);
    prisma.shelterMember.findFirst.mockResolvedValue({ id: 'seat-1' });

    const res = await POST(makeRequest({ ...VALID_BODY, shelterId: 'shelter-1' }));
    expect(res.status).toBe(201);
    expect(prisma.shelterMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ shelterId: 'shelter-1', status: 'ACTIVE' }),
      })
    );
    expect(prisma.pet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ managedByShelterId: 'shelter-1' }),
      })
    );
  });

  test('without shelterId the pet stays personal (managedByShelterId null)', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(201);
    expect(prisma.shelterProfile.findFirst).not.toHaveBeenCalled();
    expect(prisma.pet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ managedByShelterId: null }),
      })
    );
  });
});
