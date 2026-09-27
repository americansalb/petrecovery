/**
 * Town outlines for Rescue Forces: looked up in OpenStreetMap once
 * (app/lib/maps/townOutline.js), saved on the force (app/lib/forceOutlines.js),
 * and used to decide which pets are a force's to look for: inside the town
 * line or within a mile of it (areaCovers, app/lib/maps/forceArea.js).
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { rescueForce: { update: jest.fn(), findMany: jest.fn() } },
}));

import prisma from '@/app/lib/prisma';
import { sameTownName, pickOutline, lookupTownOutline } from '@/app/lib/maps/townOutline';
import { fillForceOutline, fillMissingOutlines } from '@/app/lib/forceOutlines';
import { areaCovers, milesOutside, outlineRings, EDGE_MILES } from '@/app/lib/maps/forceArea';

/** A square outline, `half` degrees from its middle each way, as GeoJSON. */
function square(lat, lng, half) {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lng - half, lat - half],
        [lng + half, lat - half],
        [lng + half, lat + half],
        [lng - half, lat + half],
        [lng - half, lat - half],
      ],
    ],
  };
}

const CLINTON = { lat: 41.844, lng: -90.188 };
const FORCE = { id: 'force-clinton', name: 'Clinton Pet Rescue', city: 'Clinton', country: 'US', centerLatitude: CLINTON.lat, centerLongitude: CLINTON.lng };

beforeEach(() => jest.clearAllMocks());

test('town names compare the way people write them', () => {
  expect(sameTownName('Saint Charles', 'St. Charles')).toBe(true);
  expect(sameTownName('Village of Carpentersville', 'Carpentersville')).toBe(true);
  expect(sameTownName('Harlem Township', 'Harlem Township')).toBe(true);
  expect(sameTownName('Ciudad de México', 'Mexico')).toBe(true);
  expect(sameTownName('Clinton County', 'Clinton')).toBe(false);
  expect(sameTownName('', '')).toBe(false);
});

describe('pickOutline', () => {
  const center = CLINTON;
  const result = (name, geojson) => ({ name, geojson });

  test("the town's own outline, not the county of the same name", () => {
    const county = square(center.lat, center.lng, 0.3);
    const town = square(center.lat, center.lng, 0.04);
    expect(pickOutline([result('Clinton County', county), result('Clinton', town)], { town: 'Clinton', center })).toBe(town);
  });

  test('of several outlines with the name, the smallest that holds the center (Heredia: city, canton, province)', () => {
    const province = square(center.lat, center.lng, 0.6);
    const canton = square(center.lat, center.lng, 0.1);
    const city = square(center.lat, center.lng, 0.02);
    expect(pickOutline([result('Clinton', province), result('Clinton', canton), result('Clinton', city)], { town: 'Clinton', center })).toBe(city);
  });

  test('a force whose center is just outside town limits still gets its town; one far away does not', () => {
    const nearby = square(center.lat + 0.05, center.lng, 0.02); // edge about 2 miles north
    expect(pickOutline([result('Clinton', nearby)], { town: 'Clinton', center })).toBe(nearby);
    const far = square(center.lat + 0.3, center.lng, 0.02); // about 19 miles away
    expect(pickOutline([result('Clinton', far)], { town: 'Clinton', center })).toBeNull();
  });

  test('never a point, and never something as wide as a state', () => {
    expect(pickOutline([result('Clinton', { type: 'Point', coordinates: [center.lng, center.lat] })], { town: 'Clinton', center })).toBeNull();
    expect(pickOutline([result('Clinton', square(center.lat, center.lng, 1.5))], { town: 'Clinton', center })).toBeNull();
  });
});

