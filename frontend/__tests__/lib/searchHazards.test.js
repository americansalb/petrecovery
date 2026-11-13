/**
 * What the map shows on a search's ground that someone on foot should know
 * of: main roads, rail lines and water (app/lib/searchHazards.js).
 *
 * Founder, 2026-11-12: "Are we inadvertantly telling people to search in
 * ponds, or dangerous neighborhoods, near the highway, distracting them
 * from traffic? We need to be careful about that".
 */
import fs from 'fs';
import path from 'path';
import { hazardOf, hazardQuery, hazardsFrom, hazardsIn, trimHazards, fetchHazards, parseHazards } from '@/app/lib/searchHazards';
import { hazardLines, CARE_LINE, MAP_LIMITS_LINE, areaFacts } from '@/app/mission-control/lib/ground';
import { briefFor } from '@/app/lib/brief';
import { SAFETY_RULES } from '@/app/lib/safetyRules';

const read = (file) => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');

const CENTER = { lat: 30.3, lng: -97.74 };
const north = (m) => CENTER.lat + m / 111320;
const east = (m) => CENTER.lng + m / (111320 * Math.cos((CENTER.lat * Math.PI) / 180));
// The east side of a dog's search: 150 m to 400 m out, between north-east and south-east.
const EAST = { key: 'east', ring: 1, from: 150, to: 400, a: 45, b: 135 };
const MIDDLE = { key: 'middle', ring: 0, from: 0, to: 150, a: 0, b: 360 };
const line = (points) => points.map(([n, e]) => [north(n), east(e)]);

describe('what counts', () => {
  test('a motorway, a trunk road and a primary road are main roads, and a residential street is not', () => {
    expect(hazardOf({ highway: 'motorway', ref: 'I 35' })).toEqual({ kind: 'road', name: 'I 35', what: 'road' });
    expect(hazardOf({ highway: 'trunk_link' })).toMatchObject({ kind: 'road', name: '' });
    expect(hazardOf({ highway: 'primary', name: 'Lamar Boulevard' })).toMatchObject({ kind: 'road', name: 'Lamar Boulevard' });
    expect(hazardOf({ highway: 'residential', name: 'Elm Street' })).toBeNull();
    expect(hazardOf({ highway: 'secondary', name: 'Oak Street' })).toBeNull();
  });

  test('a road or a line in a tunnel is not on the ground, and nor is a rail line on a bridge', () => {
    expect(hazardOf({ highway: 'motorway', tunnel: 'yes' })).toBeNull();
    expect(hazardOf({ railway: 'subway', tunnel: 'yes' })).toBeNull();
    expect(hazardOf({ railway: 'rail', bridge: 'viaduct' })).toBeNull();
    expect(hazardOf({ railway: 'subway' })).toEqual({ kind: 'rail', name: '', what: 'rail' });
    expect(hazardOf({ waterway: 'stream', tunnel: 'culvert' })).toBeNull();
  });

  test('a river, a canal, a stream, a pond and a reservoir are water', () => {
    expect(hazardOf({ waterway: 'stream', name: 'Shoal Creek' })).toEqual({ kind: 'water', name: 'Shoal Creek', what: 'stream' });
    expect(hazardOf({ waterway: 'canal' })).toMatchObject({ kind: 'water', what: 'canal' });
    expect(hazardOf({ natural: 'water' })).toEqual({ kind: 'water', name: '', what: 'pond' });
    expect(hazardOf({ natural: 'water', water: 'river' })).toMatchObject({ what: 'river' });
    expect(hazardOf({ landuse: 'reservoir' })).toMatchObject({ kind: 'water' });
    expect(hazardOf({ waterway: 'ditch' })).toBeNull();
    expect(hazardOf({ leisure: 'swimming_pool' })).toBeNull();
    expect(hazardOf(null)).toBeNull();
  });
});

