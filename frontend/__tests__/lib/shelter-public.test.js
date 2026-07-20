/**
 * Public shelter page data: only active AND claimed shelters get a page;
 * the animal list carries only adoptable, public-safe fields (no medical
 * data, no roster internals, no claimer identity).
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    shelter: { findUnique: jest.fn() },
    shelterProfile: { findUnique: jest.fn() },
    pet: { findMany: jest.fn() },
  },
}));

import prisma from '@/app/lib/prisma';
import { getPublicShelter } from '@/app/lib/shelterPublic';

const SHELTER = {
  id: 'shelter-1',
  name: 'Austin Animal Center',
  type: 'SHELTER',
  address: '7201 Levander Loop',
  city: 'Austin',
  state: 'TX',
  zipCode: '78702',
  phone: '512-555-0199',
  email: 'aac@x.org',
  website: 'https://example.org',
  isActive: true,
  isVerified: true,
};

const PROFILE = {
  about: 'We care for animals.',
  mission: 'Every animal deserves a home.',
  logoUrl: null,
  coverPhotoUrl: null,
  facebookUrl: null,
  instagramUrl: null,
  twitterUrl: null,
  claimedById: 'claimer-1',
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.shelter.findUnique.mockResolvedValue(SHELTER);
  prisma.shelterProfile.findUnique.mockResolvedValue(PROFILE);
  prisma.pet.findMany.mockResolvedValue([]);
});

describe('getPublicShelter', () => {
  test('an active, claimed shelter gets a page with its profile', async () => {
    const data = await getPublicShelter('shelter-1');
    expect(data.shelter.name).toBe('Austin Animal Center');
    expect(data.profile.mission).toBe('Every animal deserves a home.');
    // the claimer's identity never leaves
    expect(data.profile.claimedById).toBeUndefined();
  });

  test('an UNCLAIMED shelter has no page (null)', async () => {
    prisma.shelterProfile.findUnique.mockResolvedValue({ ...PROFILE, claimedById: null });
    expect(await getPublicShelter('shelter-1')).toBeNull();

    prisma.shelterProfile.findUnique.mockResolvedValue(null);
    expect(await getPublicShelter('shelter-1')).toBeNull();
  });

  test('an inactive shelter has no page (null)', async () => {
    prisma.shelter.findUnique.mockResolvedValue({ ...SHELTER, isActive: false });
    expect(await getPublicShelter('shelter-1')).toBeNull();
    expect(prisma.pet.findMany).not.toHaveBeenCalled();
  });

  test('the animal query serves only adoptable statuses and public fields', async () => {
    await getPublicShelter('shelter-1');
    const query = prisma.pet.findMany.mock.calls[0][0];
    expect(query.where).toEqual(
      expect.objectContaining({
        managedByShelterId: 'shelter-1',
        isDeleted: false,
        shelterStatus: { in: ['AVAILABLE', 'ADOPTION_PENDING'] },
      })
    );
    // no medical or roster internals in the public shape
    expect(query.select.medicalConditions).toBeUndefined();
    expect(query.select.microchipId).toBeUndefined();
    expect(query.select.intakeFoundAddress).toBeUndefined();
    expect(query.select.ownerId).toBeUndefined();
  });
});
