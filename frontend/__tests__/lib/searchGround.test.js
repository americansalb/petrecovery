/**
 * What the search screen says about ground (app/mission-control/lib/ground.js).
 *
 * A search is a circle of ground in areas, not a list of streets: a pet
 * does not keep to streets. So every sentence here is about ground that
 * has or has not been searched, by whom and how many times. None says an
 * area is "done", none says where the pet is, and none tells a helper to
 * do anything: the actions are the owner asking or writing in their own name.
 */
import {
  isSeenCircle, circleAreas, areaName, AreaName, mapLabel, timesWords, listWords, whereWords, areaState, areaLine, areaFacts,
  groundCoverage, groundLines, givenNextAreas, minutesRange, quietGround, coveredWords, needsForGround, groundActivity, forAnyoneElse, whyThisArea,
} from '@/app/mission-control/lib/ground';

const ZONE = 'America/Chicago';
// 10:00 pm in Austin on the 11th.
const NOW = new Date('2026-11-12T04:00:00Z').getTime();
const ago = (minutes) => new Date(NOW - minutes * 60000).toISOString();
const LOST = { lat: 30.3148, lng: -97.7459 };
const CIRCLE = { center: LOST, inner: 150, edge: 400, wide: 800, radius: 400, widened: false };

const KEYS = { middle: ['The middle', 0, 0, 150, 0, 360, 30], north: ['North side', 1, 150, 400, 315, 45, 45], east: ['East side', 1, 150, 400, 45, 135, 45], south: ['South side', 1, 150, 400, 135, 225, 45], west: ['West side', 1, 150, 400, 225, 315, 45] };
const HEARTS = { middle: LOST, north: { lat: 30.31727, lng: -97.7459 }, east: { lat: 30.3148, lng: -97.74304 }, south: { lat: 30.31233, lng: -97.7459 }, west: { lat: 30.3148, lng: -97.74876 } };
function area(key, over = {}) {
  const [name, ring, from, to, a, b, minutes] = KEYS[key];
  const way = key === 'middle' ? null : key;
  return {
    id: `z-${key}`, key, ring, name, title: name,
    reach: ring === 0 ? 'Within 150 m of where Max was lost' : `150 m to 400 m ${way} of where Max was lost`,
    landmarks: [], center: HEARTS[key], from, to, a, b, minutes,
    priority: ring === 0 ? 8 : 6, first: false, status: 'UNSEARCHED', on: 0, coming: 0, full: false, reserved: false,
    claimedAt: null, searchedAt: null, searchCount: 0, marked: false, mine: false, ...over,
  };
}
const seenCircle = (over = {}) => ({
  id: 'z-seen', key: 'seen-s1', ring: 3, name: 'Where Max was seen', title: 'Where Max was seen', reach: 'Within 150 m of where Max was seen', landmarks: ['Ramsey Ave'],
  center: { lat: 30.3121, lng: -97.7457 }, from: 0, to: 150, a: 0, b: 360, minutes: 30, priority: 10, first: false, status: 'UNSEARCHED', on: 0, coming: 0, full: false,
  claimedAt: null, searchedAt: null, searchCount: 0, marked: false, mine: false, sightingId: 's1', sightingAt: ago(12), ...over,
});
const five = (over = {}) => ['middle', 'north', 'east', 'south', 'west'].map((key) => area(key, over[key] || {}));
const searched = (n, at, by = null) => ({ status: 'SEARCHED', searchCount: n, searchedAt: at, ...(by ? { searchedByName: by } : {}) });
const onIt = (names, since) => ({ status: 'IN_PROGRESS', on: names.length, claimedAt: since, who: names.map((name) => ({ name, handle: `h-${name}`, since })) });
const person = (name, over = {}) => ({ handle: `h-${name}`, name, kind: 'helper', joinedAt: ago(60), state: 'free', on: null, since: null, asked: null, walked: 0, lastWalkedAt: null, lastOn: null, ...over });
const picture = (over = {}) => ({
  id: 'case-max', open: true, timeZone: ZONE, pet: { name: 'Max', species: 'DOG' }, owner: { firstName: 'Avery' },
  lastSeen: { ...LOST, at: ago(180), place: 'Sinclair Ave' }, sightings: [], updates: [], viewer: { isOwner: true, leads: true, seesNames: true }, ...over,
});

