/**
 * The facts of a search, in sentences (app/mission-control/lib/words.js),
 * and the two places the screen takes words from someone else: the
 * searcher's brief and the owner's ask.
 */

import {
  clockTime,
  dayAndTime,
  agoWords,
  searchDay,
  petSub,
  placeWords,
  goingWords,
  standing,
  hotSighting,
  situationLine,
  lookingLine,
  neighborsLine,
  phoneWords,
  phoneTel,
} from '@/app/mission-control/lib/words';
import { searcherBrief } from '@/app/mission-control/lib/briefLines';
import { holdAskTextFor } from '@/app/mission-control/lib/ask';
import { briefFor } from '@/app/lib/brief';

jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: {} }));
import { holdAskText } from '@/app/lib/searchPicture';

const ZONE = 'America/Chicago';
const NOW = new Date('2026-11-11T04:10:00Z').getTime(); // 10:10 pm in Austin, Tuesday
const at = (iso) => new Date(iso).toISOString();

describe('times', () => {
  test('a clock time is read in the pet\'s own time zone', () => {
    expect(clockTime('2026-11-11T03:40:00Z', ZONE)).toBe('9:40 pm');
    expect(clockTime('2026-11-11T16:05:00Z', ZONE)).toBe('10:05 am');
    expect(clockTime(null, ZONE)).toBe('');
  });

  test('today is a time, this week is a day and a time, older is a date', () => {
    expect(dayAndTime('2026-11-11T03:40:00Z', ZONE, NOW)).toBe('9:40 pm');
    expect(dayAndTime('2026-11-10T01:10:00Z', ZONE, NOW)).toBe('Mon 7:10 pm');
    expect(dayAndTime('2026-10-20T01:10:00Z', ZONE, NOW)).toBe('Oct 19');
  });

  test('how long ago, in words', () => {
    expect(agoWords(NOW - 30 * 1000, NOW)).toBe('just now');
    expect(agoWords(NOW - 30 * 60000, NOW)).toBe('30 minutes ago');
    expect(agoWords(NOW - 60 * 60000, NOW)).toBe('1 hour ago');
    expect(agoWords(NOW - 5 * 3600000, NOW)).toBe('5 hours ago');
    expect(agoWords(NOW - 26 * 3600000, NOW)).toBe('1 day ago');
    expect(agoWords(NOW - 4 * 86400000, NOW)).toBe('4 days ago');
  });

  test('the day of the search counts the day it was lost as day 1', () => {
    expect(searchDay(NOW - 3600000, NOW)).toBe(1);
    expect(searchDay(NOW - 3.2 * 86400000, NOW)).toBe(4);
    expect(searchDay(null, NOW)).toBeNull();
  });
});

describe('who and where', () => {
  test('whose pet, and what it looks like', () => {
    expect(petSub({ owner: 'Avery', species: 'DOG', color: 'Black and tan' })).toBe("Avery's dog, black and tan");
    expect(petSub({ owner: 'Avery', species: 'DOG', color: 'Black and tan', breed: 'Shepherd mix' })).toBe("Avery's dog, black and tan shepherd mix");
    expect(petSub({ owner: 'Lena', species: 'CAT', color: 'Tabby', breed: 'Unknown' })).toBe("Lena's cat, tabby");
    expect(petSub({ species: 'DOG' })).toBe('Lost dog');
  });

  test('a corner is "at", a street is "on", anything else is "near"', () => {
    expect(placeWords('W 40th St and Ramsey Ave')).toBe('at W 40th St and Ramsey Ave');
    expect(placeWords('Ramsey Ave')).toBe('on Ramsey Ave');
    expect(placeWords('Zilker Park')).toBe('near Zilker Park');
    expect(placeWords('')).toBe('');
    expect(placeWords(null)).toBe('');
  });

  test('which way it went, by the street it took when the witness named one', () => {
    expect(goingWords({ direction: 'SOUTHEAST', toward: 'Rosedale Ave' })).toBe('going toward Rosedale Ave');
    expect(goingWords({ direction: 'NORTH', toward: null })).toBe('heading north');
    expect(goingWords({ direction: 'STAYING' })).toBe('staying there');
    expect(goingWords({})).toBe('');
    expect(goingWords(null)).toBe('');
  });

  test('a phone number as people read it, and as a phone dials it', () => {
    expect(phoneWords('5125550100')).toBe('(512) 555-0100');
    expect(phoneWords('+1 512 555 0100')).toBe('(512) 555-0100');
    expect(phoneWords('+44 20 7946 0958')).toBe('+44 20 7946 0958');
    expect(phoneTel('(512) 555-0100')).toBe('5125550100');
    expect(phoneTel('+44 20 7946 0958')).toBe('+442079460958');
  });
});

describe('sightings', () => {
  const seen = (minutesAgo, over = {}) => ({ id: `s-${minutesAgo}`, at: at(NOW - minutesAgo * 60000), lat: 30.31, lng: -97.74, place: 'W 40th St and Ramsey Ave', direction: null, toward: null, state: null, ...over });

  test('a sighting the witness took back does not stand', () => {
    const list = [seen(5, { state: 'NOT_THE_PET' }), seen(20)];
    expect(standing(list).map((s) => s.id)).toEqual(['s-20']);
    expect(hotSighting(list, NOW).id).toBe('s-20');
  });

  test('a sighting leads the screen for an hour', () => {
    expect(hotSighting([seen(59)], NOW)).not.toBeNull();
    expect(hotSighting([seen(61)], NOW)).toBeNull();
    expect(hotSighting([], NOW)).toBeNull();
  });
});

