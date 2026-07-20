/**
 * PR1 of the shelter account MVP: intake details + statuses.
 *
 * Shelter creates persist intake fields and default shelterStatus to
 * AVAILABLE; personal creates never carry intake fields; PATCH can move
 * shelterStatus through the canonical list but rejects unknown values
 * and refuses status on non-roster pets.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logging', () => ({ logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    pet: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    petShare: { findFirst: jest.fn() },
    shelterProfile: { findFirst: jest.fn() },
    shelterMember: { findFirst: jest.fn() },
  },
}));

import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { POST } from '@/app/api/pets/route';
import { PATCH } from '@/app/api/pets/[id]/route';

const VALID_BODY = {
  name: 'Clover',
  species: 'CAT',
  color: 'Gray tabby',
  size: 'SMALL',
};

const INTAKE_FIELDS = {
  intakeDate: '2026-07-18',
  intakeType: 'STRAY',
  intakeFoundAddress: '12 Oak St, Elgin, IL',
  intakeFoundLatitude: 42.04,
  intakeFoundLongitude: -88.28,
};

function makeRequest(body) {
  return { json: async () => body };
}

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { email: 'staff@shelter.org' } });
  prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'staff@shelter.org' });
  prisma.shelterProfile.findFirst.mockResolvedValue({ shelterId: 'shelter-1' });
  prisma.shelterMember.findFirst.mockResolvedValue(null);
  prisma.pet.create.mockImplementation(async ({ data }) => ({
    id: 'pet-1',
    photos: '[]',
    personality: '[]',
    ...data,
  }));
  prisma.pet.update.mockImplementation(async ({ data }) => ({
    id: 'pet-1',
    name: 'Clover',
    photos: '[]',
    personality: '[]',
    ...data,
  }));
});

describe('POST /api/pets shelter intake', () => {
  test('shelter create persists intake fields and defaults status to AVAILABLE', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, shelterId: 'shelter-1', ...INTAKE_FIELDS }));
    expect(res.status).toBe(201);

    const data = prisma.pet.create.mock.calls[0][0].data;
    expect(data.shelterStatus).toBe('AVAILABLE');
    expect(data.intakeType).toBe('STRAY');
    expect(data.intakeFoundAddress).toBe('12 Oak St, Elgin, IL');
    expect(data.intakeFoundLatitude).toBe(42.04);
    expect(data.intakeFoundLongitude).toBe(-88.28);
    expect(data.intakeDate).toBeInstanceOf(Date);
  });

  test('intake date defaults to now when omitted', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, shelterId: 'shelter-1', intakeType: 'SURRENDER' }));
    expect(res.status).toBe(201);
    const data = prisma.pet.create.mock.calls[0][0].data;
    expect(data.intakeDate).toBeInstanceOf(Date);
    expect(data.intakeType).toBe('SURRENDER');
    expect(data.intakeFoundAddress).toBeNull();
  });

  test('invalid intake type is a 400', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, shelterId: 'shelter-1', intakeType: 'FELL_FROM_SKY' }));
    expect(res.status).toBe(400);
    expect(prisma.pet.create).not.toHaveBeenCalled();
  });

  test('personal creates never carry intake fields', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, ...INTAKE_FIELDS }));
    expect(res.status).toBe(201);
    const data = prisma.pet.create.mock.calls[0][0].data;
    expect(data.shelterStatus).toBeUndefined();
    expect(data.intakeType).toBeUndefined();
    expect(data.intakeDate).toBeUndefined();
    expect(data.managedByShelterId).toBeNull();
  });
});

describe('PATCH /api/pets/[id] shelter status', () => {
  const params = Promise.resolve({ id: 'pet-1' });

  const MANAGED_PET = {
    id: 'pet-1',
    ownerId: 'user-1',
    name: 'Clover',
    managedByShelterId: 'shelter-1',
    photos: '[]',
    personality: '[]',
  };

  test('owner moves a roster animal through the status list', async () => {
    prisma.pet.findUnique.mockResolvedValue(MANAGED_PET);
    const res = await PATCH(makeRequest({ shelterStatus: 'ADOPTION_PENDING' }), { params });
    expect(res.status).toBe(200);
    expect(prisma.pet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ shelterStatus: 'ADOPTION_PENDING' }),
      })
    );
  });

  test('unknown status value is a 400', async () => {
    prisma.pet.findUnique.mockResolvedValue(MANAGED_PET);
    const res = await PATCH(makeRequest({ shelterStatus: 'LOST_IN_MAIL' }), { params });
    expect(res.status).toBe(400);
    expect(prisma.pet.update).not.toHaveBeenCalled();
  });

  test('status on a personal (non-roster) pet is refused', async () => {
    prisma.pet.findUnique.mockResolvedValue({ ...MANAGED_PET, managedByShelterId: null });
    const res = await PATCH(makeRequest({ shelterStatus: 'AVAILABLE' }), { params });
    expect(res.status).toBe(400);
    expect(prisma.pet.update).not.toHaveBeenCalled();
  });

  test('intake fields are silently ignored on personal pets', async () => {
    prisma.pet.findUnique.mockResolvedValue({ ...MANAGED_PET, managedByShelterId: null });
    const res = await PATCH(makeRequest({ intakeType: 'STRAY', breed: 'Beagle' }), { params });
    expect(res.status).toBe(200);
    const data = prisma.pet.update.mock.calls[0][0].data;
    expect(data.intakeType).toBeUndefined();
    expect(data.breed).toBe('Beagle');
  });

  test('intake fields update on roster pets', async () => {
    prisma.pet.findUnique.mockResolvedValue(MANAGED_PET);
    const res = await PATCH(
      makeRequest({ intakeType: 'TRANSFER', intakeFoundAddress: ' Barn on Rt 47 ' }),
      { params }
    );
    expect(res.status).toBe(200);
    const data = prisma.pet.update.mock.calls[0][0].data;
    expect(data.intakeType).toBe('TRANSFER');
    expect(data.intakeFoundAddress).toBe('Barn on Rt 47');
  });
});
