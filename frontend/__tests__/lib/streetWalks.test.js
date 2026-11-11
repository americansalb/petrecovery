/**
 * The search board is streets, not squares (app/lib/streetWalks.js).
 *
 * A helper is handed "Sinclair Ave from W 40th St to W 44th St", a thing
 * they can find and walk, not "C4". These tests run the builder on a
 * small made-up grid, where every answer can be checked by hand, and on
 * the real streets around Sinclair Ave and W 44th St in Austin
 * (fixtures/rosedale-streets.json), where the map is messy: streets split
 * into several ways, divided roads, courts and dead ends.
 */

import { buildWalks, shortStreet, walkTitle, walkMinutes, orientWalk, MAX_WALKS, WALK_TARGET_METERS } from '@/app/lib/streetWalks';
import { distanceMeters } from '@/app/lib/searchGrid';

const rosedale = require('../fixtures/rosedale-streets.json');

describe('shortStreet', () => {
  test('writes a name the way a street sign does', () => {
    expect(shortStreet('West 45th Street')).toBe('W 45th St');
    expect(shortStreet('Shoal Creek Boulevard')).toBe('Shoal Creek Blvd');
    expect(shortStreet('North Lamar Boulevard')).toBe('N Lamar Blvd');
    expect(shortStreet('Medical Parkway')).toBe('Medical Pkwy');
  });

  test('leaves alone what is not a suffix or a leading compass word', () => {
    expect(shortStreet('Avenue A')).toBe('Avenue A');
    expect(shortStreet('West Avenue')).toBe('West Ave');
    expect(shortStreet('Old West 38th Street')).toBe('Old West 38th St');
    expect(shortStreet('Petes Path')).toBe('Petes Path');
    expect(shortStreet('Rue de Rivoli')).toBe('Rue de Rivoli');
    expect(shortStreet('Broadway')).toBe('Broadway');
    expect(shortStreet('')).toBe('');
  });
});

describe('walkTitle and walkMinutes', () => {
  test('names the street and both ends', () => {
    expect(walkTitle({ name: 'Sinclair Ave', fromName: 'W 40th St', toName: 'W 44th St' })).toBe('Sinclair Ave from W 40th St to W 44th St');
    expect(walkTitle({ name: 'Edendale Ct', fromName: 'W 45th St', toName: null })).toBe('Edendale Ct from W 45th St to the end');
    expect(walkTitle({ name: 'Edendale Ct', fromName: null, toName: 'W 45th St' })).toBe('Edendale Ct from W 45th St to the end');
    expect(walkTitle({ name: 'Unity Cir', fromName: 'Freedom Dr', toName: 'Freedom Dr' })).toBe('Unity Cir off Freedom Dr');
    expect(walkTitle({ name: 'Petes Path' })).toBe('Petes Path');
  });

  test('minutes are there and back, to the nearest five, never under ten', () => {
    expect(walkMinutes(60)).toBe(10);
    expect(walkMinutes(450)).toBe(15);
    expect(walkMinutes(972)).toBe(30);
    expect(walkMinutes(0)).toBe(10);
  });
});

describe('orientWalk', () => {
  const walk = { name: 'Main St', fromName: 'A St', toName: 'B St', path: [[30, -97], [30.004, -97]] };

  test('starts from the end nearer the person', () => {
    const far = orientWalk(walk, { lat: 30.005, lng: -97 });
    expect(far.fromName).toBe('B St');
    expect(far.toName).toBe('A St');
    expect(far.path[0]).toEqual([30.004, -97]);
    expect(orientWalk(walk, { lat: 29.999, lng: -97 })).toBe(walk);
  });

  test('is unchanged without a position', () => {
    expect(orientWalk(walk, null)).toBe(walk);
  });
});

/**
 * A made-up neighbourhood: Main Street runs north for 750 m and is met by
 * First, Second and Third Street every 250 m, then by a motorway. Each
 * cross street runs 100 m either side. Node ids are spelled out so the
 * shared ones are obvious.
 */
function grid() {
  const lat = (m) => 30 + m / 111320;
  const lng = (m) => -97 + m / (111320 * Math.cos((30 * Math.PI) / 180));
  const way = (id, name, highway, nodes) => ({
    type: 'way',
    id,
    nodes: nodes.map((n) => n[0]),
    geometry: nodes.map((n) => ({ lat: lat(n[2]), lon: lng(n[1]) })),
    tags: { name, highway },
  });
  return [
    // Main Street, in two ways as the map would have it
    way(1, 'Main Street', 'residential', [[100, 0, 0], [101, 0, 250], [102, 0, 500]]),
    way(2, 'Main Street', 'residential', [[102, 0, 500], [103, 0, 750]]),
    way(3, 'First Street', 'residential', [[200, -100, 0], [100, 0, 0], [201, 100, 0]]),
    way(4, 'Second Street', 'residential', [[210, -100, 250], [101, 0, 250], [211, 100, 250]]),
    way(5, 'Third Street', 'residential', [[220, -100, 500], [102, 0, 500], [221, 100, 500]]),
    // A motorway crossing the top: named, so it names an end, but nobody walks it
    way(6, 'Interstate 35', 'motorway', [[230, -100, 750], [103, 0, 750], [231, 100, 750]]),
    // A way with no name is not on the board
    { type: 'way', id: 7, nodes: [300, 301], geometry: [{ lat: lat(50), lon: lng(50) }, { lat: lat(150), lon: lng(50) }], tags: { highway: 'service' } },
  ];
}

