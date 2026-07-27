/**
 * Access-control tests for requirePetAccess (app/lib/petOwnership.js) -
 * the guard in front of every pet-scoped API route (medications, doses, shares).
 *
 * Matrix under test:
 *  - owner            -> OWNER, passes every level
 *  - ACTIVE CAREGIVER -> passes VIEWER + CAREGIVER, fails OWNER
 *  - ACTIVE VIEWER    -> passes VIEWER, fails CAREGIVER
 *  - PENDING share    -> no access (looks like 404)
 *  - stranger         -> 404, not 403 (pet ids must not be probeable)
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    pet: { findUnique: jest.fn() },
    petShare: { findFirst: jest.fn() },
  },
}));

import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { requirePetAccess, requirePetOwner } from '@/app/lib/petOwnership';

const PET = { id: 'pet-1', ownerId: 'owner-1', name: 'Biscuit', species: 'DOG', primaryPhotoUrl: '' };

function loginAs(user) {
  getServerSession.mockResolvedValue(user ? { user: { email: user.email } } : null);
  prisma.user.findUnique.mockResolvedValue(user);
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.pet.findUnique.mockResolvedValue(PET);
  prisma.petShare.findFirst.mockResolvedValue(null);
});

describe('requirePetAccess', () => {
  test('unauthenticated -> 401', async () => {
    loginAs(null);
    const res = await requirePetAccess('pet-1');
    expect(res).toMatchObject({ status: 401 });
  });

  test('owner gets OWNER access at every level', async () => {
    loginAs({ id: 'owner-1', email: 'owner@x.com' });
    for (const level of ['VIEWER', 'CAREGIVER', 'OWNER']) {
      const res = await requirePetAccess('pet-1', level);
      expect(res.access).toBe('OWNER');
      expect(res.error).toBeUndefined();
    }
  });

  test('ACTIVE CAREGIVER share: can view + manage meds, cannot act as owner', async () => {
    loginAs({ id: 'sarah-1', email: 'sarah@x.com' });
    prisma.petShare.findFirst.mockResolvedValue({ role: 'CAREGIVER' });

    expect((await requirePetAccess('pet-1', 'VIEWER')).access).toBe('CAREGIVER');
    expect((await requirePetAccess('pet-1', 'CAREGIVER')).access).toBe('CAREGIVER');
    expect(await requirePetAccess('pet-1', 'OWNER')).toMatchObject({ status: 403 });
  });

  test('ACTIVE VIEWER share: read-only', async () => {
    loginAs({ id: 'sarah-1', email: 'sarah@x.com' });
    prisma.petShare.findFirst.mockResolvedValue({ role: 'VIEWER' });

    expect((await requirePetAccess('pet-1', 'VIEWER')).access).toBe('VIEWER');
    expect(await requirePetAccess('pet-1', 'CAREGIVER')).toMatchObject({ status: 403 });
  });

  test('share lookup only matches ACTIVE shares for this pet + user/email', async () => {
    loginAs({ id: 'sarah-1', email: 'sarah@x.com' });
    await requirePetAccess('pet-1', 'VIEWER');
    expect(prisma.petShare.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          petId: 'pet-1',
          status: 'ACTIVE',
          OR: [{ userId: 'sarah-1' }, { email: 'sarah@x.com' }],
        }),
      })
    );
  });

  test('stranger gets 404 (not 403) so pet ids are not probeable', async () => {
    loginAs({ id: 'rando-1', email: 'rando@x.com' });
    const res = await requirePetAccess('pet-1', 'VIEWER');
    expect(res).toMatchObject({ status: 404, error: 'Pet not found' });
  });

  test('missing or soft-deleted pet -> 404', async () => {
    loginAs({ id: 'owner-1', email: 'owner@x.com' });
    prisma.pet.findUnique.mockResolvedValue(null);
    const res = await requirePetAccess('pet-gone', 'VIEWER');
    expect(res).toMatchObject({ status: 404 });
  });
});

describe('requirePetOwner', () => {
  test('is the OWNER-level guard: shared caregiver is rejected', async () => {
    loginAs({ id: 'sarah-1', email: 'sarah@x.com' });
    prisma.petShare.findFirst.mockResolvedValue({ role: 'CAREGIVER' });
    expect(await requirePetOwner('pet-1')).toMatchObject({ status: 403 });
  });

  test('owner passes', async () => {
    loginAs({ id: 'owner-1', email: 'owner@x.com' });
    expect((await requirePetOwner('pet-1')).access).toBe('OWNER');
  });
});
