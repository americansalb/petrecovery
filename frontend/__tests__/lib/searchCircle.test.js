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
  CIRCLES, DEFAULT_CIRCLE, RING, MINUTES_PER_HECTARE, MINUTES_PER_HECTARE_CLOSE_CAT,
  circleFor, areasOf, inArea, areaAt, hectaresOf, minutesFor, seenArea, inWords, pointAt, outlineOf, heartOf, reachOf, landmarksIn, urgencyOf, planCircle, rankAreas, needsSearch, outLongAfter, heldFor,
} from '@/app/lib/searchCircle';
import { distanceMeters } from '@/app/lib/searchGrid';

const LOST = { lat: 30.3148, lng: -97.7459 };
const DOG = CIRCLES.DOG;
const at = (meters, bearing) => pointAt(LOST, meters, bearing);

describe('how big the circle is', () => {
  test('a dog starts at 400 m and widens to 800 m; a cat starts at 150 m and widens to 500 m', () => {
    expect(circleFor('DOG')).toMatchObject({ inner: 150, edge: 400, wide: 800 });
    expect(circleFor('cat')).toMatchObject({ inner: 50, edge: 150, wide: 500 });
  });

  test('any other animal, or none named, is searched for like a dog', () => {
    expect(circleFor('RABBIT')).toBe(DEFAULT_CIRCLE);
    expect(circleFor(null)).toBe(DEFAULT_CIRCLE);
    expect(DEFAULT_CIRCLE).toBe(CIRCLES.DOG);
  });

  test('the sizes cannot be changed by a caller', () => {
    expect(Object.isFrozen(CIRCLES)).toBe(true);
    expect(Object.isFrozen(CIRCLES.DOG)).toBe(true);
  });

  test('the circle round a sighting: 150 m for a dog, 50 m for a cat', () => {
    expect(CIRCLES.DOG.seen).toBe(150);
    expect(CIRCLES.CAT.seen).toBe(50);
    expect(seenArea('s1', CIRCLES.DOG, 'Max')).toEqual({ key: 'seen-s1', name: 'Where Max was seen', way: null, ring: RING.SEEN, from: 0, to: 150, a: 0, b: 360 });
    expect(seenArea('s2', CIRCLES.CAT, 'Luna')).toMatchObject({ key: 'seen-s2', to: 50 });
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
    expect(outer.map((a) => a.name)).toEqual(['Far north', 'Far north-east', 'Far east', 'Far south-east', 'Far south', 'Far south-west', 'Far west', 'Far north-west']);
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

  test('close in, a cat\'s ground takes five times as long: every hiding place is looked into', () => {
    const [middle, north] = areasOf(CIRCLES.CAT);
    expect(MINUTES_PER_HECTARE_CLOSE_CAT).toBe(20);
    // 0.79 hectares and 1.57 hectares.
    expect(minutesFor(middle, CIRCLES.CAT)).toBe(15);
    expect(minutesFor(north, CIRCLES.CAT)).toBe(30);
    // At the plain rate both would be the ten-minute floor.
    expect(minutesFor(middle)).toBe(10);
    expect(minutesFor(north)).toBe(10);
  });

  test('past the edge, ground is covered at the plain rate for any animal', () => {
    const outerCat = areasOf(CIRCLES.CAT, { widened: true }).find((a) => a.ring === RING.OUTER);
    const outerDog = areasOf(CIRCLES.DOG, { widened: true }).find((a) => a.ring === RING.OUTER);
    expect(hectaresOf(outerCat)).toBeCloseTo(8.93, 1);
    expect(minutesFor(outerCat, CIRCLES.CAT)).toBe(35);
    expect(hectaresOf(outerDog)).toBeCloseTo(18.85, 1);
    expect(minutesFor(outerDog, CIRCLES.DOG)).toBe(75);
  });

  test('the circle round a sighting takes half an hour for a dog and a quarter for a cat', () => {
    expect(minutesFor(seenArea('s', CIRCLES.DOG), CIRCLES.DOG)).toBe(30);
    expect(minutesFor(seenArea('s', CIRCLES.CAT), CIRCLES.CAT)).toBe(15);
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
    expect(reachOf(seenArea('s', DOG, 'Max'), 'Max')).toBe('Within 150 m of where Max was seen');
  });

  test('its name inside a sentence', () => {
    expect(inWords('The middle')).toBe('the middle');
    expect(inWords('North side')).toBe('the north side');
    expect(inWords('Far north-east')).toBe('the far north-east');
    expect(inWords('Where Max was seen')).toBe('where Max was seen');
    expect(inWords('')).toBe('the area');
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
    expect(circle).toBe(CIRCLES.CAT);
    expect(areas.find((a) => a.key === 'middle').minutes).toBe(15);
    expect(areas.find((a) => a.key === 'middle').reach).toBe('Within 50 m of where Luna was lost');
    expect(areas.find((a) => a.key === 'east').reach).toBe('50 m to 150 m east of where Luna was lost');
  });

  test('a search with nowhere to start has no circle', () => {
    expect(planCircle({ center: null, species: 'DOG' })).toEqual({ circle: null, areas: [] });
    expect(planCircle({ center: { lat: NaN, lng: 1 }, species: 'DOG' })).toEqual({ circle: null, areas: [] });
  });
});

describe('the order ground is given out in', () => {
  const area = (key, over = {}) => ({ id: key, key, status: 'UNSEARCHED', priority: 6, on: 0, coming: 0, searchCount: 0, searchedAt: null, mine: false, full: false, ...over });
  const order = (areas, away) => rankAreas(areas, away).map((a) => a.id);

  test('unsearched ground with nobody on it, most urgent first', () => {
    expect(order([area('north'), area('middle', { priority: 8 }), area('east')])).toEqual(['middle', 'north', 'east']);
  });

  test('on a tie, the nearest to the person asking', () => {
    const away = (a) => ({ north: 500, east: 120, south: 300 })[a.id];
    expect(order([area('north'), area('east'), area('south')], away)).toEqual(['east', 'south', 'north']);
  });

  test('the area this person was asked to search comes before all of them', () => {
    expect(order([area('middle', { priority: 10 }), area('west', { askedOfMe: true })])).toEqual(['west', 'middle']);
  });

  test('ground with nobody on it comes before ground someone is already on, however urgent', () => {
    expect(order([area('middle', { priority: 8, status: 'IN_PROGRESS', on: 1 }), area('north')])).toEqual(['north', 'middle']);
  });

  test('and before ground someone was asked to search and is on the way to', () => {
    expect(order([area('middle', { priority: 8, coming: 1 }), area('north')])).toEqual(['north', 'middle']);
  });

  test('with every unsearched area taken, a second person joins the one with the fewest people', () => {
    expect(order([area('north', { status: 'IN_PROGRESS', on: 2 }), area('east', { status: 'IN_PROGRESS', on: 1 }), area('middle', { status: 'SEARCHED', searchCount: 1, searchedAt: '2026-11-12T10:00:00Z' })])).toEqual(['east', 'north', 'middle']);
  });

  test('an area up for another look is given out like one never searched', () => {
    expect(order([area('middle', { status: 'SEARCHED', searchCount: 1, searchedAt: '2026-11-12T10:00:00Z', priority: 8 }), area('east', { status: 'NEEDS_REVISIT', searchCount: 1 })])).toEqual(['east', 'middle']);
  });

  test('up for another look, it keeps its place once someone starts it: one person on it does not make it searched', () => {
    // The board says IN_PROGRESS while anyone is on it, which hides "another look". `again` is what says it still is.
    const north = area('north', { status: 'IN_PROGRESS', on: 1, searchCount: 1, searchedAt: '2026-11-12T12:00:00Z', again: true });
    const middle = area('middle', { status: 'SEARCHED', searchCount: 1, searchedAt: '2026-11-12T09:00:00Z', priority: 8 });
    const south = area('south', { status: 'SEARCHED', searchCount: 1, searchedAt: '2026-11-12T10:00:00Z' });
    expect(order([middle, south, north])).toEqual(['north', 'middle', 'south']);
    // Without it, the same area is plain searched ground with someone on it, and goes last.
    expect(order([middle, south, { ...north, again: false }])).toEqual(['middle', 'south', 'north']);
  });

  test('"send people here first" holds until it is searched: the next people go there whoever is already on it', () => {
    const first = area('north', { first: true, priority: 11, status: 'IN_PROGRESS', on: 1 });
    expect(order([area('middle', { priority: 8 }), area('east'), first])).toEqual(['north', 'middle', 'east']);
    // Searched before and asked for first: the same, though the board says it is being searched.
    expect(order([area('middle', { priority: 8 }), { ...first, searchCount: 1, searchedAt: '2026-11-12T09:00:00Z', again: true }])).toEqual(['north', 'middle']);
    // Two asked for first: the one with fewer people on it.
    expect(order([first, area('west', { first: true, priority: 11 })])).toEqual(['west', 'north']);
    // The area this person was asked to search still comes before it, and a sighting's circle with its one person is never given.
    expect(order([first, area('west', { askedOfMe: true }), area('seen-1', { ring: RING.SEEN, first: true, priority: 11, full: true })])).toEqual(['west', 'north']);
  });

  test('what "still needs a search" means, wherever it is asked', () => {
    expect(needsSearch({ status: 'UNSEARCHED', searchCount: 0 })).toBe(true);
    expect(needsSearch({ status: 'IN_PROGRESS', searchCount: 0 })).toBe(true);
    expect(needsSearch({ status: 'NEEDS_REVISIT', searchCount: 1 })).toBe(true);
    expect(needsSearch({ status: 'IN_PROGRESS', searchCount: 1, again: true })).toBe(true);
    expect(needsSearch({ status: 'IN_PROGRESS', searchCount: 2, first: true })).toBe(true);
    expect(needsSearch({ status: 'SEARCHED', searchCount: 1 })).toBe(false);
    expect(needsSearch({ status: 'IN_PROGRESS', searchCount: 1 })).toBe(false);
    expect(needsSearch(null)).toBe(false);
  });

  test('then ground searched longest ago, so there is always some to give', () => {
    const searched = (key, at) => area(key, { status: 'SEARCHED', searchCount: 1, searchedAt: at });
    expect(order([searched('north', '2026-11-12T12:00:00Z'), searched('middle', '2026-11-12T09:00:00Z'), searched('east', '2026-11-12T10:00:00Z')])).toEqual(['middle', 'east', 'north']);
  });

  test('never the area this person is on, and never a sighting\'s circle that has its one person', () => {
    expect(order([area('middle', { mine: true }), area('seen-1', { priority: 10, full: true }), area('north')])).toEqual(['north']);
  });

  test('a sighting\'s circle with nobody there is given first', () => {
    expect(order([area('middle', { priority: 8 }), area('seen-1', { priority: 10, ring: 3 }), area('south', { priority: 10 })])).toEqual(['seen-1', 'south', 'middle']);
  });

  test('before the side the pet was seen in, even where that side is the nearer of the two', () => {
    // Both are as urgent as each other while the sighting is fresh. One person goes to where the pet was seen first.
    const away = (a) => ({ 'seen-1': 420, south: 380, middle: 200 })[a.id];
    expect(order([area('south', { priority: 10 }), area('seen-1', { priority: 10, ring: 3 }), area('middle', { priority: 8 })], away)).toEqual(['seen-1', 'south', 'middle']);
    // The owner sending people somewhere first is above both.
    expect(order([area('seen-1', { priority: 10, ring: 3 }), area('west', { priority: 11 })], away)[0]).toBe('west');
  });
});

describe('how long someone is counted as on an area with no word from them', () => {
  test('the desk is told they have been out a long time after twice what the area takes and a quarter of an hour', () => {
    expect(outLongAfter(45)).toBe(105);
    expect(outLongAfter(30)).toBe(75);
    expect(outLongAfter(75)).toBe(165);
    // An area whose time is not known is taken to be twenty minutes.
    expect(outLongAfter(undefined)).toBe(55);
  });

  test('the site goes on counting them for half an hour after that, and never under two hours', () => {
    expect(heldFor(45)).toBe(135);
    expect(heldFor(75)).toBe(195);
    expect(heldFor(30)).toBe(120);
    expect(heldFor(10)).toBe(120);
  });

  test('so for every area of every search, the desk hears before the site stops counting', () => {
    for (const circle of [CIRCLES.DOG, CIRCLES.CAT]) {
      const areas = [...areasOf(circle, { widened: true }), seenArea('s1', circle, 'Max')];
      for (const a of areas) {
        const minutes = minutesFor(a, circle);
        expect(heldFor(minutes) - outLongAfter(minutes)).toBeGreaterThanOrEqual(30);
      }
    }
  });
});