describe('the names of things', () => {
  test('an area in a sentence, and at the start of one', () => {
    expect(areaName(area('west'))).toBe('the west side');
    expect(AreaName(area('west'))).toBe('The west side');
    expect(areaName(area('middle'))).toBe('the middle');
    expect(areaName(seenCircle())).toBe('where Max was seen');
  });

  test('the short name written on the map', () => {
    expect(mapLabel(area('middle'))).toBe('Middle');
    expect(mapLabel(area('north'))).toBe('North');
    expect(mapLabel({ key: 'outer-north-east', ring: 2, name: 'Far north-east' })).toBe('Far north-east');
    // A sighting's circle is named by the sighting's own mark.
    expect(mapLabel(seenCircle())).toBe('');
  });

  test('how many times, and a list of names', () => {
    expect([1, 2, 3, 7].map(timesWords)).toEqual(['once', 'twice', '3 times', '7 times']);
    expect(listWords(['Sarah'])).toBe('Sarah');
    expect(listWords(['Sarah', 'Mike'])).toBe('Sarah and Mike');
    expect(listWords(['Sarah', 'Mike', 'Jo'])).toBe('Sarah, Mike and Jo');
    expect(listWords([])).toBe('');
  });

  test('the circle round a sighting is not one of the circle\'s own areas', () => {
    expect(isSeenCircle(seenCircle())).toBe(true);
    expect(isSeenCircle(area('middle'))).toBe(false);
    expect(circleAreas([seenCircle(), ...five()]).map((a) => a.key)).toEqual(['middle', 'north', 'east', 'south', 'west']);
  });
});

describe('where an area is', () => {
  test('how far it reaches, and the streets that run through it, as landmarks', () => {
    expect(whereWords(area('west', { landmarks: ['Jefferson St', 'Shoal Creek Blvd'] }))).toBe('150 m to 400 m west of where Max was lost, around Jefferson St and Shoal Creek Blvd.');
    expect(whereWords(area('west', { landmarks: ['Jefferson St'] }))).toBe('150 m to 400 m west of where Max was lost, around Jefferson St.');
  });

  test('ground with no named street in it is still somewhere', () => {
    expect(whereWords(area('middle'))).toBe('Within 150 m of where Max was lost.');
  });

  test('nobody is told to walk a street', () => {
    const words = whereWords(area('west', { landmarks: ['Jefferson St', 'Shoal Creek Blvd'] }));
    expect(words).not.toMatch(/walk|along|down /i);
  });
});

describe('what has happened on an area', () => {
  test('nobody has searched it', () => {
    expect(areaState(area('west'))).toBe('Not searched');
    expect(areaLine(area('west'), { timeZone: ZONE, now: NOW })).toBe('Not searched yet.');
  });

  test('someone is on it: who, where the reader may know, and since when', () => {
    const east = area('east', onIt(['Sarah'], ago(25)));
    expect(areaState(east)).toBe('Sarah is searching it');
    expect(areaLine(east, { timeZone: ZONE, now: NOW })).toBe('Sarah is searching it, since 9:35 pm.');
    const two = area('east', onIt(['Sarah', 'Mike'], ago(25)));
    expect(areaState(two)).toBe('2 people on it');
    expect(areaLine(two, { timeZone: ZONE, now: NOW })).toBe('Sarah and Mike are searching it, since 9:35 pm.');
  });

  test('someone only looking is told how many, never who', () => {
    const east = area('east', { status: 'IN_PROGRESS', on: 1, claimedAt: ago(25) });
    expect(areaState(east)).toBe('Being searched');
    expect(areaLine(east, { timeZone: ZONE, now: NOW })).toBe('1 person is searching it, since 9:35 pm.');
    expect(areaLine(area('east', { status: 'IN_PROGRESS', on: 3, claimedAt: ago(25) }), { timeZone: ZONE, now: NOW })).toBe('3 people are searching it, since 9:35 pm.');
  });

  test('searched: how many times, when last, and by whom', () => {
    expect(areaState(area('north', searched(1, ago(105))))).toBe('Searched once');
    expect(areaLine(area('north', searched(1, ago(105), 'Mike')), { timeZone: ZONE, now: NOW })).toBe('Searched once, 2 hours ago at 8:15 pm, by Mike.');
    expect(areaLine(area('middle', searched(2, ago(80), 'Sarah')), { timeZone: ZONE, now: NOW })).toBe('Searched twice. Last 1 hour ago at 8:40 pm, by Sarah.');
    expect(areaLine(area('middle', searched(3, ago(80))), { timeZone: ZONE, now: NOW })).toBe('Searched 3 times. Last 1 hour ago at 8:40 pm.');
  });

  test('being searched again says it was searched before: an area is never "done"', () => {
    const again = area('middle', { ...onIt(['Sarah'], ago(5)), searchCount: 2 });
    expect(areaLine(again, { timeZone: ZONE, now: NOW })).toBe('Sarah is searching it, since 9:55 pm. Searched twice before.');
    for (const a of [area('west'), area('north', searched(1, ago(10))), again]) {
      expect(`${areaState(a)} ${areaLine(a, { timeZone: ZONE, now: NOW })}`).not.toMatch(/\bdone\b|finished|complete|cleared/i);
    }
  });

  test('ground put down from the desk is said as that, never as that person having searched it', () => {
    const marked = area('east', { ...searched(1, ago(30), 'Avery'), marked: true });
    expect(areaLine(marked, { timeZone: ZONE, now: NOW })).toBe('Searched once, 30 minutes ago at 9:30 pm, put down by Avery.');
  });

  test('up for another look', () => {
    const again = area('north', { ...searched(1, ago(105), 'Mike'), status: 'NEEDS_REVISIT' });
    expect(areaState(again)).toBe('Another look');
    expect(areaLine(again, { timeZone: ZONE, now: NOW })).toBe('Searched once, 2 hours ago at 8:15 pm, by Mike. Down for another look.');
  });

  test('the circle round a sighting: who is there, or that the owner set off for it', () => {
    expect(areaLine(seenCircle(), { timeZone: ZONE, now: NOW })).toBe('Nobody has gone there yet.');
    const there = seenCircle(onIt(['Dana'], ago(8)));
    expect(areaState(there)).toBe('Dana is there');
    expect(areaLine(there, { timeZone: ZONE, now: NOW })).toBe('Dana is there, since 9:52 pm.');
    const going = seenCircle({ going: { at: ago(8) } });
    expect(areaLine(going, { timeZone: ZONE, now: NOW, owner: 'Avery' })).toBe('Avery set off for it at 9:52 pm.');
    expect(areaLine(going, { timeZone: ZONE, now: NOW, owner: 'Avery', isOwner: true })).toBe('You set off for it at 9:52 pm.');
  });
});

