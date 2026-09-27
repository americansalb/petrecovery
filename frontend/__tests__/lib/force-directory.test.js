/**
 * The Rescue Forces directory's data (app/lib/forceDirectory.js) and the
 * area geometry it draws with (app/lib/maps/forceArea.js).
 *
 * Town outlines stored from OpenStreetMap run to thousands of points, so
 * the directory sends a thinned copy and reads the raw text again only
 * when a force changes. "Missing" counts lost pets only: a found-pet
 * report assigned to a force is not a missing pet.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { rescueForce: { findMany: jest.fn() } },
}));

import prisma from '@/app/lib/prisma';
import { getForceDirectory, clearForceAreaCache } from '@/app/lib/forceDirectory';
import { simplifyArea, areaContains, areaCenter, milesBetween } from '@/app/lib/maps/forceArea';

/** A closed ring of `n` points around a center, in GeoJSON [lng, lat] order. */
function circleRing(lng, lat, radiusDeg, n) {
  const ring = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    ring.push([lng + radiusDeg * Math.cos(a), lat + radiusDeg * Math.sin(a) * 0.9]);
  }
  ring.push(ring[0]);
  return ring;
}

const AUSTIN = { lat: 30.2672, lng: -97.7431 };
const SQUARE = { type: 'Polygon', coordinates: [[[-98, 30], [-97, 30], [-97, 31], [-98, 31], [-98, 30]]] };

describe('simplifyArea', () => {
  test('a detailed outline comes back small, closed, rounded, and as [lat, lng]', () => {
    const raw = JSON.stringify({ type: 'Polygon', coordinates: [circleRing(AUSTIN.lng, AUSTIN.lat, 0.15, 5000)] });
    expect(raw.length).toBeGreaterThan(100000);

    const area = simplifyArea(raw);
    expect(area).toHaveLength(1);
    const ring = area[0];
    expect(ring.length).toBeGreaterThanOrEqual(4);
    expect(ring.length).toBeLessThanOrEqual(160);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    for (const [lat, lng] of ring) {
      expect(lat).toBeGreaterThan(30);
      expect(lat).toBeLessThan(30.5);
      expect(lng).toBeLessThan(-97.5);
      expect(Math.round(lat * 1e4) / 1e4).toBe(lat);
    }
    expect(JSON.stringify(area).length).toBeLessThan(4000);
  });

  test('a town of many islands keeps its twelve largest', () => {
    const islands = Array.from({ length: 30 }, (_, i) => [circleRing(-80 + i * 0.1, 25, 0.01 + i * 0.001, 12)]);
    const area = simplifyArea({ type: 'MultiPolygon', coordinates: islands });
    expect(area).toHaveLength(12);
    // The largest island (the last one made) is kept.
    const lngs = area.flat().map(([, lng]) => lng);
    expect(Math.max(...lngs)).toBeGreaterThan(-80 + 29 * 0.1);
  });

  test('holes are dropped and a Feature wrapper is accepted', () => {
    const withHole = {
      type: 'Feature',
      geometry: { ...SQUARE, coordinates: [SQUARE.coordinates[0], [[-97.6, 30.4], [-97.4, 30.4], [-97.4, 30.6], [-97.6, 30.4]]] },
    };
    expect(simplifyArea(withHole)).toEqual([[[30, -98], [30, -97], [31, -97], [31, -98], [30, -98]]]);
  });

  test('nothing usable gives null', () => {
    expect(simplifyArea(null)).toBeNull();
    expect(simplifyArea('')).toBeNull();
    expect(simplifyArea('{not json')).toBeNull();
    expect(simplifyArea({ type: 'Point', coordinates: [-97, 30] })).toBeNull();
    expect(simplifyArea({ type: 'Polygon', coordinates: [[[-97, 30], ['x', 30], [-97, 31], [-97, 30]]] })).toBeNull();
  });
});

describe('areaContains', () => {
  const square = { area: simplifyArea(SQUARE) };

  test('an outline decides when there is one', () => {
    expect(areaContains(square, { lat: 30.5, lng: -97.5 })).toBe(true);
    expect(areaContains(square, { lat: 31.5, lng: -97.5 })).toBe(false);
    expect(areaContains(square, null)).toBe(false);
  });

  test('otherwise the circle around the center', () => {
    const force = { area: null, lat: AUSTIN.lat, lng: AUSTIN.lng, radiusMiles: 15 };
    expect(areaContains(force, { lat: 30.35, lng: -97.74 })).toBe(true); // about 6 miles north
    expect(areaContains(force, { lat: 30.5083, lng: -97.6789 })).toBe(false); // Round Rock, about 17 miles
    expect(areaContains({ area: null, lat: null, lng: null }, AUSTIN)).toBe(false);
  });

  test('miles and the middle of an outline', () => {
    expect(milesBetween(AUSTIN, { lat: 30.5083, lng: -97.6789 })).toBeCloseTo(17.1, 0);
    expect(areaCenter(square.area)).toEqual({ lat: 30.5, lng: -97.5 });
    expect(areaCenter(null)).toBeNull();
  });
});

