/**
 * GET /api/pets/[id] reads through the standard access tiers
 * (requirePetAccess): owners AND care-team members can read the
 * profile the shell renders; strangers still get 404 (not 403).
 * Writes (PATCH/DELETE) stay owner-only and are covered elsewhere.
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
  },
}));

import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { GET } from '@/app/api/pets/[id]/route';

const FULL_PET = {
  id: 'pet-1',
  ownerId: 'owner-1',
  name: 'Biscuit',
  species: 'DOG',
  primaryPhotoUrl: '',
  photos: '["https://cdn.example/1.jpg"]',
  personality: '["Friendly"]',
  cases: [],
};

function loginAs(user) {
  getServerSession.mockResolvedValue(user ? { user: { email: user.email } } : null);
  prisma.user.findUnique.mockResolvedValue(user);
}

const params = Promise.resolve({ id: 'pet-1' });

beforeEach(() => {
  jest.clearAllMocks();
  prisma.pet.findUnique.mockResolvedValue(FULL_PET);
  prisma.petShare.findFirst.mockResolvedValue(null);
});

describe('GET /api/pets/[id] access tiers', () => {
  test('owner reads the pet with access OWNER', async () => {
    loginAs({ id: 'owner-1', email: 'owner@x.com' });
    const res = await GET({}, { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.access).toBe('OWNER');
    expect(body.pet.name).toBe('Biscuit');
    expect(body.pet.photos).toEqual(['https://cdn.example/1.jpg']);
  });

  test('ACTIVE CAREGIVER reads the pet with access CAREGIVER', async () => {
    loginAs({ id: 'sarah-1', email: 'sarah@x.com' });
    prisma.petShare.findFirst.mockResolvedValue({ role: 'CAREGIVER' });
    const res = await GET({}, { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.access).toBe('CAREGIVER');
    expect(body.pet.name).toBe('Biscuit');
  });

  test('ACTIVE VIEWER reads the pet with access VIEWER', async () => {
    loginAs({ id: 'vera-1', email: 'vera@x.com' });
    prisma.petShare.findFirst.mockResolvedValue({ role: 'VIEWER' });
    const res = await GET({}, { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.access).toBe('VIEWER');
  });

  test('stranger gets 404, not 403 (ids stay unprobeable)', async () => {
    loginAs({ id: 'someone-else', email: 'stranger@x.com' });
    const res = await GET({}, { params });
    expect(res.status).toBe(404);
  });

  test('unauthenticated gets 401', async () => {
    loginAs(null);
    const res = await GET({}, { params });
    expect(res.status).toBe(401);
  });
});
