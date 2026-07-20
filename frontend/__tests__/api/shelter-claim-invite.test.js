/**
 * Admin-invited shelter claim (/shelter/claim): the one-time token flow
 * that used to dead-end on a page that didn't exist. Accepting sets the
 * claimer, activates + verifies the shelter, and burns the token.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logging', () => ({ logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    shelter: { findUnique: jest.fn(), update: jest.fn() },
    shelterProfile: { findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn((ops) => Promise.all(ops)),
  },
}));

import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { GET, POST } from '@/app/api/shelter/claim/route';

const TOKEN = 'a'.repeat(64);
const PROFILE = {
  shelterId: 'shelter-1',
  claimedById: null,
  inviteToken: TOKEN,
  inviteEmail: 'director@happytails.org',
  inviteExpiresAt: new Date(Date.now() + 86400e3),
};
const SHELTER = { id: 'shelter-1', name: 'Happy Tails', city: 'Elgin', state: 'IL' };

const getReq = (token) => new Request(`http://localhost/api/shelter/claim?token=${token || ''}`);
const postReq = (token) => ({ json: async () => ({ token }) });

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: 'director-1', email: 'director@happytails.org' } });
  prisma.shelterProfile.findFirst.mockImplementation(async ({ where }) => {
    if (where.inviteToken === TOKEN) return { ...PROFILE };
    if (where.claimedById) return null; // caller manages nothing yet
    return null;
  });
  prisma.shelter.findUnique.mockResolvedValue(SHELTER);
  prisma.shelterProfile.update.mockResolvedValue({});
  prisma.shelter.update.mockResolvedValue({});
});

describe('GET /api/shelter/claim (preview)', () => {
  test('signed-out gets 401, garbage token 404', async () => {
    getServerSession.mockResolvedValue(null);
    expect((await GET(getReq(TOKEN))).status).toBe(401);

    getServerSession.mockResolvedValue({ user: { id: 'director-1' } });
    expect((await GET(getReq('nope'))).status).toBe(404);
  });

  test('a valid invite previews the shelter', async () => {
    const res = await GET(getReq(TOKEN));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.shelter.name).toBe('Happy Tails');
  });

  test('an expired invite reads as 410', async () => {
    prisma.shelterProfile.findFirst.mockImplementation(async ({ where }) =>
      where.inviteToken === TOKEN
        ? { ...PROFILE, inviteExpiresAt: new Date(Date.now() - 1000) }
        : null
    );
    expect((await GET(getReq(TOKEN))).status).toBe(410);
  });

  test('an already-claimed shelter reads as 409', async () => {
    prisma.shelterProfile.findFirst.mockImplementation(async ({ where }) =>
      where.inviteToken === TOKEN ? { ...PROFILE, claimedById: 'someone' } : null
    );
    expect((await GET(getReq(TOKEN))).status).toBe(409);
  });
});

describe('POST /api/shelter/claim (accept)', () => {
  test('accepting claims, activates + verifies, and burns the token', async () => {
    const res = await POST(postReq(TOKEN));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.shelter.id).toBe('shelter-1');

    expect(prisma.shelterProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shelterId: 'shelter-1' },
        data: expect.objectContaining({
          claimedById: 'director-1',
          inviteToken: null,
          inviteEmail: null,
          inviteExpiresAt: null,
        }),
      })
    );
    expect(prisma.shelter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'shelter-1' },
        data: { isActive: true, isVerified: true },
      })
    );
  });

  test('a user who already manages a shelter is refused', async () => {
    prisma.shelterProfile.findFirst.mockImplementation(async ({ where }) => {
      if (where.inviteToken === TOKEN) return { ...PROFILE };
      if (where.claimedById) return { shelterId: 'other-shelter' };
      return null;
    });
    const res = await POST(postReq(TOKEN));
    expect(res.status).toBe(400);
    expect(prisma.shelterProfile.update).not.toHaveBeenCalled();
  });
});
