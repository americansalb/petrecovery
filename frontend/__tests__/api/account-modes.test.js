/**
 * The account switcher's source of truth: which worlds does this person
 * belong to right now?
 *
 * Presentation only. It must never be the thing that decides what someone
 * may DO, and it must not invent hats the person does not hold.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/app/lib/shelterAuth', () => ({ getShelterForUser: jest.fn() }));
jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    shelter: { findUnique: jest.fn() },
    rescueForceMember: { findFirst: jest.fn() },
  },
}));

import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { getShelterForUser } from '@/app/lib/shelterAuth';
import { GET } from '@/app/api/account/modes/route';

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: 'u-1', email: 'a@b.co' } });
  getShelterForUser.mockResolvedValue(null);
  prisma.rescueForceMember.findFirst.mockResolvedValue(null);
  prisma.shelter.findUnique.mockResolvedValue({ name: 'Austin Animal Center' });
});

describe('GET /api/account/modes', () => {
  test('a plain pet owner gets one mode, so the switcher stays hidden', async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.modes).toHaveLength(1);
    expect(body.modes[0].id).toBe('owner');
  });

  test('a shelter hat adds the shelter world, named after the shelter', async () => {
    getShelterForUser.mockResolvedValue({ shelterId: 's-1', role: 'STAFF' });
    const res = await GET();
    const body = await res.json();
    expect(body.modes.map((m) => m.id)).toEqual(['owner', 'shelter']);
    expect(body.modes[1]).toEqual(
      expect.objectContaining({ label: 'Austin Animal Center', href: '/my-shelter' })
    );
  });

  test('an active rescue force adds the rescuer world', async () => {
    prisma.rescueForceMember.findFirst.mockResolvedValue({
      rescueSquad: { id: 'rf-9', name: 'Travis County Search' },
    });
    const res = await GET();
    const body = await res.json();
    expect(body.modes.map((m) => m.id)).toEqual(['owner', 'rescuer']);
    expect(body.modes[1].href).toBe('/rescue-forces/rf-9');
  });

  test('only ACTIVE, unresigned memberships count', async () => {
    await GET();
    expect(prisma.rescueForceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'u-1', isActive: true, leftAt: null }),
      })
    );
  });

  test('all three hats can be held by one account', async () => {
    getShelterForUser.mockResolvedValue({ shelterId: 's-1', role: 'OWNER' });
    prisma.rescueForceMember.findFirst.mockResolvedValue({
      rescueSquad: { id: 'rf-9', name: 'Travis County Search' },
    });
    const res = await GET();
    const body = await res.json();
    expect(body.modes.map((m) => m.id)).toEqual(['owner', 'shelter', 'rescuer']);
  });

  test('signed out is 401, never a mode list', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
