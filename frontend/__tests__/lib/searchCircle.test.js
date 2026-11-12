/**
 * The search as a circle of ground (app/lib/searchCircle.js).
 *
 * The board used to hand out streets and count streets walked. A pet does
 * not keep to streets, so the search is a circle around where the pet was
 * lost, cut into areas of ground: the middle, four sides, and eight more
 * once it is widened. These tests hold the geometry to that, and hold the
 * time an area takes to its size and not to the streets in it.
 */
import {
  CIRCLES, DEFAULT_CIRCLE, SEEN_RADIUS_METERS, MINUTES_PER_HECTARE,
  circleFor, areasOf, inArea, areaAt, hectaresOf, minutesFor, pointAt, outlineOf, heartOf, reachOf, landmarksIn, urgencyOf, planCircle,
} from '@/app/lib/searchCircle';
import { distanceMeters } from '@/app/lib/searchGrid';

const LOST = { lat: 30.3148, lng: -97.7459 };
const DOG = CIRCLES.DOG;
const at = (meters, bearing) => pointAt(LOST, meters, bearing);

describe('how big the circle is', () => {
  test('a dog starts at 400 m and widens to 800 m; a cat starts at 150 m and widens to 500 m', () => {
    expect(circleFor('DOG')).toEqual({ inner: 150, edge: 400, wide: 800 });
    expect(circleFor('cat')).toEqual({ inner: 50, edge: 150, wide: 500 });
  });

  test('any other animal, or none named, is searched for like a dog', () => {
    expect(circleFor('RABBIT')).toBe(DEFAULT_CIRCLE);
    expect(circleFor(null)).toBe(DEFAULT_CIRCLE);
    expect(DEFAULT_CIRCLE).toBe(CIRCLES.DOG);
  });

  test('the sizes cannot be changed by a caller', () => {
    expect(Object.isFrozen(CIRCLES)).toBe(true);
    expect(Object.isFrozen(CIRCLES.DOG)).toBe(true);
    expect(SEEN_RADIUS_METERS).toBe(150);
  });
});

describe('the areas', () => {
  test('five to start: the middle and four sides', () => {
    const areas = areasOf(DOG);
    expect(areas.map((a) => a.key)).toEqual(['middle', 'north', 'east', 'south', 'west']);
    expect(areas.map((a) => a.name)).toEqual(['The middle', 'North side', 'East side', 'South side', 'West side']);
    expect(areas[0]).toMatchObject({ ring: 0, from: 0, to: 150 });
    expect(areas[1]).toMatchObject({ ring: 1, from: 150, to: 400, a: 315, b: 45 });
  });

  test('widened: eight more, out to 800 m', () => {
    const areas = areasOf(DOG, { widened: true });
    expect(areas).toHaveLength(13);
    const outer = areas.filter((a) => a.ring === 2);
    expect(outer.map((a) => a.name)).toEqual(['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west']);
    expect(outer.every((a) => a.from === 400 && a.to === 800)).toBe(true);
  });

  test('together they are the whole circle and nothing twice', () => {
    for (const widened of [false, true]) {
      const areas = areasOf(DOG, { widened });
      const radius = widened ? DOG.wide : DOG.edge;
      const total = areas.reduce((sum, a) => sum + hectaresOf(a), 0);
      expect(total).toBeCloseTo((Math.PI * radius * radius) / 10000, 6);
      // Every point in the circle is in exactly one area.
      for (let meters = 5; meters < radius; meters += 37) {
        for (let bearing = 0; bearing < 360; bearing += 7.5) {
          const hits = areas.filter((a) => inArea(at(meters, bearing), LOST, a));
          expect(hits).toHaveLength(1);
        }
      }
    }
  });
});

