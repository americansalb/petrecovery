/**
 * What a search's own numbers say, for the desk
 * (app/mission-control/lib/insight.js). Every sentence here is a count, a
 * time, a distance or a published finding: none is advice and none is a
 * guess about where the pet is.
 */

import {
  RESEARCH,
  researchFor,
  coverage,
  durationWords,
  groundLines,
  directionWord,
  metersWords,
  sightingLines,
  streetFacts,
  stateWords,
  lookFirst,
  givenNext,
  whenWords,
  activity,
  missingFor,
} from '@/app/mission-control/lib/insight';

const ZONE = 'America/Chicago';
const NOW = new Date('2026-11-12T04:00:00Z').getTime(); // 10 pm Wednesday in Austin
const ago = (minutes) => new Date(NOW - minutes * 60000).toISOString();
const LOST = { lat: 30.3148, lng: -97.7459, at: ago(72 * 60), place: 'Sinclair Ave' };
// About 111 m of latitude per 0.001.
const south = (meters) => ({ lat: LOST.lat - meters / 111320, lng: LOST.lng });
const street = (over = {}) => ({ id: 'st-1', title: 'W 43rd St from Rosedale Ave to Shoalwood Ave', name: 'W 43rd St', minutes: 10, priority: 8, status: 'UNSEARCHED', center: south(120), ...over });

describe('the published findings', () => {
  test('each says what its study found, with the source, and nothing about this pet', () => {
    // With the study's own limits: whose dogs, how many, which year, and measured from home.
    expect(RESEARCH.DOG.line).toBe('In Dallas shelter records for the 2019 fiscal year, of 5,228 stray dogs returned to their owners, 42% were picked up within 400 feet of home and 70% within a mile.');
    expect(RESEARCH.CAT.line).toBe('In a study of missing cats, half of the cats found alive were within 50 metres of where they went missing, and 3 in 4 within 500 metres.');
    // A ring drawn on this pet's map carries its distance and nothing else: a share of dogs written on the map
    // would read as a claim about this pet, and the dog study measured from home, not from where a dog was lost.
    expect(RESEARCH.DOG.rings).toEqual([{ meters: 122, label: '400 ft' }, { meters: 1609, label: '1 mile' }]);
    expect(RESEARCH.CAT.rings).toEqual([{ meters: 50, label: '50 m' }, { meters: 500, label: '500 m' }]);
    expect(RESEARCH.DOG.show).toBe('Show 400 ft and 1 mile');
    expect(RESEARCH.CAT.show).toBe('Show 50 m and 500 m');
    expect(JSON.stringify([RESEARCH.DOG.rings, RESEARCH.CAT.rings, RESEARCH.DOG.show, RESEARCH.CAT.show])).not.toMatch(/%|half|dogs|cats/);
    for (const finding of Object.values(RESEARCH)) {
      expect(finding.source).toMatch(/\b20\d\d$/);
      expect(finding.url).toMatch(/^https:\/\/pmc\.ncbi\.nlm\.nih\.gov\/articles\/PMC\d+\/$/);
      expect(finding.line).not.toMatch(/\b(your|this) (dog|cat|pet)\b|probably|likely|will be/i);
    }
  });

  test('a species with no study gets none', () => {
    expect(researchFor('dog')).toBe(RESEARCH.DOG);
    expect(researchFor('CAT')).toBe(RESEARCH.CAT);
    expect(researchFor('BIRD')).toBeNull();
    expect(researchFor(null)).toBeNull();
  });
});

