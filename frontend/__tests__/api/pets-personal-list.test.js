/**
 * The hats stay apart on the personal pet list.
 *
 * A shelter's roster animals carry the claimer's user id in `ownerId`
 * (that person created the record), so a naive `where: { ownerId }` puts
 * the shelter's adoptable cat in its claimer's "My Pets" next to their own
 * dog. Roster animals belong to the shelter portal; personal surfaces must
 * exclude them. Adoption clears `managedByShelterId`, so an adopted animal
 * has to come BACK to the adopter's personal list.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logging', () => ({ logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    pet: { findMany: jest.fn() },
    petShare: { findMany: jest.fn() },
  },
}));

import fs from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { GET } from '@/app/api/pets/route';

const personalPet = {
  id: 'pet-own', name: 'Max', ownerId: 'claimer-1', managedByShelterId: null,
  photos: '[]', personality: '[]', cases: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { email: 'owner@shelter.org' } });
  prisma.user.findUnique.mockResolvedValue({ id: 'claimer-1', email: 'owner@shelter.org' });
  prisma.pet.findMany.mockResolvedValue([personalPet]);
  prisma.petShare.findMany.mockResolvedValue([]);
});

describe('GET /api/pets (personal list)', () => {
  test('roster animals are excluded at the query, not filtered after', async () => {
    const res = await GET({});
    expect(res.status).toBe(200);

    const where = prisma.pet.findMany.mock.calls[0][0].where;
    expect(where).toEqual(
      expect.objectContaining({ ownerId: 'claimer-1', managedByShelterId: null })
    );
  });

  test("the shelter claimer's own pets still come back", async () => {
    const res = await GET({});
    const body = await res.json();
    expect(body.pets).toHaveLength(1);
    expect(body.pets[0].name).toBe('Max');
  });

  test('an adopted animal returns to the personal list once the shelter link is cleared', async () => {
    // What transfer/[token] leaves behind: new owner, no shelter.
    prisma.pet.findMany.mockResolvedValue([
      personalPet,
      {
        id: 'pet-adopted', name: 'Clover', ownerId: 'claimer-1',
        managedByShelterId: null, shelterStatus: 'ADOPTED',
        photos: '[]', personality: '[]', cases: [],
      },
    ]);
    const res = await GET({});
    const body = await res.json();
    expect(body.pets.map((p) => p.name)).toEqual(['Max', 'Clover']);
  });
});

describe('the lost-report flow agrees with the picker', () => {
  /**
   * The wizard's pet picker is fed by GET /api/pets, so it stops offering
   * roster animals. The server that consumes `selectedPetId` must agree:
   * it not only reads the pet, it OVERWRITES name/microchip/photos with the
   * report's values, which would corrupt shelter intake data.
   */
  test('reports/create scopes selectedPetId to personal pets only', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'app/api/reports/create/route.js'),
      'utf8'
    );
    const lookup = source.slice(
      source.indexOf('if (selectedPetId)'),
      source.indexOf('Selected pet not found')
    );
    expect(lookup).toContain('ownerId: user.id');
    expect(lookup).toContain('managedByShelterId: null');
  });
});