describe('which area a place is in', () => {
  test.each([
    [60, 10, 'middle'], [149, 200, 'middle'],
    [300, 0, 'north'], [300, 44, 'north'], [300, 316, 'north'],
    [300, 90, 'east'], [200, 46, 'east'],
    [300, 180, 'south'], [399, 224, 'south'],
    [300, 270, 'west'], [160, 226, 'west'],
  ])('%i m out on a bearing of %i is the %s', (meters, bearing, key) => {
    expect(areaAt(at(meters, bearing), LOST, DOG)).toBe(key);
  });

  test('past the edge is outside the search, until it is widened', () => {
    expect(areaAt(at(500, 90), LOST, DOG)).toBeNull();
    expect(areaAt(at(500, 90), LOST, DOG, { widened: true })).toBe('outer-east');
    expect(areaAt(at(500, 45), LOST, DOG, { widened: true })).toBe('outer-north-east');
    expect(areaAt(at(700, 350), LOST, DOG, { widened: true })).toBe('outer-north');
    expect(areaAt(at(900, 90), LOST, DOG, { widened: true })).toBeNull();
  });

  test('a place that is not a place is in no area', () => {
    expect(areaAt(null, LOST, DOG)).toBeNull();
    expect(areaAt({ lat: 'x', lng: 1 }, LOST, DOG)).toBeNull();
    expect(areaAt(at(10, 0), null, DOG)).toBeNull();
  });
});

describe('how long an area takes', () => {
  test('from the size of the ground: a side of a dog\'s circle is about 45 minutes, the middle about 30', () => {
    const [middle, north] = areasOf(DOG);
    expect(hectaresOf(middle)).toBeCloseTo(7.07, 2);
    expect(hectaresOf(north)).toBeCloseTo(10.8, 1);
    expect(minutesFor(middle)).toBe(30);
    expect(minutesFor(north)).toBe(45);
    expect(MINUTES_PER_HECTARE).toBe(4);
  });

  test('the four sides take the same, whatever streets run through them', () => {
    const sides = areasOf(DOG).filter((a) => a.ring === 1);
    expect(new Set(sides.map(minutesFor)).size).toBe(1);
  });

  test('a cat\'s small areas are never under ten minutes', () => {
    for (const area of areasOf(CIRCLES.CAT)) expect(minutesFor(area)).toBe(10);
  });
});

describe('the edge of an area, for a map', () => {
  test('the middle is a closed circle at its radius', () => {
    const line = outlineOf(areasOf(DOG)[0], LOST);
    expect(line[0]).toEqual(line[line.length - 1]);
    for (const [lat, lng] of line) expect(distanceMeters(LOST, { lat, lng })).toBeCloseTo(150, 0);
  });

  test('a side is closed, and every point of it is on the inner or the outer arc', () => {
    const north = areasOf(DOG)[1];
    const line = outlineOf(north, LOST);
    expect(line[0]).toEqual(line[line.length - 1]);
    for (const [lat, lng] of line) {
      const away = distanceMeters(LOST, { lat, lng });
      expect(Math.min(Math.abs(away - 150), Math.abs(away - 400))).toBeLessThan(1.5);
    }
    // Both arcs are there.
    expect(line.some(([lat, lng]) => Math.abs(distanceMeters(LOST, { lat, lng }) - 150) < 1.5)).toBe(true);
    expect(line.some(([lat, lng]) => Math.abs(distanceMeters(LOST, { lat, lng }) - 400) < 1.5)).toBe(true);
  });

  test('the middle of an area is inside it', () => {
    for (const area of areasOf(DOG, { widened: true })) {
      const heart = heartOf(area, LOST);
      if (area.ring === 0) expect(heart).toEqual(LOST);
      else expect(inArea(heart, LOST, area)).toBe(true);
    }
  });
});

describe('an area in words', () => {
  test('how far it reaches, and which way', () => {
    const [middle, north, , , west] = areasOf(DOG);
    expect(reachOf(middle, 'Max')).toBe('Within 150 m of where Max was lost');
    expect(reachOf(north, 'Max')).toBe('150 m to 400 m north of where Max was lost');
    expect(reachOf(west, 'Max')).toBe('150 m to 400 m west of where Max was lost');
    expect(reachOf(areasOf(DOG, { widened: true })[6], 'Max')).toBe('400 m to 800 m north-east of where Max was lost');
  });
});