describe('the card of one area', () => {
  test('where it is and how long it takes one person, then what has happened on it', () => {
    const west = area('west', { landmarks: ['Jefferson St', 'Shoal Creek Blvd'] });
    expect(areaFacts(west, { picture: picture(), circle: CIRCLE, now: NOW })).toEqual(['150 m to 400 m west of where Max was lost, around Jefferson St and Shoal Creek Blvd. About 45 minutes for one person.', 'Not searched yet.']);
  });

  test('it says when the pet was seen in it', () => {
    const seen = { id: 's1', lat: LOST.lat - 300 / 111320, lng: LOST.lng, at: ago(12), place: 'Ramsey Ave' };
    const facts = areaFacts(area('south'), { picture: picture({ sightings: [seen] }), circle: CIRCLE, now: NOW });
    expect(facts).toContain('Max was seen in it at 9:48 pm.');
    // And only in the area it was seen in.
    expect(areaFacts(area('north'), { picture: picture({ sightings: [seen] }), circle: CIRCLE, now: NOW }).join(' ')).not.toMatch(/was seen in it/);
  });

  test('who was asked, and that the next people are sent there first', () => {
    const west = area('west', { first: true, asked: [{ name: 'Jo', handle: 'h-Jo', at: ago(4), seenAt: ago(3), holds: true }] });
    const facts = areaFacts(west, { picture: picture(), circle: CIRCLE, now: NOW });
    expect(facts).toContain('Jo was asked to search it at 9:56 pm and has seen that.');
    expect(facts).toContain('The next people who ask for ground are sent here first.');
  });
});

describe('the ground in numbers and sentences', () => {
  test('nothing searched yet', () => {
    expect(groundLines({ areas: five(), circle: CIRCLE, name: 'Max' })).toEqual(['5 areas of ground within 400 m of where Max was lost. None has been searched yet.', 'Searching the 5 left takes one person about 3 and a half hours.']);
  });

  test('some searched, one being searched: what is left is what nobody has searched or is on', () => {
    const areas = five({ middle: searched(2, ago(80)), north: searched(1, ago(105)), east: onIt(['Sarah'], ago(25)) });
    expect(groundCoverage(areas, NOW)).toEqual({ total: 5, searched: 2, done: 2, searching: 1, again: 0, faded: 0, left: 2, minutesLeft: 90, people: 1 });
    expect(groundLines({ areas, circle: CIRCLE, name: 'Max' })).toEqual(['2 of the 5 areas within 400 m have been searched, and 1 is being searched now.', 'Searching the 2 left takes one person about an hour and a half.']);
  });

  test('one searched reads in the singular', () => {
    expect(groundLines({ areas: five({ middle: searched(1, ago(80)) }), circle: CIRCLE, name: 'Max' })[0]).toBe('1 of the 5 areas within 400 m has been searched.');
  });

  test('all searched says "at least once", and never that the search is over', () => {
    const all = five({ middle: searched(3, ago(10)), north: searched(1, ago(105)), east: searched(1, ago(50)), south: searched(2, ago(40)), west: searched(1, ago(75)) });
    const lines = groundLines({ areas: all, circle: CIRCLE, name: 'Max' });
    expect(lines).toEqual(['All 5 areas within 400 m have been searched at least once.']);
    expect(lines.join(' ')).not.toMatch(/\bdone\b|finished|complete|nothing left/i);
  });

  test('up for another look is counted and said', () => {
    const areas = five({ middle: { ...searched(1, ago(80)), status: 'NEEDS_REVISIT' }, north: { ...searched(1, ago(80)), status: 'NEEDS_REVISIT' } });
    expect(groundLines({ areas, circle: CIRCLE, name: 'Max' })).toContain('2 areas are down for another look.');
  });

  test('a sighting\'s circle is not one of the five, and whoever is at it is still out', () => {
    const areas = [seenCircle(onIt(['Dana'], ago(8))), ...five({ east: onIt(['Sarah'], ago(25)) })];
    expect(groundCoverage(areas)).toMatchObject({ total: 5, searching: 1, people: 2 });
  });

  test('a wider search says how wide', () => {
    expect(groundLines({ areas: five(), circle: { ...CIRCLE, radius: 800, widened: true }, name: 'Max' })[0]).toMatch(/within 800 m of where Max was lost/);
  });

  test('no areas, no sentences', () => {
    expect(groundLines({ areas: [], circle: CIRCLE })).toEqual([]);
  });
});