describe('lookupTownOutline', () => {
  const answer = (body, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 429, json: async () => body });

  test('searches the name inside a box around the force, and stops there when that finds the town', async () => {
    const town = square(CLINTON.lat, CLINTON.lng, 0.04);
    const fetchImpl = jest.fn(() => answer([{ name: 'Clinton', geojson: town }]));
    expect(await lookupTownOutline(FORCE, { fetchImpl, gapMs: 0 })).toBe(town);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('q')).toBe('Clinton');
    expect(url.searchParams.get('bounded')).toBe('1');
    expect(url.searchParams.get('polygon_geojson')).toBe('1');
    const [west, north, east, south] = url.searchParams.get('viewbox').split(',').map(Number);
    expect(west).toBeLessThan(CLINTON.lng);
    expect(east).toBeGreaterThan(CLINTON.lng);
    expect(south).toBeLessThan(CLINTON.lat);
    expect(north).toBeGreaterThan(CLINTON.lat);
    expect(fetchImpl.mock.calls[0][1].headers['User-Agent']).toMatch(/\S/);
  });

  test('then asks what the center is inside, and takes it only if it is the town', async () => {
    const town = square(CLINTON.lat, CLINTON.lng, 0.04);
    const fetchImpl = jest
      .fn()
      .mockImplementationOnce(() => answer([]))
      .mockImplementationOnce(() => answer({ name: 'Clinton', geojson: town }));
    expect(await lookupTownOutline(FORCE, { fetchImpl, gapMs: 0 })).toBe(town);
    expect(new URL(fetchImpl.mock.calls[1][0]).pathname).toBe('/reverse');

    const county = jest
      .fn()
      .mockImplementationOnce(() => answer([]))
      .mockImplementationOnce(() => answer({ name: 'Clinton County', geojson: square(CLINTON.lat, CLINTON.lng, 0.3) }));
    expect(await lookupTownOutline(FORCE, { fetchImpl: county, gapMs: 0 })).toBeNull();
  });

  test('no center to check against: no lookup; a refusal from OpenStreetMap is thrown, not taken as "no outline"', async () => {
    const fetchImpl = jest.fn();
    expect(await lookupTownOutline({ ...FORCE, centerLatitude: null }, { fetchImpl, gapMs: 0 })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();

    await expect(lookupTownOutline(FORCE, { fetchImpl: () => answer({}, false), gapMs: 0 })).rejects.toThrow(/429/);
  });
});

describe('saving outlines', () => {
  const NOW = new Date('2026-09-27T12:00:00Z');
  const town = square(CLINTON.lat, CLINTON.lng, 0.04);

  test('an outline is saved with the day it was looked up; no outline saves only the day', async () => {
    expect(await fillForceOutline(FORCE, { lookup: async () => town, now: NOW })).toBe('saved');
    expect(prisma.rescueForce.update).toHaveBeenLastCalledWith({
      where: { id: 'force-clinton' },
      data: { customBoundary: JSON.stringify(town), outlineCheckedAt: NOW },
    });

    expect(await fillForceOutline(FORCE, { lookup: async () => null, now: NOW })).toBe('none');
    expect(prisma.rescueForce.update).toHaveBeenLastCalledWith({ where: { id: 'force-clinton' }, data: { outlineCheckedAt: NOW } });
  });

  test('when OpenStreetMap cannot be reached, nothing is saved, so the force is tried again', async () => {
    const lookup = async () => {
      throw new Error('Nominatim answered 429');
    };
    expect(await fillForceOutline(FORCE, { lookup, now: NOW })).toBe('failed');
    expect(prisma.rescueForce.update).not.toHaveBeenCalled();
  });

  test('a batch takes forces with no outline, not looked up in 30 days, and stops at the first failure', async () => {
    const forces = ['a', 'b', 'c', 'd'].map((id) => ({ ...FORCE, id, name: id }));
    prisma.rescueForce.findMany.mockResolvedValue(forces);
    const lookup = jest
      .fn()
      .mockResolvedValueOnce(town)
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(town);

    expect(await fillMissingOutlines({ lookup, now: NOW })).toEqual({ checked: 2, saved: 1 });
    expect(lookup).toHaveBeenCalledTimes(3);
    const { where } = prisma.rescueForce.findMany.mock.calls[0][0];
    expect(where).toMatchObject({ isDeleted: false, customBoundary: null, centerLatitude: { not: null } });
    expect(where.OR).toEqual([{ outlineCheckedAt: null }, { outlineCheckedAt: { lt: new Date(NOW.getTime() - 30 * 24 * 3600e3) } }]);
  });
});

describe('which pets are a force\'s: inside the town line or within a mile of it', () => {
  // A town about 2.8 miles across, as the directory and report routing hold it.
  const area = outlineRings(square(CLINTON.lat, CLINTON.lng, 0.02));
  const force = { area, lat: CLINTON.lat, lng: CLINTON.lng, radiusMiles: 5 };
  const north = (miles) => ({ lat: CLINTON.lat + 0.02 + miles / 69, lng: CLINTON.lng });

  test('inside, just over the line, and too far past it', () => {
    expect(milesOutside(area, CLINTON)).toBe(0);
    expect(milesOutside(area, north(0.5))).toBeCloseTo(0.5, 1);
    expect(areaCovers(force, CLINTON)).toBe(true);
    expect(areaCovers(force, north(0.8))).toBe(true);
    // Inside the old 5-mile circle, but two miles past the town line.
    expect(areaCovers(force, north(2))).toBe(false);
    expect(EDGE_MILES).toBe(1);
  });

  test('a force with no outline yet: its circle plus the same mile', () => {
    const circle = { area: null, lat: CLINTON.lat, lng: CLINTON.lng, radiusMiles: 5 };
    const fromCenter = (miles) => ({ lat: CLINTON.lat + miles / 69, lng: CLINTON.lng });
    expect(areaCovers(circle, fromCenter(5.5))).toBe(true);
    expect(areaCovers(circle, fromCenter(6.5))).toBe(false);
  });
});