describe('the ground', () => {
  const items = [
    street({ id: 'a', status: 'SEARCHED', minutes: 10 }),
    street({ id: 'b', status: 'IN_PROGRESS', minutes: 20 }),
    street({ id: 'c', status: 'UNSEARCHED', minutes: 10 }),
    street({ id: 'd', status: 'UNSEARCHED', minutes: 25 }),
    street({ id: 'e', status: 'NEEDS_REVISIT', minutes: 15 }),
  ];

  test('counts each state once, and the walking left is what nobody has walked', () => {
    expect(coverage(items)).toEqual({ total: 5, searched: 1, done: 1, walking: 1, again: 1, open: 3, minutesLeft: 50, share: 0.2 });
    expect(coverage([])).toEqual({ total: 0, searched: 0, done: 0, walking: 0, again: 0, open: 0, minutesLeft: 0, share: 0 });
  });

  test('a street that was walked stays walked when it is put up for another look, or is on its second pass', () => {
    // The one walked street is marked for another look: it has still been walked once.
    const again = [street({ id: 'a', status: 'NEEDS_REVISIT', searchCount: 1 }), street({ id: 'b' }), street({ id: 'c' })];
    expect(coverage(again)).toMatchObject({ total: 3, searched: 1, done: 1, again: 1, open: 3 });
    expect(groundLines({ items: again, name: 'Max' })).toEqual([
      '1 of 3 streets has been walked.',
      'Walking the 3 still to walk takes one person about 30 minutes.',
      '1 street is marked for another look.',
    ]);
    // Someone is on its second pass: walked once, and being walked now. The bar's green does not count it twice.
    const second = [street({ id: 'a', status: 'IN_PROGRESS', searchCount: 1 }), street({ id: 'b' })];
    expect(coverage(second)).toMatchObject({ searched: 1, done: 0, walking: 1 });
    expect(groundLines({ items: second, name: 'Max' })[0]).toBe('1 of 2 streets has been walked, and 1 is being walked now.');
  });

  test('time, as people say it', () => {
    expect(durationWords(8)).toBe('about 10 minutes');
    expect(durationWords(40)).toBe('about 40 minutes');
    expect(durationWords(50)).toBe('about 50 minutes');
    expect(durationWords(60)).toBe('about 1 hour');
    expect(durationWords(95)).toBe('about an hour and a half');
    expect(durationWords(150)).toBe('about 2 and a half hours');
    expect(durationWords(420)).toBe('about 7 hours');
  });

  test('in sentences, and the only sum with people is a sum, with how many are on a street right now', () => {
    expect(groundLines({ items, name: 'Max' })).toEqual([
      '1 of 5 streets has been walked, and 1 is being walked now.',
      'Walking the 3 still to walk takes one person about 50 minutes.',
      '1 street is marked for another look.',
    ]);
    // Two people on streets now: the time for two, said as a sum and not as what those two will do next.
    const two = [...items, street({ id: 'f', status: 'IN_PROGRESS', minutes: 10 })];
    expect(groundLines({ items: two, name: 'Max' })[1]).toBe('Walking the 3 still to walk takes one person about 50 minutes, or 2 people about 25 minutes.');
    expect(groundLines({ items: two, name: 'Max' }).join(' ')).not.toMatch(/out now/);
    expect(groundLines({ items: [street(), street({ id: 'x' })], name: 'Max' })).toEqual(['2 streets around where Max was lost. None has been walked yet.', 'Walking the 2 still to walk takes one person about 20 minutes.']);
    expect(groundLines({ items: [], name: 'Max' })).toEqual([]);
  });

  test('one street or one block is said as one', () => {
    expect(groundLines({ items: [street()], unit: 'block', name: 'Max' })[0]).toBe('1 block around where Max was lost. It has not been walked yet.');
    expect(groundLines({ items: [street({ status: 'SEARCHED' })], name: 'Max' })).toEqual(['The one street has been walked.', 'Every street has been walked at least once.']);
    expect(groundLines({ items: [street({ status: 'IN_PROGRESS' })], name: 'Max' })).toEqual(['The one street is being walked now.']);
  });
});

