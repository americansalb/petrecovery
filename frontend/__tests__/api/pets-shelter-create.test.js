/**
 * Shelter accounts: POST /api/pets accepts an optional shelterId that tags
 * the record onto a shelter's roster, but ONLY when the caller is the
 * user who claimed that shelter (ShelterProfile.claimedById). Anyone else
 * gets a 403 and no pet is created, so rosters can't be polluted.
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

  test('a non-claimer gets 403 and no pet is created', async () => {
    prisma.shelterProfile.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ ...VALID_BODY, shelterId: 'shelter-1' }));
    expect(res.status).toBe(403);
    expect(prisma.pet.create).not.toHaveBeenCalled();
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
