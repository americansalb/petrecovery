/**
 * /api/rescue-forces and the forces created automatically from reports.
 *
 * When a pet is reported somewhere with no Rescue Force, the report route
 * creates "{Town} Pet Rescue". Those were stored without a state (19 of the
 * first 21 forces in production), and two things went wrong:
 *
 *   - the search required a state, so it never listed them: "Portland"
 *     answered "no Rescue Force" while Portland Pet Rescue had 4 members;
 *   - creating a force looked for an exact town-and-state match, so a second
 *     force could be made for the same town (Carpentersville has two).
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    rescueForce: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    rescueForceMember: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    case: { findMany: jest.fn() },
    caseAssignment: { create: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/cities', () => ({ __esModule: true, getCitiesByZip: jest.fn(() => []), getCityByName: jest.fn(() => null) }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { GET, POST } from '@/app/api/rescue-forces/route';

// Portland, Oregon, and a force created from a report there: no state.
const PORTLAND = { lat: 45.5152, lng: -122.6784 };
const AUTO_FORCE = {
  id: 'force-portland',
  name: 'Portland Pet Rescue',
  city: 'Portland',
  state: null,
  country: 'CA', // the search below takes the coordinates path, which filters by country
  centerLatitude: 45.52,
  centerLongitude: -122.68,
  radiusMiles: 5,
  totalMissionsAccepted: 0,
  successfulReunions: 0,
  members: [],
  divisions: [],
  _count: { members: 4 },
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => [] });
});

test('the search lists a force that has no state', async () => {
  getServerSession.mockResolvedValue(null);
  prisma.rescueForce.findMany.mockResolvedValue([AUTO_FORCE]);

  const res = await GET(new Request(`http://localhost/api/rescue-forces?search=Portland&country=CA&lat=${PORTLAND.lat}&lng=${PORTLAND.lng}&radius=25`));
  expect(res.status).toBe(200);
  const body = await res.json();
  const found = body.cities.filter((row) => row.exists && row.squad);
  expect(found).toHaveLength(1);
  expect(found[0].squad).toMatchObject({ id: 'force-portland', name: 'Portland Pet Rescue', memberCount: 4 });
});

test('a force far away is still left out', async () => {
  getServerSession.mockResolvedValue(null);
  prisma.rescueForce.findMany.mockResolvedValue([{ ...AUTO_FORCE, centerLatitude: 43.66, centerLongitude: -70.26 }]); // Portland, Maine

  const res = await GET(new Request(`http://localhost/api/rescue-forces?search=Portland&country=CA&lat=${PORTLAND.lat}&lng=${PORTLAND.lng}&radius=25`));
  const body = await res.json();
  expect(body.cities.filter((row) => row.exists)).toHaveLength(0);
});

describe('creating a force where one was created without a state', () => {
  beforeEach(() => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', waiverAcceptedAt: new Date(), waiverVersionAccepted: '1.0' });
    prisma.rescueForce.findFirst.mockResolvedValue(null); // no exact town + state match
  });

  const create = () =>
    POST(
      new Request('http://localhost/api/rescue-forces', {
        method: 'POST',
        body: JSON.stringify({ city: 'Portland', state: 'OR', country: 'US', lat: PORTLAND.lat, lng: PORTLAND.lng }),
      })
    );

  test('the same town nearby counts as already having a force', async () => {
    prisma.rescueForce.findMany.mockResolvedValue([{ ...AUTO_FORCE, country: 'US' }]);

    const res = await create();
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'FORCE_EXISTS', existingForceId: 'force-portland' });
    expect(prisma.rescueForce.create).not.toHaveBeenCalled();

    // Matched by town name without a state, then by distance.
    const where = prisma.rescueForce.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ city: { equals: 'Portland', mode: 'insensitive' }, state: null, isDeleted: false });
  });

  test('a same-named town far away does not block a new force', async () => {
    prisma.rescueForce.findMany
      .mockResolvedValueOnce([{ ...AUTO_FORCE, country: 'US', centerLatitude: 43.66, centerLongitude: -70.26 }]) // Portland, Maine
      .mockResolvedValue([]);
    prisma.rescueForce.create.mockResolvedValue({ id: 'force-new', name: 'Portland Rescue Force', radiusMiles: 10, centerLatitude: PORTLAND.lat, centerLongitude: PORTLAND.lng });
    prisma.case.findMany.mockResolvedValue([]);
    prisma.user.update.mockResolvedValue({});

    const res = await create();
    expect(res.status).toBe(201);
    expect(prisma.rescueForce.create).toHaveBeenCalled();
  });
});