describe('which way and how far', () => {
  test('the eight compass words', () => {
    const here = { lat: 30, lng: -97 };
    expect(directionWord(here, { lat: 30.01, lng: -97 })).toBe('north');
    expect(directionWord(here, { lat: 29.99, lng: -97 })).toBe('south');
    expect(directionWord(here, { lat: 30, lng: -96.99 })).toBe('east');
    expect(directionWord(here, { lat: 30, lng: -97.01 })).toBe('west');
    expect(directionWord(here, { lat: 30.01, lng: -96.9885 })).toBe('northeast');
    expect(directionWord(here, { lat: 29.99, lng: -97.0115 })).toBe('southwest');
  });

  test('distances rounded as people say them', () => {
    expect(metersWords(20)).toBe('under 50 m');
    expect(metersWords(123)).toBe('120 m');
    expect(metersWords(980)).toBe('980 m');
    // Never "1000 m".
    expect(metersWords(994)).toBe('990 m');
    expect(metersWords(995)).toBe('1.0 km');
    expect(metersWords(999.6)).toBe('1.0 km');
    expect(metersWords(1640)).toBe('1.6 km');
    expect(metersWords(NaN)).toBe('');
  });
});

describe('what the sightings have in common', () => {
  const seen = (minutes, at, over = {}) => ({ id: `s-${minutes}`, at: ago(minutes), ...at, place: 'W 42nd St', ...over });
  const say = (sightings) => sightingLines({ sightings, lastSeen: LOST, timeZone: ZONE, now: NOW, name: 'Max' });

  test('none', () => {
    expect(say([])).toEqual(['Nobody has reported seeing Max yet.']);
    expect(sightingLines({ sightings: [], lastSeen: null, name: 'Max' })).toEqual(['Nobody has reported seeing Max yet.']);
  });

  test('one: when, where, and how far from where the pet was lost', () => {
    expect(say([seen(30, south(300))])).toEqual(['1 sighting, at 9:30 pm on W 42nd St, 300 m south of where Max was lost.']);
    // Yesterday's is said with its day.
    expect(say([seen(26 * 60, south(300))])).toEqual(['1 sighting, on Tue at 8:00 pm on W 42nd St, 300 m south of where Max was lost.']);
  });

  test('a pattern is stated only where every sighting fits it', () => {
    // Three sightings, each farther south, all at night.
    const south3 = [seen(26 * 60, south(200)), seen(60, south(450)), seen(30, south(800))];
    expect(say(south3)).toEqual([
      '3 sightings since Tue 8:00 pm. The latest was at 9:30 pm on W 42nd St, 800 m south of where Max was lost.',
      'Each was farther from where Max was lost than the one before.',
      'All 3 were south of where Max was lost.',
      'All 3 were between 8 pm and 6 am.',
    ]);
    // One of them north: no direction is claimed. One nearer than the last: no "farther each time".
    const mixed = [seen(26 * 60, south(200)), seen(60, { lat: LOST.lat + 0.003, lng: LOST.lng }), seen(30, south(100))];
    expect(say(mixed)).toEqual(['3 sightings since Tue 8:00 pm. The latest was at 9:30 pm on W 42nd St, 100 m south of where Max was lost.', 'All 3 were between 8 pm and 6 am.']);
    // One in the afternoon: nothing is said about the time of day.
    const afternoon = [seen(7 * 60, south(200)), seen(30, south(500))];
    expect(say(afternoon)).toEqual(['2 sightings since 3:00 pm. The latest was at 9:30 pm on W 42nd St, 500 m south of where Max was lost.', 'Both were south of where Max was lost.']);
    // Both in the day: said as the hours they fall in, with no word about the light.
    const day = [seen(13 * 60, south(200)), seen(7 * 60, south(500))];
    expect(say(day)[2]).toBe('Both were between 6 am and 8 pm.');
    expect(say(day).join(' ')).not.toMatch(/daylight|dark/);
  });

  test('two sightings are not a trend: "farther each time" needs three', () => {
    const lines = say([seen(60, south(200)), seen(30, south(500))]);
    expect(lines.join(' ')).not.toMatch(/farther/);
  });

  test('it never says where the pet is, or is going', () => {
    const lines = say([seen(26 * 60, south(200)), seen(60, south(450)), seen(30, south(800))]).join(' ');
    expect(lines).not.toMatch(/\b(is heading|is moving|will|probably|likely|should|must|go to|look)\b/i);
  });
});