describe('what is given out next', () => {
  test('the most urgent ground nobody is on', () => {
    expect(givenNextAreas(five()).map((a) => a.key)).toEqual(['middle']);
  });

  test('all of them where several are as urgent as each other: a phone gives the nearest, which a desk cannot know', () => {
    expect(givenNextAreas(five({ middle: searched(1, ago(10)) })).map((a) => a.key)).toEqual(['north', 'east', 'south', 'west']);
  });

  test('ground someone is on, or on the way to, waits behind ground nobody is on', () => {
    expect(givenNextAreas(five({ middle: onIt(['Sarah'], ago(5)) })).map((a) => a.key)).toEqual(['north', 'east', 'south', 'west']);
    expect(givenNextAreas(five({ middle: { coming: 1 } })).map((a) => a.key)).toEqual(['north', 'east', 'south', 'west']);
  });

  test('with everything searched, the one searched longest ago: there is always ground to give', () => {
    const all = five({ middle: searched(2, ago(10)), north: searched(1, ago(105)), east: searched(1, ago(50)), south: searched(1, ago(40)), west: searched(1, ago(75)) });
    expect(givenNextAreas(all).map((a) => a.key)).toEqual(['north']);
  });

  test('never a sighting\'s circle that has its one person; first when it has nobody', () => {
    expect(givenNextAreas([seenCircle({ full: true, ...onIt(['Dana'], ago(8)) }), ...five()]).map((a) => a.key)).toEqual(['middle']);
    expect(givenNextAreas([seenCircle(), ...five()]).map((a) => a.key)).toEqual(['seen-s1']);
    // The side the pet was seen in is as urgent while the sighting is fresh, and still comes after the circle.
    expect(givenNextAreas([seenCircle(), ...five({ south: { priority: 10 } })]).map((a) => a.key)).toEqual(['seen-s1']);
    expect(quietGround({ areas: [seenCircle(), ...five({ south: { priority: 10 } })], people: [] })).toBe('Nobody is out right now. The next person who asks is given where Max was seen.');
  });

  test('it is what anyone else would be given, whatever the reader is on', () => {
    expect(givenNextAreas(five({ middle: { mine: true } })).map((a) => a.key)).toEqual(['middle']);
  });

  test('ground the owner asked for first stays next while someone is on it, as its card says', () => {
    const first = { first: true, priority: 11, ...onIt(['Sarah'], ago(5)) };
    expect(givenNextAreas(five({ north: first })).map((a) => a.key)).toEqual(['north']);
    expect(quietGround({ areas: five({ north: first }), people: [person('Sarah', { state: 'walking' })] })).toBe('1 person is out searching. The next person who asks is given the north side.');
    expect(areaFacts(area('north', first), { picture: picture(), circle: CIRCLE, now: NOW })).toContain('The next people who ask for ground are sent here first.');
  });

  test('ground up for another look stays ahead of searched ground while someone is on it', () => {
    const all = { middle: searched(2, ago(10)), north: searched(1, ago(105)), east: searched(1, ago(50)), south: searched(1, ago(40)), west: searched(1, ago(75)) };
    // The east side was put up for another look and Sarah started it. The board says "being searched", and `again` that it still needs it.
    const areas = five({ ...all, east: { ...searched(1, ago(50)), ...onIt(['Sarah'], ago(5)), again: true } });
    expect(givenNextAreas(areas).map((a) => a.key)).toEqual(['east']);
  });

  test('a sighting\'s circle the owner set off for, or the reader is at, is given to nobody else: it is never named as next', () => {
    // The board sends `full` for the person reading it, and the owner's own setting off does not keep the owner out.
    const going = seenCircle({ going: { at: ago(8) }, full: false });
    expect(givenNextAreas([going, ...five()]).map((a) => a.key)).toEqual(['middle']);
    expect(quietGround({ areas: [going, ...five()], people: [] })).toBe('Nobody is out right now. The next person who asks is given the middle.');
    // The reader is the one there.
    const mine = seenCircle({ mine: true, full: false, status: 'IN_PROGRESS', on: 1 });
    expect(givenNextAreas([mine, ...five()]).map((a) => a.key)).toEqual(['middle']);
    expect(forAnyoneElse([going, mine, area('west', { mine: true, askedOfMe: true })]).map((a) => [a.full, a.mine, Boolean(a.askedOfMe)])).toEqual([[true, false, false], [true, false, false], [false, false, false]]);
  });

  test('and no free person is offered it', () => {
    const seen = { id: 's1', lat: LOST.lat - 300 / 111320, lng: LOST.lng, at: ago(200), place: 'Ramsey Ave', ownerGoingAt: ago(8) };
    // The sighting is too old for its own card, and its circle is still on the board with the owner on the way.
    const cards = needsForGround({ picture: picture({ sightings: [seen] }), areas: [seenCircle({ going: { at: ago(8) }, full: false }), ...five()], circle: CIRCLE, people: [person('Jo', { joinedAt: ago(4) })], words: [], leads: true, now: NOW });
    const free = cards.find((c) => c.kind === 'free');
    expect(free.primary).toEqual({ words: 'Ask Jo to search the middle', do: { type: 'ask', handle: 'h-Jo', areaId: 'z-middle' } });
  });

  test('how long the ground that could be given takes', () => {
    expect(minutesRange(five())).toBe('30 to 45');
    expect(minutesRange(five({ middle: searched(1, ago(10)) }))).toBe('45');
    expect(minutesRange([])).toBe('');
  });

  test('what the desk says when nothing is waiting', () => {
    expect(quietGround({ areas: five(), people: [] })).toBe('Nobody is out right now. The next person who asks is given the middle.');
    expect(quietGround({ areas: five({ middle: searched(1, ago(10)) }), people: [person('Sarah', { state: 'walking' })] })).toBe('1 person is out searching. The next person who asks is given the nearest of the 4 most urgent areas.');
    expect(quietGround({ areas: [], people: [person('Sarah', { state: 'walking' }), person('Mike', { state: 'walking' })] })).toBe('2 people are out searching.');
  });
});