describe('reading an answer', () => {
  test('the question asks for the three kinds and for one ordinary street as proof the server holds the place', () => {
    const q = hazardQuery({ lat: 30.3, lng: -97.74, radiusMeters: 950 });
    expect(q).toContain('(around:950,30.300000,-97.740000)');
    expect(q).toMatch(/motorway\|trunk\|primary/);
    expect(q).toMatch(/railway/);
    expect(q).toMatch(/waterway/);
    expect(q).toMatch(/"natural"="water"/);
    expect(q).toMatch(/out geom;way\["highway"\]\["name"\]\(around:[^)]+\);out ids 1;$/);
  });

  test('from Overpass: ways with their own lines, and a lake drawn as a relation', () => {
    const out = hazardsFrom([
      { type: 'way', id: 1, tags: { highway: 'primary', name: 'Lamar Boulevard' }, geometry: [{ lat: 30.3, lon: -97.74 }, { lat: 30.301, lon: -97.74 }] },
      { type: 'way', id: 2 },
      { type: 'way', id: 3, tags: { highway: 'residential', name: 'Elm Street' }, geometry: [{ lat: 30.3, lon: -97.74 }, { lat: 30.3, lon: -97.741 }] },
      { type: 'relation', id: 9, tags: { natural: 'water', name: 'Lady Bird Lake' }, members: [
        { type: 'way', ref: 40, role: 'outer', geometry: [{ lat: 30.29, lon: -97.74 }, { lat: 30.29, lon: -97.75 }] },
        { type: 'way', ref: 41, role: 'inner', geometry: [{ lat: 30.291, lon: -97.74 }, { lat: 30.291, lon: -97.75 }] },
      ] },
    ]);
    expect(out.map((h) => [h.kind, h.name, h.path.length])).toEqual([['road', 'Lamar Boulevard', 2], ['water', 'Lady Bird Lake', 2]]);
  });

  test('from the map call: points and ways apart, a relation by its member ways', () => {
    const out = hazardsFrom([
      { type: 'node', id: 1, lat: 30.3, lon: -97.74 },
      { type: 'node', id: 2, lat: 30.301, lon: -97.74 },
      { type: 'node', id: 3, lat: 30.302, lon: -97.741 },
      { type: 'way', id: 10, nodes: [1, 2, 3], tags: { railway: 'rail' } },
      { type: 'way', id: 11, nodes: [1, 3] },
      { type: 'relation', id: 12, tags: { natural: 'water' }, members: [{ type: 'way', ref: 11, role: 'outer' }] },
    ]);
    expect(out).toEqual([
      { kind: 'rail', name: '', what: 'rail', path: [[30.3, -97.74], [30.301, -97.74], [30.302, -97.741]] },
      { kind: 'water', name: '', what: 'pond', path: [[30.3, -97.74], [30.302, -97.741]] },
    ]);
  });

  test('only the part within reach is kept, and crowded points are dropped', () => {
    const road = { kind: 'road', name: 'Far Road', what: 'road', path: line([[0, 0], [0, 2], [0, 400], [0, 900], [0, 2000], [0, 2600]]) };
    const [kept] = trimHazards([road], CENTER, 950);
    expect(kept.path).toHaveLength(3);
    expect(trimHazards([{ ...road, path: line([[0, 3000], [0, 4000]]) }], CENTER, 950)).toEqual([]);
  });

  test('an answer with no way in it is not trusted, so an empty server is not read as "no main road"', async () => {
    const ask = jest.fn(async ({ good }) => {
      expect(good([])).toBe(false);
      expect(good([{ type: 'way', id: 5 }])).toBe(true);
      return { from: 'overpass', elements: [{ type: 'way', id: 5 }, { type: 'way', id: 6, tags: { waterway: 'stream', name: 'Shoal Creek' }, geometry: [{ lat: 30.3, lon: -97.74 }, { lat: 30.3005, lon: -97.74 }] }] };
    });
    const list = await fetchHazards({ lat: 30.3, lng: -97.74, radiusMeters: 950, ask });
    expect(list.map((h) => h.name)).toEqual(['Shoal Creek']);
    expect(ask.mock.calls[0][0].box).toMatchObject({ south: expect.any(Number), north: expect.any(Number) });
  });

  test('a stored list that cannot be read names nothing', () => {
    expect(parseHazards('not json')).toEqual([]);
    expect(parseHazards(null)).toEqual([]);
    expect(parseHazards('[{"kind":"road","name":"A"},{"kind":"dragons"}]')).toEqual([{ kind: 'road', name: 'A' }]);
  });
});