describe('streets, as landmarks only', () => {
  const street = (name, from, to) => ({ name, path: [[from.lat, from.lng], [to.lat, to.lng]] });

  test('the two with the most length in the area, longest first', () => {
    const north = areasOf(DOG)[1];
    const streets = [
      street('Long Ave', at(160, 0), at(390, 0)),
      street('Short St', at(300, 350), at(300, 10)),
      street('Tiny Ct', at(200, 5), at(210, 5)),
      street('South Rd', at(200, 180), at(390, 180)),
    ];
    expect(landmarksIn(north, LOST, streets)).toEqual(['Long Ave', 'Short St']);
    expect(landmarksIn(areasOf(DOG)[3], LOST, streets)).toEqual(['South Rd']);
  });

  test('a street counts only for the part of it inside', () => {
    // 60 m of this one is inside the middle; the other runs 100 m inside it.
    const streets = [
      { name: 'Through Rd', path: [[at(120, 90).lat, at(120, 90).lng], [at(180, 90).lat, at(180, 90).lng], [at(390, 90).lat, at(390, 90).lng]] },
      street('Inside Ln', at(20, 0), at(120, 0)),
    ];
    expect(landmarksIn(areasOf(DOG)[0], LOST, streets)).toEqual(['Inside Ln']);
  });

  test('an area with no street in it still has minutes, and no landmarks', () => {
    const west = areasOf(DOG)[4];
    expect(landmarksIn(west, LOST, [])).toEqual([]);
    expect(landmarksIn(west, LOST, [null, { name: '', path: [] }, { name: 'X' }])).toEqual([]);
    expect(minutesFor(west)).toBe(45);
  });
});

describe('what is searched first', () => {
  const NOW = new Date('2026-11-12T22:00:00Z').getTime();
  const seen = (meters, bearing, minutesAgo) => ({ ...at(meters, bearing), at: new Date(NOW - minutesAgo * 60000) });

  test('the middle, then the sides, then the outer areas', () => {
    const { areas } = planCircle({ center: LOST, species: 'DOG', widened: true, now: NOW });
    expect(areas[0].key).toBe('middle');
    expect(areas.slice(1, 5).every((a) => a.ring === 1)).toBe(true);
    expect(areas.slice(5).every((a) => a.ring === 2)).toBe(true);
  });

  test('an area the pet was just seen in comes before all of them', () => {
    const { areas } = planCircle({ center: LOST, species: 'DOG', sightings: [seen(300, 180, 12)], now: NOW });
    expect(areas[0].key).toBe('south');
    expect(areas[0].urgency).toBe(10);
    expect(areas[1].key).toBe('middle');
  });

  test('a sighting older than three days moves nothing', () => {
    const south = areasOf(DOG)[3];
    expect(urgencyOf(south, LOST, { sightings: [seen(300, 180, 4 * 24 * 60)], now: NOW })).toBe(6);
    expect(urgencyOf(south, LOST, { sightings: [seen(300, 0, 5)], now: NOW })).toBe(6);
    expect(urgencyOf(south, LOST, { sightings: [null, { lat: 'x' }], now: NOW })).toBe(6);
  });
});

describe('a search, planned', () => {
  test('each area carries its minutes, its reach, its landmarks, its edge and its middle', () => {
    const streets = [{ name: 'Sinclair Ave', path: [[at(160, 10).lat, at(160, 10).lng], [at(390, 10).lat, at(390, 10).lng]] }];
    const { circle, areas } = planCircle({ center: LOST, species: 'DOG', name: 'Max', streets });
    expect(circle).toEqual(CIRCLES.DOG);
    expect(areas).toHaveLength(5);
    const north = areas.find((a) => a.key === 'north');
    expect(north).toMatchObject({ name: 'North side', minutes: 45, reach: '150 m to 400 m north of where Max was lost', landmarks: ['Sinclair Ave'] });
    expect(north.outline.length).toBeGreaterThan(20);
    expect(inArea(north.heart, LOST, north)).toBe(true);
  });

  test('a cat\'s search is the same shape, smaller', () => {
    const { circle, areas } = planCircle({ center: LOST, species: 'CAT', name: 'Luna' });
    expect(circle).toEqual({ inner: 50, edge: 150, wide: 500 });
    expect(areas.find((a) => a.key === 'middle').reach).toBe('Within 50 m of where Luna was lost');
    expect(areas.find((a) => a.key === 'east').reach).toBe('50 m to 150 m east of where Luna was lost');
  });

  test('a search with nowhere to start has no circle', () => {
    expect(planCircle({ center: null, species: 'DOG' })).toEqual({ circle: null, areas: [] });
    expect(planCircle({ center: { lat: NaN, lng: 1 }, species: 'DOG' })).toEqual({ circle: null, areas: [] });
  });
});