describe('one street', () => {
  const facts = (over, extra = {}) => streetFacts(street(over), { lastSeen: LOST, sightings: [], timeZone: ZONE, now: NOW, name: 'Max', ...extra });

  test('where it is, and that nobody has walked it', () => {
    expect(facts({})).toEqual(['120 m south of where Max was lost.', 'Nobody has walked this street.']);
    expect(facts({ center: south(10) })[0]).toBe('Right where Max was lost.');
  });

  test('a sighting next to it is said, and one far off is not', () => {
    const near = [{ id: 's', at: ago(30), ...south(200) }];
    // The street is 120 m south of where Max was lost, and the sighting 200 m south: 80 m apart.
    expect(facts({}, { sightings: near })).toContain('80 m from where Max was seen at 9:30 pm.');
    // It is named as far out as a fresh sighting moves a street up the order (300 m), and no farther.
    expect(facts({}, { sightings: [{ id: 's', at: ago(30), ...south(410) }] }).join(' ')).toMatch(/290 m from where Max was seen/);
    const far = [{ id: 's', at: ago(30), ...south(900) }];
    expect(facts({}, { sightings: far }).join(' ')).not.toMatch(/was seen/);
    // A street with a line of its own is measured from the line: seen at its far end is seen on it, however long it is.
    const long = { path: [[LOST.lat - 0.001, LOST.lng], [LOST.lat - 0.009, LOST.lng]], center: south(560) };
    expect(facts(long, { sightings: [{ id: 's', at: ago(30), ...south(990) }] })).toContain('Max was seen on it at 9:30 pm.');
    expect(facts(long, { sightings: [{ id: 's', at: ago(30), lat: LOST.lat - 0.008, lng: LOST.lng + 0.0012 }] }).join(' ')).toMatch(/1[12]0 m from where Max was seen at 9:30 pm\./);
    expect(facts({}, { sightings: [{ id: 's', at: ago(30), ...south(440) }] }).join(' ')).not.toMatch(/was seen/);
  });

  test('who and when, exactly as far as the board says who', () => {
    expect(facts({ status: 'IN_PROGRESS', claimedByName: 'Dana', claimedAt: ago(20) })).toContain('Dana has been on it since 9:40 pm.');
    expect(facts({ status: 'IN_PROGRESS', claimedAt: ago(20) })).toContain('Someone has been on it since 9:40 pm.');
    expect(facts({ status: 'SEARCHED', searchedByName: 'Sarah', searchedAt: ago(90), searchCount: 1 })).toContain('Sarah walked it at 8:30 pm.');
    expect(facts({ status: 'SEARCHED', searchedAt: ago(90), searchCount: 3 })).toContain('Someone walked it at 8:30 pm. It has been walked 3 times in all.');
    // Put down from the desk: said as that, never as the owner having walked it.
    expect(facts({ status: 'SEARCHED', searchedByName: 'Avery', searchedAt: ago(90), searchCount: 1, marked: true })).toContain('Avery put it down as walked at 8:30 pm, for someone who walked it without the site.');
    // A time on another day is said with its day, and an old one with its date.
    expect(facts({ status: 'SEARCHED', searchedByName: 'Sarah', searchedAt: ago(26 * 60), searchCount: 1 })).toContain('Sarah walked it on Tue at 8:00 pm.');
    expect(whenWords(ago(30), ZONE, NOW)).toBe('at 9:30 pm');
    expect(whenWords(ago(26 * 60), ZONE, NOW)).toBe('on Tue at 8:00 pm');
    expect(whenWords(ago(9 * 24 * 60), ZONE, NOW)).toBe('on Nov 2');
    expect(whenWords(null, ZONE, NOW)).toBe('');
    expect(facts({ status: 'NEEDS_REVISIT', searchedAt: ago(600), searchCount: 1 })).toContain('Marked for another look.');
  });

  test('its state in a few words', () => {
    expect(stateWords(street())).toBe('Not walked');
    expect(stateWords(street({ status: 'IN_PROGRESS', claimedByName: 'Dana' }))).toBe('Dana is on it');
    expect(stateWords(street({ status: 'IN_PROGRESS' }))).toBe('Being walked');
    expect(stateWords(street({ status: 'SEARCHED' }))).toBe('Walked');
    expect(stateWords(street({ status: 'NEEDS_REVISIT' }))).toBe('Another look');
    expect(stateWords(null)).toBe('');
  });
});

