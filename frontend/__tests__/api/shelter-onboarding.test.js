/**
 * Shelter onboarding wizard plumbing:
 *  - a shelter application rides along with registration in ONE
 *    transaction (no account without its claim, no claim without its
 *    account), mirroring the Health Book pet ride-along
 *  - claiming an already-managed shelter is refused (409) and the
 *    whole signup rolls back
 *  - the public candidates endpoint exposes only directory fields plus
 *    a claimed flag
 *  - the signed-in request API accepts an unclaimed directory pick
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logging', () => ({ logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  renderBrandedEmail: jest.fn(() => '<html>mail</html>'),
}));
jest.mock('@/app/lib/config', () => ({ getEmailBaseUrl: () => 'https://reunitepets.org' }));
const mockWithRateLimitAsync = jest.fn();
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: (...args) => mockWithRateLimitAsync(...args),
  RateLimitPresets: { AUTH: 'AUTH', PUBLIC_WRITE: 'PUBLIC_WRITE' },
  rateLimitResponse: jest.fn(() => new Response('rate limited', { status: 429 })),
}));

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), create: jest.fn() },
    pet: { create: jest.fn() },
    petMedication: { create: jest.fn() },
    shelter: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    shelterProfile: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    shelterClaim: { findFirst: jest.fn(), create: jest.fn() },
    shelterMember: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { getServerSession } from 'next-auth';
import mockDb from '@/app/lib/prisma';
import { POST as register } from '@/app/api/auth/register/route';
import { GET as candidates } from '@/app/api/shelter/start/candidates/route';
import { POST as shelterRequest } from '@/app/api/shelter/request/route';

const SHELTER_REQUEST = {
  shelterName: 'Happy Tails Animal Shelter',
  city: 'Elgin',
  state: 'IL',
  shelterType: 'SHELTER',
  role: 'DIRECTOR',
  latitude: 42.04,
  longitude: -88.28,
};

function registerReq(extra = {}) {
  return {
    json: async () => ({
      firstName: 'Sam',
      email: 'sam@happytails.org',
      password: 'longenough1!',
      acceptedTerms: true,
      shelterRequest: SHELTER_REQUEST,
      ...extra,
    }),
  };
}

function candidatesReq(params) {
  return new Request(`http://localhost/api/shelter/start/candidates?${new URLSearchParams(params)}`);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWithRateLimitAsync.mockResolvedValue({ success: true });
  mockDb.user.findUnique.mockResolvedValue(null); // email not taken
  mockDb.user.create.mockResolvedValue({ id: 'user-1', email: 'sam@happytails.org', firstName: 'Sam' });
  mockDb.shelter.findFirst.mockResolvedValue(null);
  mockDb.shelter.findMany.mockResolvedValue([]);
  mockDb.shelter.create.mockImplementation(async ({ data }) => ({ id: 'shelter-1', ...data }));
  mockDb.shelterProfile.findUnique.mockResolvedValue(null);
  mockDb.shelterProfile.findMany.mockResolvedValue([]);
  mockDb.shelterClaim.create.mockResolvedValue({ id: 'claim-1', status: 'PENDING' });
  // The register route runs its work inside an interactive transaction;
  // executing the callback against the same mocks keeps atomicity
  // semantics observable (a throw inside rejects the whole call).
  mockDb.$transaction.mockImplementation(async (fn) => fn(mockDb));
});

describe('register with a shelter application riding along', () => {
  test('creates the user, the shelter, and the PENDING claim in one transaction', async () => {
    const res = await register(registerReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDb.$transaction).toHaveBeenCalled();
    expect(mockDb.shelter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Happy Tails Animal Shelter',
          city: 'Elgin',
          state: 'IL',
          latitude: 42.04,
          isActive: false,
        }),
      })
    );
    expect(mockDb.shelterClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          claimantId: 'user-1',
          status: 'PENDING',
          verificationMethod: 'ADMIN_REVIEW',
        }),
      })
    );
  });

  test('an invalid application is rejected BEFORE any account exists', async () => {
    const res = await register(registerReq({ shelterRequest: { city: 'Elgin', state: 'IL' } }));
    expect(res.status).toBe(400);
    expect(mockDb.user.create).not.toHaveBeenCalled();
    expect(mockDb.shelterClaim.create).not.toHaveBeenCalled();
  });

  test('picking an already-managed shelter fails with 409 and rolls everything back', async () => {
    mockDb.shelter.findUnique.mockResolvedValue({ id: 'shelter-9', name: 'Taken Shelter' });
    mockDb.shelterProfile.findUnique.mockResolvedValue({ claimedById: 'someone-else' });

    const res = await register(registerReq({
      shelterRequest: { ...SHELTER_REQUEST, existingShelterId: 'shelter-9' },
    }));
    expect(res.status).toBe(409);
    expect(mockDb.shelterClaim.create).not.toHaveBeenCalled();
  });

  test('plain registration without a shelter payload is untouched', async () => {
    const res = await register(registerReq({ shelterRequest: undefined }));
    expect(res.status).toBe(200);
    expect(mockDb.shelter.create).not.toHaveBeenCalled();
    expect(mockDb.shelterClaim.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/shelter/start/candidates', () => {
  test('short names return nothing and never hit the DB', async () => {
    const res = await candidates(candidatesReq({ name: 'ab' }));
    const body = await res.json();
    expect(body.candidates).toEqual([]);
    expect(mockDb.shelter.findMany).not.toHaveBeenCalled();
  });

  test('matches carry the claimed flag and only directory fields', async () => {
    mockDb.shelter.findMany.mockResolvedValue([
      { id: 's1', name: 'Austin Animal Center', address: '7201 Levander Loop', city: 'Austin', state: 'TX' },
      { id: 's2', name: 'Austin Pets Alive!', address: '', city: 'Austin', state: 'TX' },
    ]);
    mockDb.shelterProfile.findMany.mockResolvedValue([{ shelterId: 's1' }]);

    const res = await candidates(candidatesReq({ name: 'Austin', city: 'Austin', state: 'TX' }));
    const body = await res.json();
    expect(body.candidates).toHaveLength(2);
    expect(body.candidates[0]).toEqual({
      id: 's1', name: 'Austin Animal Center', address: '7201 Levander Loop',
      city: 'Austin', state: 'TX', claimed: true,
    });
    expect(body.candidates[1].claimed).toBe(false);
    // never leak operational fields
    expect(JSON.stringify(body)).not.toMatch(/apiKey|email|phone/);
  });
});

describe('POST /api/shelter/request with a directory pick', () => {
  beforeEach(() => {
    getServerSession.mockResolvedValue({ user: { email: 'sam@happytails.org' } });
    mockDb.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'sam@happytails.org' });
    mockDb.shelterClaim.findFirst.mockResolvedValue(null);
    mockDb.shelterProfile.findFirst.mockResolvedValue(null);
  });

  const req = (body) => ({ json: async () => body });

  test('an unclaimed directory shelter can be applied for directly', async () => {
    mockDb.shelter.findUnique.mockResolvedValue({ id: 's2', name: 'Austin Pets Alive!' });
    mockDb.shelterProfile.findUnique.mockResolvedValue(null);

    const res = await shelterRequest(req({ existingShelterId: 's2', role: 'DIRECTOR' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.claim.shelterName).toBe('Austin Pets Alive!');
    expect(mockDb.shelter.create).not.toHaveBeenCalled();
    expect(mockDb.shelterClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ shelterId: 's2' }) })
    );
  });

  test('an already-managed pick is refused with 409', async () => {
    mockDb.shelter.findUnique.mockResolvedValue({ id: 's1', name: 'Austin Animal Center' });
    mockDb.shelterProfile.findUnique.mockResolvedValue({ claimedById: 'someone-else' });

    const res = await shelterRequest(req({ existingShelterId: 's1' }));
    expect(res.status).toBe(409);
    expect(mockDb.shelterClaim.create).not.toHaveBeenCalled();
  });
});