describe('getForceDirectory', () => {
  const STAMP = new Date('2026-09-01T00:00:00Z');
  const row = (over = {}) => ({
    id: 'force-austin',
    name: 'Austin Rescue Force',
    city: 'Austin',
    state: 'TX',
    centerLatitude: AUSTIN.lat,
    centerLongitude: AUSTIN.lng,
    radiusMiles: 15,
    updatedAt: STAMP,
    _count: { members: 12 },
    caseAssignments: [
      { case: { petName: 'Max', petPhotoUrl: 'https://cdn.example/max.jpg' } },
      { case: { petName: 'Luna', petPhotoUrl: '' } },
      { case: { petName: 'Rocket', petPhotoUrl: 'https://cdn.example/rocket.jpg' } },
      { case: { petName: 'Biscuit', petPhotoUrl: 'https://cdn.example/biscuit.jpg' } },
    ],
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    clearForceAreaCache();
  });

  // The first findMany is the forces; the second, when it happens, the outlines.
  function answer(rows, outlines = []) {
    prisma.rescueForce.findMany.mockImplementation(async (args) => (args.select.customBoundary ? outlines : rows));
  }

  test('counts open lost reports only, and shows up to three of them', async () => {
    answer([row()]);
    const [force] = await getForceDirectory();

    const where = prisma.rescueForce.findMany.mock.calls[0][0].select.caseAssignments.where;
    expect(where.case).toMatchObject({ reportType: 'LOST', status: { in: ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'] } });

    expect(force).toMatchObject({
      id: 'force-austin',
      place: 'Austin, TX',
      members: 12,
      missing: 4,
      lat: AUSTIN.lat,
      lng: AUSTIN.lng,
      radiusMiles: 15,
      area: null,
    });
    expect(force.pets).toEqual([
      { name: 'Max', photo: 'https://cdn.example/max.jpg' },
      { name: 'Luna', photo: null },
      { name: 'Rocket', photo: 'https://cdn.example/rocket.jpg' },
    ]);
  });

  test('an outline is read once, and again only after its force changes', async () => {
    const outline = [{ id: 'force-austin', customBoundary: JSON.stringify(SQUARE) }];
    answer([row()], outline);

    const [first] = await getForceDirectory();
    expect(first.area).toEqual([[[30, -98], [30, -97], [31, -97], [31, -98], [30, -98]]]);
    expect(prisma.rescueForce.findMany).toHaveBeenCalledTimes(2);

    const [second] = await getForceDirectory();
    expect(second.area).toEqual(first.area);
    expect(prisma.rescueForce.findMany).toHaveBeenCalledTimes(3); // the forces only

    answer([row({ updatedAt: new Date('2026-09-02T00:00:00Z') })], outline);
    await getForceDirectory();
    expect(prisma.rescueForce.findMany).toHaveBeenCalledTimes(5); // forces, then the changed outline
    expect(prisma.rescueForce.findMany.mock.calls[4][0].where.id).toEqual({ in: ['force-austin'] });
  });

  test('a force stored without a center is placed at the middle of its outline', async () => {
    answer([row({ centerLatitude: null, centerLongitude: null })], [{ id: 'force-austin', customBoundary: JSON.stringify(SQUARE) }]);
    const [force] = await getForceDirectory();
    expect(force).toMatchObject({ lat: 30.5, lng: -97.5 });
  });

  test('busiest first, and null when the database read fails', async () => {
    answer([
      row({ id: 'a', name: 'Quiet Rescue Force', _count: { members: 2 }, caseAssignments: [] }),
      row({ id: 'b', name: 'Busy Rescue Force', _count: { members: 9 } }),
    ]);
    expect((await getForceDirectory()).map((f) => f.id)).toEqual(['b', 'a']);

    jest.spyOn(console, 'error').mockImplementation(() => {});
    prisma.rescueForce.findMany.mockRejectedValue(new Error('down'));
    expect(await getForceDirectory()).toBeNull();
    console.error.mockRestore();
  });
});