describe('situationLine: where the search stands, in one sentence', () => {
  const base = {
    open: true,
    reunited: false,
    timeZone: ZONE,
    pet: { name: 'Max' },
    lastSeen: { at: at(NOW - 30 * 60000), place: 'Sinclair Ave' },
    sightings: [],
  };

  test('lost, and nobody has seen it', () => {
    expect(situationLine(base, NOW)).toEqual({ text: 'Lost 30 minutes ago near Sinclair Ave. Nobody has seen Max since.', tone: 'lost' });
  });

  test('a fresh sighting takes the line and turns it orange', () => {
    const picture = { ...base, sightings: [{ id: 's', at: '2026-11-11T04:01:00Z', place: 'W 40th St and Ramsey Ave', direction: 'SOUTHEAST', toward: 'Rosedale Ave', state: 'WATCHING' }] };
    expect(situationLine(picture, NOW)).toEqual({ text: 'Seen at 10:01 pm at W 40th St and Ramsey Ave, going toward Rosedale Ave.', tone: 'seen' });
  });

  test('a sighting with no named place still says when', () => {
    const picture = { ...base, sightings: [{ id: 's', at: '2026-11-11T04:01:00Z', place: null, direction: null, toward: null, state: null }] };
    expect(situationLine(picture, NOW).text).toBe('Seen at 10:01 pm.');
  });

  test('the pet is with whoever found it', () => {
    const picture = { ...base, sightings: [{ id: 's', at: '2026-11-11T04:01:00Z', place: 'Ramsey Ave', state: 'WITH_WITNESS' }] };
    expect(situationLine(picture, NOW)).toEqual({ text: 'Max is with someone on Ramsey Ave, since 10:01 pm.', tone: 'seen' });
  });

  test('an older sighting is the last thing known', () => {
    const picture = { ...base, lastSeen: { at: at(NOW - 3 * 86400000), place: 'Sinclair Ave' }, sightings: [{ id: 's', at: '2026-11-10T01:10:00Z', place: 'Shoal Creek Blvd', state: null }] };
    expect(situationLine(picture, NOW).text).toBe('Lost 3 days ago near Sinclair Ave. Last seen Mon 7:10 pm on Shoal Creek Blvd.');
  });

  test('home, and ended', () => {
    expect(situationLine({ ...base, open: false, reunited: true }, NOW)).toEqual({ text: 'Max is home.', tone: 'home' });
    expect(situationLine({ ...base, open: false }, NOW)).toEqual({ text: 'This search has ended.', tone: 'closed' });
  });

  test('it states facts and tells nobody what to do', () => {
    const lines = [
      situationLine(base, NOW).text,
      situationLine({ ...base, sightings: [{ id: 's', at: at(NOW - 60000), place: 'Ramsey Ave', direction: 'NORTH', state: 'WATCHING' }] }, NOW).text,
      lookingLine(0),
      lookingLine(3),
      neighborsLine({ told: 38, answered: 0 }, 'Max'),
    ];
    for (const line of lines) expect(line).not.toMatch(/\b(stop|stay|wait|don't|do not|never|must|should)\b/i);
  });
});

describe('counts', () => {
  test('how many neighbors are out', () => {
    expect(lookingLine(0)).toBe('Nobody is out looking yet');
    expect(lookingLine(1)).toBe('1 neighbor is out looking');
    expect(lookingLine(3)).toBe('3 neighbors are out looking');
  });

  test('who was told, for the owner', () => {
    expect(neighborsLine({ told: 38, answered: 0 }, 'Max')).toBe('38 neighbors were alerted. None has answered yet. You are told the moment someone sees Max.');
    expect(neighborsLine({ told: 1, answered: 1 }, 'Max')).toBe('1 neighbor was alerted. 1 answered. You are told the moment someone sees Max.');
    expect(neighborsLine({ told: 0, answered: 0 }, 'Max')).toBe('');
    expect(neighborsLine(null, 'Max')).toBe('');
  });
});

describe('the searcher\'s brief on the screen is the site\'s brief, with one edit', () => {
  const picture = { pet: { name: 'Max', species: 'DOG', color: 'Black and tan', breed: 'Shepherd mix' } };
  const source = briefFor({ way: 'foot', pet: { petName: 'Max', petSpecies: 'DOG', petColor: 'Black and tan', petBreed: 'Shepherd mix' } });

  test('the only change is the button\'s name, so the sentence names the button on this screen', () => {
    const brief = searcherBrief(picture);
    expect(brief.look).toBe(source[1]);
    expect(brief.call).toBe(source[2]);
    expect(brief.never).toBe(source[3].split('"I saw Max"').join('"I\'ve seen Max"'));
    expect(brief.never).toBe('If you see Max, don\'t chase or call out. Sit down, look away, tap "I\'ve seen Max". The owner\'s voice is what Max comes to.');
    expect(brief.neverFirst).toBe("If you see Max, don't chase or call out.");
  });

  test('"Your path records as you go" is the brief\'s own sentence', () => {
    expect(searcherBrief(picture).records).toBe('Your path records as you go.');
    expect(source[0].endsWith('Your path records as you go.')).toBe(true);
  });

  test('a cat gets the cat\'s brief', () => {
    const cat = searcherBrief({ pet: { name: 'Mochi', species: 'CAT' } });
    expect(cat.look).toMatch(/^Look low and close/);
    expect(cat.never).toBe('If you see Mochi, don\'t chase. Note where and which way, tap "I\'ve seen Mochi", and keep your distance.');
  });
});

describe('the owner\'s ask', () => {
  test('the owner is shown exactly the words that go out in their name', () => {
    expect(holdAskTextFor('Max')).toBe(holdAskText('Max'));
    expect(holdAskTextFor('Max')).toBe('Please stay back while I go to Max.');
    expect(holdAskTextFor(null)).toBe(holdAskText(null));
  });
});
