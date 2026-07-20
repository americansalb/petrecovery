/**
 * Public-page editor API: any team member may edit; strangers may not;
 * image URLs must live on our CDN host (no javascript:, no third-party
 * hosts); social links are domain-checked; length caps apply.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logging', () => ({ logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    shelterProfile: { findFirst: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() },
    shelterMember: { findFirst: jest.fn() },
  },
}));

import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { PATCH } from '@/app/api/shelter/profile/route';

const ALLOWED_HOST = 'cdn.example.com';

const req = (body) => ({ json: async () => body });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.AI_IMAGE_HOST_ALLOWLIST = ALLOWED_HOST;
  getServerSession.mockResolvedValue({ user: { id: 'claimer-1', email: 'owner@shelter.org' } });
  prisma.shelterProfile.findFirst.mockResolvedValue({ shelterId: 'shelter-1' });
  prisma.shelterMember.findFirst.mockResolvedValue(null);
  prisma.shelterProfile.upsert.mockResolvedValue({});
});

afterEach(() => {
  delete process.env.AI_IMAGE_HOST_ALLOWLIST;
});

describe('PATCH /api/shelter/profile', () => {
  test('a team member saves mission/about with caps applied', async () => {
    const res = await PATCH(req({ mission: '  Save them all  ', about: 'x'.repeat(5000) }));
    expect(res.status).toBe(200);
    const { update } = prisma.shelterProfile.upsert.mock.calls[0][0];
    expect(update.mission).toBe('Save them all');
    expect(update.about).toHaveLength(4000);
  });

  test('a stranger is refused', async () => {
    prisma.shelterProfile.findFirst.mockResolvedValue(null);
    prisma.shelterMember.findFirst.mockResolvedValue(null);
    const res = await PATCH(req({ mission: 'hi' }));
    expect(res.status).toBe(403);
    expect(prisma.shelterProfile.upsert).not.toHaveBeenCalled();
  });

  test('images must be https on our CDN host', async () => {
    const ok = await PATCH(req({ logoUrl: `https://${ALLOWED_HOST}/logo.png` }));
    expect(ok.status).toBe(200);

    expect((await PATCH(req({ logoUrl: 'javascript:alert(1)' }))).status).toBe(400);
    expect((await PATCH(req({ logoUrl: 'https://evil.example.com/x.png' }))).status).toBe(400);
    expect((await PATCH(req({ coverPhotoUrl: 'http://cdn.example.com/x.png' }))).status).toBe(400);
  });

  test('social links are domain-checked; clearing with empty string works', async () => {
    expect((await PATCH(req({ facebookUrl: 'https://facebook.com/paws' }))).status).toBe(200);
    expect((await PATCH(req({ facebookUrl: 'https://evil.com/paws' }))).status).toBe(400);
    expect((await PATCH(req({ twitterUrl: 'https://x.com/paws' }))).status).toBe(200);

    const res = await PATCH(req({ facebookUrl: '' }));
    expect(res.status).toBe(200);
    const { update } = prisma.shelterProfile.upsert.mock.calls.at(-1)[0];
    expect(update.facebookUrl).toBeNull();
  });

  test('an empty body is a 400', async () => {
    expect((await PATCH(req({}))).status).toBe(400);
  });
});