describe('where the search goes next, and what has happened', () => {
  test('streets nobody has walked, most urgent first', () => {
    const items = [street({ id: 'low', priority: 4 }), street({ id: 'done', status: 'SEARCHED', priority: 10 }), street({ id: 'top', priority: 10 }), street({ id: 'again', status: 'NEEDS_REVISIT', priority: 7 }), street({ id: 'held', status: 'IN_PROGRESS', priority: 9 })];
    expect(lookFirst(items).map((i) => i.id)).toEqual(['top', 'again', 'low']);
    // Among streets of the same urgency the board's own order is kept: it is the order they are handed out in.
    const tied = [street({ id: 'b', priority: 8, minutes: 30 }), street({ id: 'a', priority: 8, minutes: 5 }), street({ id: 'first', priority: 11, first: true })];
    expect(lookFirst(tied).map((i) => i.id)).toEqual(['first', 'b', 'a']);
  });

  test('"given out next" is every street as urgent as the most urgent, because a phone gives the nearest of them', () => {
    const tied = [street({ id: 'a', priority: 9 }), street({ id: 'b', priority: 9 }), street({ id: 'c', priority: 9 }), street({ id: 'd', priority: 9 }), street({ id: 'low', priority: 4 })];
    // Not the first three by name: any of the four can be the one a helper is given.
    expect(givenNext(tied).map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
    // One asked for first is alone at the top.
    expect(givenNext([...tied, street({ id: 'first', priority: 11, first: true })]).map((i) => i.id)).toEqual(['first']);
    // One kept for someone who was asked is not given to anyone else; a walked one or one being walked is not given out.
    expect(givenNext([street({ id: 'kept', priority: 10, reserved: true }), street({ id: 'held', priority: 10, status: 'IN_PROGRESS' }), street({ id: 'done', priority: 10, status: 'SEARCHED' }), street({ id: 'open', priority: 6 })]).map((i) => i.id)).toEqual(['open']);
    expect(givenNext([])).toEqual([]);
  });

  test('the log, newest first, with a name only where the board and the picture carry one', () => {
    const picture = {
      pet: { name: 'Max' },
      owner: { firstName: 'Avery' },
      lastSeen: LOST,
      sightings: [{ id: 's1', at: ago(30), place: 'W 42nd St', ownerGoingAt: ago(25) }],
      // The picture sends only what the owner wrote to everyone, so each is the owner's.
      updates: [{ id: 'u1', at: ago(50), text: 'He comes to his squeaky ball.' }],
    };
    const items = [street({ id: 'a', status: 'SEARCHED', searchedAt: ago(40), searchedByName: 'Sarah' }), street({ id: 'b', status: 'IN_PROGRESS', claimedAt: ago(10) }), street({ id: 'c', title: 'W 41st St', status: 'SEARCHED', searchedAt: ago(5), searchedByName: 'Avery', marked: true })];
    expect(activity({ items, picture, now: NOW }).map((e) => e.text)).toEqual([
      'Avery put W 41st St down as walked.',
      'Someone started W 43rd St from Rosedale Ave to Shoalwood Ave.',
      'Avery set off for it.',
      'Max was seen on W 42nd St.',
      'Sarah walked W 43rd St from Rosedale Ave to Shoalwood Ave.',
      'Avery: He comes to his squeaky ball.',
      'Max was lost near Sinclair Ave.',
    ]);
    expect(activity({ items: [], picture: null })).toEqual([]);
  });

  test('how long the pet has been missing', () => {
    expect(missingFor(ago(20), NOW)).toBe('20 min');
    expect(missingFor(ago(60), NOW)).toBe('1 hour');
    expect(missingFor(ago(26 * 60), NOW)).toBe('26 hours');
    expect(missingFor(ago(4 * 24 * 60), NOW)).toBe('4 days');
    expect(missingFor(null, NOW)).toBe('');
  });
});