describe('which area holds what', () => {
  const highway = { kind: 'road', name: 'Tlalpan', what: 'road', path: line([[-600, 250], [600, 250]]) };
  const ramp = { kind: 'road', name: '', what: 'road', path: line([[-100, 230], [100, 230]]) };
  const rail = { kind: 'rail', name: '', what: 'rail', path: line([[-600, 260], [600, 260]]) };
  const pond = { kind: 'water', name: '', what: 'pond', path: line([[0, 300], [20, 300], [20, 320], [0, 320], [0, 300]]) };
  const fountain = { kind: 'water', name: 'Gran Fuente', what: 'pond', path: line([[50, 300], [55, 300], [55, 305], [50, 305], [50, 300]]) };
  const farCreek = { kind: 'water', name: 'Far Creek', what: 'stream', path: line([[0, 700], [100, 700]]) };

  test('a road, a rail line and a pond that run through the east side are named there, and not in the middle', () => {
    const all = [highway, ramp, rail, pond, fountain, farCreek];
    expect(hazardsIn(EAST, CENTER, all)).toEqual([
      { kind: 'road', name: 'Tlalpan', what: 'road' },
      { kind: 'rail', name: '', what: 'rail' },
      { kind: 'water', name: '', what: 'pond' },
    ]);
    expect(hazardsIn(MIDDLE, CENTER, all)).toEqual([]);
  });

  test('one long straight piece is found although its ends are both outside the area', () => {
    expect(hazardsIn(MIDDLE, CENTER, [{ kind: 'road', name: 'Through Road', what: 'road', path: line([[-900, 0], [900, 0]]) }])).toEqual([{ kind: 'road', name: 'Through Road', what: 'road' }]);
  });

  test('a road that only clips a corner is not named', () => {
    expect(hazardsIn(MIDDLE, CENTER, [{ kind: 'road', name: 'Corner Road', what: 'road', path: line([[149, -10], [149, 10]]) }])).toEqual([]);
  });

  test('a creek with a name stands for the unnamed stretches of its bed, and a pond with no name is still said', () => {
    const creek = { kind: 'water', name: 'Shoal Creek', what: 'stream', path: line([[-100, 0], [100, 0]]) };
    const bed = { kind: 'water', name: '', what: 'river', path: line([[-100, 5], [100, 5]]) };
    const small = { kind: 'water', name: '', what: 'pond', path: line([[40, 40], [60, 40], [60, 60], [40, 60], [40, 40]]) };
    expect(hazardsIn(MIDDLE, CENTER, [bed, small, creek])).toEqual([
      { kind: 'water', name: 'Shoal Creek', what: 'stream' },
      { kind: 'water', name: '', what: 'pond' },
    ]);
    expect(hazardsIn(MIDDLE, CENTER, [bed])).toEqual([{ kind: 'water', name: '', what: 'river' }]);
  });

  test('the circle round a sighting is measured from the sighting', () => {
    const seen = { key: 'seen-1', ring: 3, from: 0, to: 150, a: 0, b: 360 };
    const at = { lat: north(0), lng: east(250) };
    expect(hazardsIn(seen, at, [highway]).map((h) => h.name)).toEqual(['Tlalpan']);
  });
});

