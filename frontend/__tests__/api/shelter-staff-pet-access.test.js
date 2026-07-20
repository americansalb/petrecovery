/**
 * The PR3 blast-radius boundary: shelter staff get OWNER access to
 * ROSTER animals (managedByShelterId set) and nothing else. A revoked
 * seat loses access instantly; the claimer's PERSONAL pets are never
 * reachable through shelter membership.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logging', () => ({ logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    pet: { findUnique: jest.fn() },
    petShare: { findFirst: jest.fn() },
    shelterProfile: { findFirst: jest.fn() },
    shelterMember: { findFirst: jest.fn() },
  },
}));

import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { GET } from '@/app/api/pets/[id]/route';

const ROSTER_PET = {
  id: 'pet-1',
  ownerId: 'claimer-1',
  name: 'Scout',
  species: 'DOG',
  primaryPhotoUrl: '',
  managedByShelterId: 'shelter-1',
  photos: '[]',
  personality: '[]',
  cases: [],
};

const PERSONAL_PET = { ...ROSTER_PET, id: 'pet-2', managedByShelterId: null };

const params = Promise.resolve({ id: 'pet-1' });

function loginAs(user) {
  getServerSession.mockResolvedValue(user ? { user: { email: user.email } } : null);
  prisma.user.findUnique.mockResolvedValue(user);
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.pet.findUnique.mockResolvedValue(ROSTER_PET);
  prisma.petShare.findFirst.mockResolvedValue(null);
  prisma.shelterProfile.findFirst.mockResolvedValue(null);
  prisma.shelterMember.findFirst.mockResolvedValue(null);
});

describe('shelter staff access to roster pets', () => {
  test('an ACTIVE staff seat gets OWNER on a roster animal', async () => {
    loginAs({ id: 'staff-1', email: 'staff@shelter.org' });
    prisma.shelterMember.findFirst.mockResolvedValue({ id: 'seat-1' });

    const res = await GET({}, { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.access).toBe('OWNER');
    expect(prisma.shelterMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ shelterId: 'shelter-1', status: 'ACTIVE' }),
      })
    );
  });

  test('a revoked seat reads as a stranger: 404', async () => {
    loginAs({ id: 'staff-1', email: 'staff@shelter.org' });
    prisma.shelterMember.findFirst.mockResolvedValue(null); // ACTIVE filter finds nothing

    const res = await GET({}, { params });
    expect(res.status).toBe(404);
  });

  test('membership never reaches the claimer\'s PERSONAL pets', async () => {
    loginAs({ id: 'staff-1', email: 'staff@shelter.org' });
    prisma.pet.findUnique.mockResolvedValue(PERSONAL_PET);
    // Even with an ACTIVE seat, the shelter check must not run for a
    // non-roster pet; the stranger path (404) applies.
    prisma.shelterMember.findFirst.mockResolvedValue({ id: 'seat-1' });

    const res = await GET({}, { params: Promise.resolve({ id: 'pet-2' }) });
    expect(res.status).toBe(404);
    expect(prisma.shelterMember.findFirst).not.toHaveBeenCalled();
  });

  test('the shelter claimer also gets OWNER through the shelter path', async () => {
    loginAs({ id: 'other-claimer', email: 'boss@shelter.org' });
    prisma.shelterProfile.findFirst.mockResolvedValue({ shelterId: 'shelter-1' });

    const res = await GET({}, { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.access).toBe('OWNER');
  });
});
