/**
 * Weight log API. The headline weight on the profile follows the newest
 * entry, so deleting the newest one must fall back to the next newest (or
 * clear it), never leave the just-deleted value showing. Plus input bounds.
 */

jest.mock('@/app/lib/petOwnership', () => ({ requirePetAccess: jest.fn() }));
jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    petWeightEntry: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    pet: { update: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import prisma from '@/app/lib/prisma';
import { requirePetAccess } from '@/app/lib/petOwnership';
import { POST, DELETE } from '@/app/api/pets/[id]/weights/route';

const params = { params: Promise.resolve({ id: 'pet-1' }) };
const req = (body) => ({ json: async () => body });
const delReq = (qs) => ({ url: `http://x/api/pets/pet-1/weights?${qs}` });

beforeEach(() => {
  jest.clearAllMocks();
  requirePetAccess.mockResolvedValue({ access: 'CAREGIVER', user: { id: 'u1' } });
  // Run the transaction callback against the mocked client directly.
  prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
});

describe('POST validation', () => {
  test.each([
    ['not a number', { weightLbs: 'heavy' }],
    ['zero', { weightLbs: 0 }],
    ['negative', { weightLbs: -3 }],
    ['implausible', { weightLbs: 900 }],
  ])('rejects %s', async (_label, body) => {
    const res = await POST(req(body), params);
    expect(res.status).toBe(400);
    expect(prisma.petWeightEntry.create).not.toHaveBeenCalled();
  });

  test('rejects a future-dated entry (would hijack the headline weight)', async () => {
    const future = new Date(Date.now() + 7 * 86400000).toISOString();
    const res = await POST(req({ weightLbs: 42, recordedAt: future }), params);
    expect(res.status).toBe(400);
    expect(prisma.petWeightEntry.create).not.toHaveBeenCalled();
  });

  test('accepts a backdated entry (historical weigh-ins are valid)', async () => {
    prisma.petWeightEntry.create.mockResolvedValue({ id: 'w0', weightLbs: 40 });
    prisma.petWeightEntry.findFirst.mockResolvedValue({ weightLbs: 41.2 });
    const past = new Date(Date.now() - 30 * 86400000).toISOString();
    const res = await POST(req({ weightLbs: 40, recordedAt: past }), params);
    expect(res.status).toBe(201);
  });

  test('a valid weight is stored and becomes the headline', async () => {
    prisma.petWeightEntry.create.mockResolvedValue({ id: 'w1', weightLbs: 41.2 });
    prisma.petWeightEntry.findFirst.mockResolvedValue({ weightLbs: 41.2 });
    const res = await POST(req({ weightLbs: 41.2 }), params);
    expect(res.status).toBe(201);
    expect(prisma.pet.update).toHaveBeenCalledWith(expect.objectContaining({ data: { weight: 41.2 } }));
  });
});

describe('DELETE recompute', () => {
  test('deleting the newest entry falls back to the next newest', async () => {
    prisma.petWeightEntry.findFirst
      .mockResolvedValueOnce({ id: 'w-new', weightLbs: 68.4 }) // the existence check
      .mockResolvedValueOnce({ id: 'w-old', weightLbs: 70.1 }); // newest remaining after tombstone
    const res = await DELETE(delReq('entryId=w-new'), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(prisma.pet.update).toHaveBeenCalledWith(expect.objectContaining({ data: { weight: 70.1 } }));
    expect(body.weight).toBe(70.1);
  });

  test('deleting the only entry clears the headline weight', async () => {
    prisma.petWeightEntry.findFirst
      .mockResolvedValueOnce({ id: 'w-only', weightLbs: 68.4 })
      .mockResolvedValueOnce(null);
    const res = await DELETE(delReq('entryId=w-only'), params);
    expect(res.status).toBe(200);
    expect(prisma.pet.update).toHaveBeenCalledWith(expect.objectContaining({ data: { weight: null } }));
  });

  test('a missing entry is a 404 and touches nothing', async () => {
    prisma.petWeightEntry.findFirst.mockResolvedValueOnce(null);
    const res = await DELETE(delReq('entryId=nope'), params);
    expect(res.status).toBe(404);
    expect(prisma.pet.update).not.toHaveBeenCalled();
  });

  test('a viewer cannot delete', async () => {
    requirePetAccess.mockResolvedValue({ error: 'Forbidden', status: 403 });
    const res = await DELETE(delReq('entryId=w1'), params);
    expect(res.status).toBe(403);
  });
});
