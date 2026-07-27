/**
 * The account switcher's source of truth: which worlds does this person
 * belong to right now?
 *
 * Presentation only. It must never be the thing that decides what someone
 * may DO, and it must not invent hats the person does not hold - with one
 * deliberate exception: the SEARCHER door is always offered (it is the
 * recruitment door, docs/PRODUCT_IA_PLAN.md "Three doors"). Members land
 * on their force; everyone else lands on the network to find one.
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
  test('a plain pet owner gets owner plus the always-open searcher door', async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.modes.map((m) => m.id)).toEqual(['owner', 'searcher']);
    // Not a member of any force: the door leads to the network, not a force
    expect(body.modes[1]).toEqual(
      expect.objectContaining({ label: 'Searcher', href: '/rescue-forces/search' })
    );
  });

  test('a shelter hat adds the shelter world, named after the shelter', async () => {
    getShelterForUser.mockResolvedValue({ shelterId: 's-1', role: 'STAFF' });
    const res = await GET();
    const body = await res.json();
    expect(body.modes.map((m) => m.id)).toEqual(['owner', 'shelter', 'searcher']);
    expect(body.modes[1]).toEqual(
      expect.objectContaining({ label: 'Austin Animal Center', href: '/my-shelter' })
    );
  });

  test('an active rescue force points the searcher door at that force', async () => {
    prisma.rescueForceMember.findFirst.mockResolvedValue({
      rescueSquad: { id: 'rf-9', name: 'Travis County Search' },
    });
    const res = await GET();
    const body = await res.json();
    expect(body.modes.map((m) => m.id)).toEqual(['owner', 'searcher']);
    expect(body.modes[1].href).toBe('/rescue-forces/rf-9');
    expect(body.modes[1].label).toBe('Travis County Search');
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
    expect(body.modes.map((m) => m.id)).toEqual(['owner', 'shelter', 'searcher']);
  });

  test('signed out is 401, never a mode list', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