describe('"Needs you" on ground', () => {
  const base = (over = {}) => ({ picture: picture(), areas: five(), circle: CIRCLE, people: [], words: [], leads: true, put: new Set(), now: NOW, ...over });

  test('only for whoever runs the search, and only while it is open', () => {
    const people = [person('Jo', { joinedAt: ago(5) })];
    expect(needsForGround(base({ people, leads: false }))).toEqual([]);
    expect(needsForGround(base({ people, picture: picture({ open: false }) }))).toEqual([]);
    expect(needsForGround(base({ people }))).toHaveLength(1);
  });

  test('someone free is offered ground: one button asks them, and the card says why that area', () => {
    const [card] = needsForGround(base({ areas: five({ middle: searched(1, ago(30)) }), people: [person('Jo', { joinedAt: ago(4) })] }));
    expect(card).toMatchObject({
      id: 'free-h-Jo', kind: 'free', label: 'No area yet', title: 'Jo joined 4 minutes ago', body: 'The north side has not been searched.',
      primary: { words: 'Ask Jo to search the north side', do: { type: 'ask', handle: 'h-Jo', areaId: 'z-north' } },
    });
    expect(card.more.map((m) => m.words)).toEqual(['Pick another area', 'Not now']);
    expect(card.more[0].do).toEqual({ type: 'give', handle: 'h-Jo', areaId: 'z-north' });
  });

  test('two free people are offered different ground', () => {
    const cards = needsForGround(base({ people: [person('Jo', { joinedAt: ago(4) }), person('Priya', { joinedAt: ago(6) })] }));
    expect(cards.map((c) => c.primary.words)).toEqual(['Ask Jo to search the middle', 'Ask Priya to search the north side']);
  });

  test('someone who just joined is left a moment, and someone long gone is not offered anything', () => {
    expect(needsForGround(base({ people: [person('Jo', { joinedAt: ago(1) })] }))).toEqual([]);
    expect(needsForGround(base({ people: [person('Jo', { joinedAt: ago(200) })] }))).toEqual([]);
  });

  test('the reason is the reason: another look, room for one more, or when it was last searched', () => {
    const body = (areas) => needsForGround(base({ areas, people: [person('Jo', { joinedAt: ago(4) })] }))[0].body;
    const all = { middle: searched(2, ago(10)), north: searched(1, ago(105)), east: searched(1, ago(50)), south: searched(1, ago(40)), west: searched(1, ago(75)) };
    expect(body(five({ ...all, east: { ...searched(1, ago(50)), status: 'NEEDS_REVISIT' } }))).toBe('The east side is down for another look.');
    expect(body(five({ ...all, north: { ...onIt(['Sarah'], ago(5)), searchCount: 0 } }))).toBe('The north side has 1 person on it, and room for more.');
    expect(body(five(all))).toBe('Every area has been searched. The north side was last searched at 8:15 pm.');
  });

  test('a reason is about the area offered, and never speaks for the areas it was not', () => {
    // Five free people, the middle searched and the four sides not: the fifth is offered the middle.
    const people = ['Jo', 'Priya', 'Sam', 'Lee', 'Kit'].map((name, i) => person(name, { joinedAt: ago(4 + i) }));
    const cards = needsForGround(base({ areas: five({ middle: searched(1, ago(20)) }), people })).filter((c) => c.kind === 'free');
    expect(cards.slice(0, 4).map((c) => c.body)).toEqual(['The north side has not been searched.', 'The east side has not been searched.', 'The south side has not been searched.', 'The west side has not been searched.']);
    // Four areas have not been searched, so nothing says every area has.
    expect(cards[4].body).toBe('The middle was last searched at 9:40 pm.');
    expect(cards.map((c) => c.body).join(' ')).not.toMatch(/Every area/);
  });

  test('the circle round a sighting: nobody has gone, or it has been searched, said as what happened', () => {
    const say = (ring, extra = {}) => whyThisArea(ring, { name: 'Max', timeZone: ZONE, now: NOW, ...extra });
    expect(say(seenCircle())).toBe('Nobody has gone to where Max was seen.');
    // Someone went and searched it: "nobody has gone" would be false.
    expect(say(seenCircle(searched(1, ago(25))))).toBe('Where Max was seen was last searched at 9:35 pm.');
    expect(say(seenCircle({ ...searched(1, ago(25)), status: 'NEEDS_REVISIT' }))).toBe('Where Max was seen is down for another look.');
    expect(say(area('west', searched(2, null)))).toBe('The west side has been searched twice.');
    expect(say(area('west'))).toBe('The west side has not been searched.');
    expect(say(null)).toBe('');
  });

  test('a fresh sighting comes first: who is there, and that one person goes', () => {
    const seen = { id: 's1', lat: LOST.lat - 300 / 111320, lng: LOST.lng, at: ago(12), place: 'W 42nd St and Ramsey Ave' };
    const ring = seenCircle({ ...onIt(['Dana'], ago(8)), full: true });
    const [card] = needsForGround(base({ picture: picture({ sightings: [seen] }), areas: [ring, ...five()], people: [person('Dana', { state: 'walking', on: { unit: 'area', id: 'z-seen', title: 'Where Max was seen' }, since: ago(8) })] }));
    expect(card).toMatchObject({
      id: 'seen-s1', kind: 'sighting', tone: 'seen', label: 'Sighting · 12 minutes ago', title: 'Seen at W 42nd St and Ramsey Ave',
      body: '300 m south of where Max was lost. Dana is there. One person goes to a sighting, never a group.',
      primary: { words: 'Write to Dana', do: { type: 'write', handle: 'h-Dana' } },
    });
    expect(card.more).toEqual([{ words: 'Show it on the map', do: { type: 'show', sightingId: 's1' } }]);
  });

  test('with nobody there, one named free person is asked to go, and nobody else', () => {
    const seen = { id: 's1', lat: LOST.lat - 300 / 111320, lng: LOST.lng, at: ago(12), place: 'Ramsey Ave' };
    const cards = needsForGround(base({ picture: picture({ sightings: [seen] }), areas: [seenCircle(), ...five()], people: [person('Jo', { joinedAt: ago(4) })] }));
    expect(cards[0].body).toBe('300 m south of where Max was lost. Jo is free. One person goes to a sighting, never a group.');
    expect(cards[0].primary).toEqual({ words: 'Ask Jo to go', do: { type: 'ask', handle: 'h-Jo', areaId: 'z-seen' } });
    // One card about Jo, and a second free person is offered other ground: nobody is asked to the sighting twice.
    const two = needsForGround(base({ picture: picture({ sightings: [seen] }), areas: [seenCircle(), ...five()], people: [person('Jo', { joinedAt: ago(4) }), person('Priya', { joinedAt: ago(6) })] }));
    expect(two.map((c) => c.primary.words)).toEqual(['Ask Jo to go', 'Ask Priya to search the middle']);
  });

  test('a sighting past its hour has no card of its own, so a free person is offered its circle while nobody has gone', () => {
    const seen = { id: 's1', lat: LOST.lat - 300 / 111320, lng: LOST.lng, at: ago(90), place: 'Ramsey Ave' };
    const [card] = needsForGround(base({ picture: picture({ sightings: [seen] }), areas: [seenCircle({ sightingAt: ago(90) }), ...five()], people: [person('Jo', { joinedAt: ago(4) })] }));
    expect(card).toMatchObject({ kind: 'free', body: 'Nobody has gone to where Max was seen.', primary: { words: 'Ask Jo to go there', do: { type: 'ask', handle: 'h-Jo', areaId: 'z-seen' } } });
  });

  test('both: the owner set off and asked someone to go. The ask is the owner\'s own word, and both are said', () => {
    const seen = { id: 's1', lat: LOST.lat - 300 / 111320, lng: LOST.lng, at: ago(12), place: 'Ramsey Ave', ownerGoingAt: ago(8) };
    const ring = seenCircle({ going: { at: ago(8) }, asked: [{ name: 'Jo', handle: 'h-Jo', at: ago(3), seenAt: ago(2), holds: true }], coming: 1, full: true });
    const [card] = needsForGround(base({ picture: picture({ sightings: [seen] }), areas: [ring, ...five()] }));
    // Two people are going, by the owner's own word: the card does not go on to say that one person goes.
    expect(card.body).toBe('300 m south of where Max was lost. You set off for it at 9:52 pm. Jo was asked to go at 9:57 pm and has seen that. Nobody else is given it.');
    expect(card.body).not.toMatch(/One person goes/);
  });

  test('when the owner set off, or someone was asked, the card says so and asks nobody else', () => {
    const seen = { id: 's1', lat: LOST.lat - 300 / 111320, lng: LOST.lng, at: ago(12), place: 'Ramsey Ave', ownerGoingAt: ago(8) };
    const going = needsForGround(base({ picture: picture({ sightings: [seen] }), areas: [seenCircle({ going: { at: ago(8) }, full: false }), ...five()], people: [person('Jo', { joinedAt: ago(4) })] }))[0];
    expect(going.body).toBe('300 m south of where Max was lost. You set off for it at 9:52 pm. One person goes to a sighting, never a group.');
    expect(going.primary.do.type).toBe('show');
    const asked = needsForGround(base({ picture: picture({ sightings: [{ ...seen, ownerGoingAt: null }] }), areas: [seenCircle({ asked: [{ name: 'Jo', handle: 'h-Jo', at: ago(3), seenAt: null, holds: true }] }), ...five()] }))[0];
    expect(asked.body).toBe('300 m south of where Max was lost. Jo was asked to go at 9:57 pm. One person goes to a sighting, never a group.');
    expect(asked.primary.do.type).toBe('show');
  });

  test('with nobody free, the next person who asks is given it, which the card says', () => {
    const seen = { id: 's1', lat: LOST.lat - 300 / 111320, lng: LOST.lng, at: ago(12), place: 'Ramsey Ave' };
    const [card] = needsForGround(base({ picture: picture({ sightings: [seen] }), areas: [seenCircle(), ...five()] }));
    expect(card.body).toBe('300 m south of where Max was lost. Nobody is free right now. The next person who asks for ground is given it.');
  });

  test('a sighting more than an hour old is on the map and in the messages, not here', () => {
    const seen = { id: 's1', lat: LOST.lat - 300 / 111320, lng: LOST.lng, at: ago(70), place: 'Ramsey Ave' };
    expect(needsForGround(base({ picture: picture({ sightings: [seen] }) }))).toEqual([]);
  });

  test('a helper\'s word nobody has answered: their words in quotation marks, and what they were about outside them', () => {
    const words = [{ id: 'm1', at: ago(2), text: "I can't right now.", about: 'the west side', from: 'Mike', fromHandle: 'h-Mike', fromDesk: false, mine: false }];
    const [card] = needsForGround(base({ words }));
    expect(card).toMatchObject({ id: 'word-m1', kind: 'word', label: 'From Mike · 9:58 pm', body: '"I can\'t right now."\nAbout the west side.', primary: { words: 'Answer Mike', do: { type: 'write', handle: 'h-Mike' } } });
  });

  test('every area searched: widen the search, or search these again', () => {
    const all = five({ middle: searched(3, ago(10)), north: searched(1, ago(105)), east: searched(1, ago(50)), south: searched(2, ago(40)), west: searched(1, ago(75)) });
    const [card] = needsForGround(base({ areas: all }));
    expect(card).toMatchObject({
      id: 'covered', kind: 'covered', label: 'The circle is covered', title: 'Every area within 400 m has been searched',
      body: 'The middle 3 times, the south side twice, the rest once. Widening adds 8 areas, from 400 m to 800 m.',
      primary: { words: 'Widen to 800 m', do: { type: 'widen' } },
    });
    expect(card.more.map((m) => m.words)).toEqual(['Search these again', 'Not now']);
    expect(card.more[0].do).toEqual({ type: 'againAll' });
    // Put away, it comes back when another search is counted.
    const key = card.more[1].do.key;
    expect(needsForGround(base({ areas: all, put: new Set([key]) }))).toEqual([]);
    const more = five({ middle: searched(4, ago(1)), north: searched(1, ago(105)), east: searched(1, ago(50)), south: searched(2, ago(40)), west: searched(1, ago(75)) });
    expect(needsForGround(base({ areas: more, put: new Set([key]) }))).toHaveLength(1);
  });

  test('once widened and covered, the one thing left is to search again', () => {
    const all = five({ middle: searched(1, ago(10)), north: searched(1, ago(105)), east: searched(1, ago(50)), south: searched(1, ago(40)), west: searched(1, ago(75)) });
    const [card] = needsForGround(base({ areas: all, circle: { ...CIRCLE, radius: 800, widened: true } }));
    expect(card.title).toBe('Every area within 800 m has been searched');
    expect(card.body).toBe('Each once.');
    expect(card.primary).toEqual({ words: 'Search these again', do: { type: 'againAll' } });
    expect(card.more.map((m) => m.words)).toEqual(['Not now']);
  });

  test('not while any area is unsearched or already up for another look', () => {
    const most = five({ middle: searched(1, ago(10)), north: searched(1, ago(105)), east: searched(1, ago(50)), south: searched(1, ago(40)) });
    expect(needsForGround(base({ areas: most }))).toEqual([]);
    const again = five({ middle: { ...searched(1, ago(10)), status: 'NEEDS_REVISIT' }, north: searched(1, ago(105)), east: searched(1, ago(50)), south: searched(1, ago(40)), west: searched(1, ago(75)) });
    expect(needsForGround(base({ areas: again }))).toEqual([]);
  });

  test('someone out much longer than their area takes', () => {
    const sarah = person('Sarah', { state: 'walking', on: { unit: 'area', id: 'z-east', title: 'East side' }, since: ago(120) });
    const [card] = needsForGround(base({ areas: five({ east: onIt(['Sarah'], ago(120)) }), people: [sarah] }));
    expect(card).toMatchObject({ id: 'long-h-Sarah', label: 'Out a long time', title: 'Sarah started the east side 120 minutes ago', body: 'It takes about 45 minutes.', primary: { words: 'Write to Sarah' } });
    // A careful search is never flagged: twice the area's time and a quarter of an hour.
    expect(needsForGround(base({ areas: five({ east: onIt(['Sarah'], ago(100)) }), people: [{ ...sarah, since: ago(100) }] }))).toEqual([]);
  });

  test('no card tells anyone to stop, wait or hold back, and none says where the pet is', () => {
    const seen = { id: 's1', lat: LOST.lat - 300 / 111320, lng: LOST.lng, at: ago(12), place: 'Ramsey Ave' };
    const all = five({ middle: searched(3, ago(10)), north: searched(1, ago(105)), east: searched(1, ago(50)), south: searched(2, ago(40)), west: searched(1, ago(75)) });
    const cards = [
      ...needsForGround(base({ picture: picture({ sightings: [seen] }), areas: [seenCircle(), ...five()], people: [person('Jo', { joinedAt: ago(4) }), person('Sarah', { state: 'walking', on: { unit: 'area', id: 'z-east', title: 'East side' }, since: ago(200) })] })),
      ...needsForGround(base({ areas: all })),
    ];
    const said = cards.map((c) => `${c.label} ${c.title} ${c.body} ${c.primary.words} ${c.more.map((m) => m.words).join(' ')}`).join(' ');
    expect(said).not.toMatch(/\b(stop|wait|hold|stay|do not|don't|probably|likely|should|must|is heading)\b/i);
  });
});

describe('what happened, for the messages', () => {
  test('who started and who searched which area, and ground put down from the desk said as that', () => {
    const areas = [area('east', onIt(['Sarah'], ago(25))), area('north', searched(1, ago(105), 'Mike')), area('west', { ...searched(1, ago(30), 'Avery'), marked: true }), seenCircle(onIt(['Dana'], ago(8)))];
    const events = groundActivity({ areas, picture: picture(), now: NOW });
    expect(events.map((e) => e.text)).toEqual(['Dana went to where Max was seen.', 'Sarah started the east side.', 'Avery put the west side down as searched.', 'Mike searched the north side.', 'Max was lost near Sinclair Ave.']);
    // Each can be clicked to see its area on the map.
    expect(events.find((e) => e.text.startsWith('Sarah')).streetId).toBe('z-east');
  });

  test('without names it says someone, never a made-up name', () => {
    const events = groundActivity({ areas: [area('east', { status: 'IN_PROGRESS', on: 1, claimedAt: ago(25) }), area('north', searched(1, ago(105)))], picture: picture({ viewer: null }), now: NOW });
    expect(events.map((e) => e.text).slice(0, 2)).toEqual(['Someone started the east side.', 'Someone searched the north side.']);
  });

  test('how often each was searched, in words', () => {
    const all = five({ middle: searched(3, ago(10)), north: searched(1, ago(105)), east: searched(1, ago(50)), south: searched(2, ago(40)), west: searched(1, ago(75)) });
    expect(coveredWords(all)).toBe('The middle 3 times, the south side twice, the rest once.');
    expect(coveredWords(five({ middle: searched(1, ago(10)), north: searched(1, ago(105)), east: searched(1, ago(50)), south: searched(1, ago(40)), west: searched(1, ago(75)) }))).toBe('Each once.');
    expect(coveredWords(five({ middle: searched(2, ago(10)), north: searched(2, ago(105)), east: searched(2, ago(50)), south: searched(2, ago(40)), west: searched(1, ago(75)) }))).toBe('The west side once, the rest more.');
  });
});