describe('buildWalks on a made-up grid', () => {
  const center = { lat: 30 + 375 / 111320, lng: -97 };
  const walks = buildWalks({ ways: grid(), center, radiusMeters: 800 });
  const titles = walks.map(walkTitle);

  test('joins the pieces of one street and cuts it at cross streets', () => {
    // 750 m of Main Street, drawn as two ways: the first walk closes at
    // Third Street, 500 m, the first cross street past the target. The
    // last 250 m is a walk of its own, ending at the road above.
    expect(titles).toContain('Main St from First St to Third St');
    expect(titles).toContain('Main St from Third St to Interstate 35');
    const main = walks.find((w) => walkTitle(w) === 'Main St from First St to Third St');
    expect(main.meters).toBeGreaterThan(495);
    expect(main.meters).toBeLessThan(505);
    expect(main.minutes).toBe(20);
  });

  test('a cross street is one walk through the corner, named by its ends', () => {
    // Second Street has a dead end either side of Main Street.
    expect(titles).toContain('Second St');
    const second = walks.find((w) => w.name === 'Second St');
    expect(second.meters).toBeGreaterThan(195);
    expect(second.meters).toBeLessThan(205);
  });

  test('nobody is sent to walk a motorway or a road with no name', () => {
    expect(walks.some((w) => w.name === 'Interstate 35')).toBe(false);
    expect(walks.every((w) => w.name)).toBe(true);
  });

  test('every walk carries a line, a centre and a priority', () => {
    for (const w of walks) {
      expect(w.path.length).toBeGreaterThanOrEqual(2);
      expect(Number.isFinite(w.centerLatitude)).toBe(true);
      expect(Number.isFinite(w.centerLongitude)).toBe(true);
      expect(w.priority).toBeGreaterThanOrEqual(1);
      expect(w.priority).toBeLessThanOrEqual(10);
    }
  });

  test('most urgent first: nearest where the pet was lost', () => {
    const priorities = walks.map((w) => w.priority);
    expect([...priorities].sort((a, b) => b - a)).toEqual(priorities);
  });

  test('a fresh sighting raises the street beside it', () => {
    const far = { lat: 30 + 650 / 111320, lng: -97 };
    const quiet = buildWalks({ ways: grid(), center: { lat: 30, lng: -97 }, radiusMeters: 800 });
    const seen = buildWalks({ ways: grid(), center: { lat: 30, lng: -97 }, radiusMeters: 800, sightings: [{ lat: far.lat, lng: far.lng, at: new Date() }] });
    const top = (list) => list.find((w) => walkTitle(w) === 'Main St from Third St to Interstate 35').priority;
    expect(top(seen)).toBeGreaterThan(top(quiet));
  });

  test('keeps only streets inside the board', () => {
    const near = buildWalks({ ways: grid(), center: { lat: 30, lng: -97 }, radiusMeters: 150 });
    expect(near.map((w) => w.name)).toEqual(expect.arrayContaining(['First St']));
    expect(near.some((w) => w.name === 'Third St')).toBe(false);
  });

  test('nothing to work with is an empty board, not an error', () => {
    expect(buildWalks({ ways: [], center, radiusMeters: 800 })).toEqual([]);
    expect(buildWalks({ ways: [{ type: 'way', id: 1 }], center, radiusMeters: 800 })).toEqual([]);
    expect(buildWalks({ ways: grid(), center: null, radiusMeters: 800 })).toEqual([]);
  });
});

describe('buildWalks on real streets (Rosedale, Austin)', () => {
  const center = rosedale.center;
  const walks = buildWalks({ ways: rosedale.elements, center, radiusMeters: 500 });
  const titles = walks.map(walkTitle);

  test('hands out the streets a neighbor would name', () => {
    expect(titles).toContain('Sinclair Ave from W 40th St to W 44th St');
    expect(titles).toContain('Ramsey Ave from W 40th St to W 44th St');
    expect(titles).toContain('Shoalwood Ave from W 42nd St to W 46th St');
    expect(titles.some((t) => t.startsWith('Shoal Creek Blvd from ') && t.includes('W 41st St'))).toBe(true);
  });

  test('is a board a search party can finish', () => {
    expect(walks.length).toBeGreaterThan(15);
    expect(walks.length).toBeLessThanOrEqual(MAX_WALKS);
  });

  test('every walk is inside the board and long enough to be a walk', () => {
    for (const w of walks) {
      expect(distanceMeters({ lat: w.centerLatitude, lng: w.centerLongitude }, center)).toBeLessThanOrEqual(500);
      expect(w.meters).toBeGreaterThanOrEqual(40);
    }
  });

  test('a street is cut where the next cross street passes the target, not into slivers', () => {
    const long = walks.filter((w) => w.meters > WALK_TARGET_METERS * 2.5);
    // Only a road with almost no cross streets runs long (Shoal Creek Blvd beside the creek).
    expect(long.length).toBeLessThanOrEqual(2);
  });

  test('no walk is listed twice', () => {
    expect(new Set(titles.map((t, i) => `${t}@${walks[i].centerLatitude},${walks[i].centerLongitude}`)).size).toBe(walks.length);
    // Burnet Rd is a divided road on the map: two lines, one name, one walk per stretch.
    const burnet = walks.filter((w) => w.name === 'Burnet Rd').map(walkTitle);
    expect(new Set(burnet).size).toBe(burnet.length);
  });

  test('the same streets every time', () => {
    const again = buildWalks({ ways: [...rosedale.elements].reverse(), center, radiusMeters: 500 });
    expect(again.map(walkTitle)).toEqual(titles);
  });

  test('the whole board is small enough to send to a phone', () => {
    expect(JSON.stringify(walks).length).toBeLessThan(40000);
  });
});