describe('what the card says', () => {
  test('each kind in a sentence, with what to do about it', () => {
    const area = { hazards: [{ kind: 'road', name: 'Calzada de Tlalpan' }, { kind: 'rail', name: '' }, { kind: 'water', name: '', what: 'pond' }] };
    expect(hazardLines(area)).toEqual([
      'Calzada de Tlalpan is a main road in this area. Stay off the roadway and cross only at a crossing.',
      'A rail line runs through this area. Stay off the tracks and outside any fence.',
      'A pond or lake is in this area. Look from the bank or a path, and stay out of the water.',
    ]);
  });

  test('two roads, a road with no name, and named water beside unnamed', () => {
    expect(hazardLines({ hazards: [{ kind: 'road', name: 'A Street' }, { kind: 'road', name: 'B Street' }] })[0]).toMatch(/^A Street and B Street are main roads in this area\./);
    expect(hazardLines({ hazards: [{ kind: 'road', name: '' }] })[0]).toMatch(/^A main road runs through this area\./);
    expect(hazardLines({ hazards: [{ kind: 'water', name: 'Shoal Creek', what: 'stream' }, { kind: 'water', name: '', what: 'canal' }] })[0]).toMatch(/^Shoal Creek and a canal are in this area\./);
  });

  test('nothing on the map is nothing said, and never a claim that the ground is safe', () => {
    expect(hazardLines({ hazards: [] })).toEqual([]);
    expect(hazardLines({})).toEqual([]);
    expect(`${CARE_LINE} ${hazardLines({ hazards: [{ kind: 'road', name: 'X' }] }).join(' ')}`).not.toMatch(/\bsafe\b/i);
  });

  test('the care line is on the card with every area, and before someone asked says yes', () => {
    const helper = read('app/mission-control/steps/Helper.js');
    expect(CARE_LINE).toMatch(/phone only when you are standing still/);
    expect(CARE_LINE).toMatch(/Ask before you go into a yard, garage or shed/);
    expect(helper).toMatch(/<Care area=\{mine\}/);
    expect(helper).toMatch(/\{ground && <Care area=\{ask\}/);
    expect(helper).toMatch(/<Note>\{CARE_LINE\}<\/Note>/);
  });

  test('the person running the search reads the same facts on the area before asking anyone to go', () => {
    const facts = areaFacts({ name: 'East side', ring: 1, reach: '150 m to 400 m east', minutes: 45, landmarks: [], hazards: [{ kind: 'road', name: 'Calzada de Tlalpan' }], status: 'UNSEARCHED', searchCount: 0, on: [], asked: [] }, { picture: { pet: { name: 'Max' }, sightings: [] }, circle: null });
    expect(facts).toContain('Calzada de Tlalpan is a main road in this area.');
  });
});

describe('where the brief sends people', () => {
  const lines = (species, way) => briefFor({ way, pet: { petName: 'Max', petSpecies: species } }).join(' ');

  test('to look from the sidewalk or a path, and to ask before a yard, shed or garage', () => {
    for (const species of ['DOG', 'CAT', 'RABBIT']) {
      const said = lines(species, 'foot');
      expect(said).toMatch(/from the sidewalk/);
      expect(said).toMatch(/Ask at the door before you look in a yard, shed or garage\./);
    }
  });

  test('never into open garages or sheds, and never to a creek', () => {
    for (const species of ['DOG', 'CAT', 'RABBIT']) {
      for (const way of ['foot', 'car', 'gear']) {
        const said = lines(species, way);
        expect(said).not.toMatch(/open garages|in sheds and garages|creek/i);
      }
    }
  });

  test('a driver is told to pull over before looking at the phone', () => {
    expect(lines('DOG', 'car')).toMatch(/pull over before you look at your phone/);
  });

  test('the rules a helper agrees to cover the road, water and rail, and the phone', () => {
    const rules = SAFETY_RULES.join(' ');
    expect(rules).toMatch(/Stay out of the road\./);
    expect(rules).toMatch(/never follow an animal into traffic/);
    expect(rules).toMatch(/Stay out of water and drains, off rail lines/);
    expect(rules).toMatch(/phone only when you are standing still/);
    expect(rules).toMatch(/Never enter private property without permission\./);
  });
});

describe('the board', () => {
  const zones = read('app/lib/searchZones.js');
  const route = read('app/api/mission/[missionId]/board/route.js');

  test('the map is asked once per search, and a read of the board never waits for it', () => {
    expect(route).toMatch(/if \(read\.hazardsStatus !== 'READY'\) ensureHazards\(pet\.id\)\.catch\(/);
    expect(route).not.toMatch(/await ensureHazards/);
    expect(zones).toMatch(/if \(state\?\.hazardsStatus === 'READY'\) return 'READY';/);
  });

  test('an area made later (the outer ring, a sighting circle) is checked against the same list', () => {
    expect(zones).toMatch(/grid\?\.hazardsStatus === 'READY' && \(missing\.length \|\| rows\.some\(\(r\) => r\.hazards == null\)\)/);
  });

  test('what leaves the server is the kind and the name, never the lines', () => {
    expect(zones).toMatch(/hazards: parseHazards\(row\.hazards\)\.map\(\(\{ kind, name, what \}\) => \(\{ kind, name: name \|\| '', what \}\)\)/);
  });
});

describe('the rest of the site says the same', () => {
  test('the owner advice sends nobody into water, a culvert or a neighbor\'s building', () => {
    const advice = read('app/lib/petAdvice.js');
    expect(advice).not.toMatch(/inside open garages|Check under bridges and in culverts|creek bed, drainage ditch, pond area/);
    expect(advice).toMatch(/Stay out of the water, and do not go into a culvert or a drain\./);
    expect(advice).toMatch(/Ask neighbors to check their own garages and sheds\./);
    expect(read('app/simulator/components/RecoveryGuidance.js')).not.toMatch(/Search drainage ditches and culverts|Check all backyard structures/);
    expect(read('app/lib/missionControl/taskPriority.js')).not.toMatch(/'Sheds, garages, under decks, in bushes'/);
  });
});

describe('what the map shows is said to be the map\'s, where it is read', () => {
  // Founder, 2026-11-13: "Now we are liable for having accurate info?"
  const helper = read('app/mission-control/steps/Helper.js');

  test('the list on a helper\'s card says it is from a public map that can be wrong or leave things out', () => {
    expect(MAP_LIMITS_LINE).toBe('This is read from a public map, which can be wrong or leave things out.');
    const box = helper.slice(helper.indexOf('aria-label="Take care in this area"'), helper.indexOf('<Note>{CARE_LINE}</Note>'));
    expect(box).toMatch(/\{MAP_LIMITS_LINE\}/);
  });

  test('every card, with a list or without one, says the site checks no ground', () => {
    expect(CARE_LINE).toMatch(/ReunitePets does not check any ground, so watch for danger yourself\.$/);
    expect(helper).toMatch(/<Note>\{CARE_LINE\}<\/Note>/);
  });

  test('the desk says the same under the facts it lists, and nothing about the map where it lists none', () => {
    const area = { name: 'East side', ring: 1, reach: '150 m to 400 m east', minutes: 45, landmarks: [], status: 'UNSEARCHED', searchCount: 0, on: [], asked: [] };
    const options = { picture: { pet: { name: 'Max' }, sightings: [] }, circle: null };
    const withRoad = areaFacts({ ...area, hazards: [{ kind: 'road', name: 'Calzada de Tlalpan' }] }, options);
    expect(withRoad.indexOf(MAP_LIMITS_LINE)).toBe(withRoad.indexOf('Calzada de Tlalpan is a main road in this area.') + 1);
    const bare = areaFacts({ ...area, hazards: [] }, options).join(' ');
    expect(bare).not.toContain(MAP_LIMITS_LINE);
    // Never "the map shows nothing here": that reads as "this ground is clear".
    expect(bare).not.toMatch(/map shows (no|nothing)|no main road|nothing on the map/i);
  });

  test('the training says the map can leave things out', () => {
    const { searchTraining } = require('@/app/lib/safetyRules');
    expect(searchTraining('Max').map((p) => p.text).join(' ')).toMatch(/that the map shows in your area\. The map can leave things out\./);
  });
});

