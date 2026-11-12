/**
 * What the desk says about the people on a search, and what a helper's
 * card shows of what was said to them (app/mission-control/lib/team.js).
 */

import { personLine, shortTitle, outLong, grouped, wordsForCard, wordsForOwner, wordFrom, stream, unanswered, WORD_FRESH_MS } from '@/app/mission-control/lib/team';

const ZONE = 'America/Chicago';
const NOW = new Date('2026-11-13T04:00:00Z').getTime(); // 10 pm Thursday in Austin
const ago = (minutes) => new Date(NOW - minutes * 60000).toISOString();
const at = { timeZone: ZONE, now: NOW };

describe('one person, in a line', () => {
  test('walking: the street by its name, and since when', () => {
    expect(personLine({ state: 'walking', on: { title: 'Ramsey Ave from W 40th St to W 44th St' }, since: ago(50) }, at)).toBe('Walking Ramsey Ave since 9:10 pm');
  });

  test('asked: what, when, and whether their screen has shown it', () => {
    const asked = { title: 'W 42nd St from Rosedale Ave to Shoalwood Ave', at: ago(3), seenAt: null };
    expect(personLine({ state: 'asked', asked }, at)).toBe('Asked to walk W 42nd St at 9:57 pm. Not seen yet.');
    expect(personLine({ state: 'asked', asked: { ...asked, seenAt: ago(2) } }, at)).toBe('Asked to walk W 42nd St at 9:57 pm. Seen 9:58 pm.');
  });

  test('free: since they last walked, and how much; or since they joined', () => {
    expect(personLine({ state: 'free', walked: 2, lastWalkedAt: ago(10), joinedAt: ago(90) }, at)).toBe('Free since 9:50 pm. Walked 2 streets.');
    expect(personLine({ state: 'free', walked: 1, lastWalkedAt: ago(10) }, at)).toBe('Free since 9:50 pm. Walked 1 street.');
    expect(personLine({ state: 'free', walked: 0, joinedAt: ago(2) }, at)).toBe('Joined 9:58 pm. No street yet.');
    expect(personLine({ state: 'free', walked: 0 }, at)).toBe('No street yet.');
    expect(personLine(null, at)).toBe('');
  });

  test('a street is called by its name in the list', () => {
    expect(shortTitle('Ramsey Ave from W 40th St to W 44th St')).toBe('Ramsey Ave');
    expect(shortTitle('Block C3')).toBe('Block C3');
    expect(shortTitle(null)).toBe('');
  });
});

describe('out much longer than the street takes', () => {
  const walking = (minutes) => ({ state: 'walking', since: ago(minutes) });

  test('twice the street\'s time and a quarter of an hour is not long', () => {
    expect(outLong(walking(30), 10, NOW)).toBeNull();
    expect(outLong(walking(35), 10, NOW)).toBeNull();
    expect(outLong(walking(36), 10, NOW)).toBe(36);
    expect(outLong(walking(50), 20, NOW)).toBeNull();
    expect(outLong(walking(56), 20, NOW)).toBe(56);
  });

  test('only someone walking can be out long', () => {
    expect(outLong({ state: 'free', since: ago(500) }, 10, NOW)).toBeNull();
    expect(outLong({ state: 'walking', since: null }, 10, NOW)).toBeNull();
    expect(outLong(null, 10, NOW)).toBeNull();
  });
});

test('people in three groups', () => {
  const people = [{ handle: 'a', state: 'free' }, { handle: 'b', state: 'walking' }, { handle: 'c', state: 'asked' }, { handle: 'd', state: 'free' }];
  const g = grouped(people);
  expect(g.free.map((p) => p.handle)).toEqual(['a', 'd']);
  expect(g.asked.map((p) => p.handle)).toEqual(['c']);
  expect(g.walking.map((p) => p.handle)).toEqual(['b']);
  expect(grouped()).toEqual({ free: [], asked: [], walking: [] });
});

test('where the search is on squares a person\'s line says "block"', () => {
  const at = { timeZone: 'America/Chicago', now: NOW, unit: 'block' };
  expect(personLine({ state: 'free', walked: 2, lastWalkedAt: ago(10) }, at)).toMatch(/^Free since .+\. Walked 2 blocks\.$/);
  expect(personLine({ state: 'free', walked: 1, lastWalkedAt: ago(10) }, at)).toMatch(/Walked 1 block\.$/);
  expect(personLine({ state: 'free', walked: 0, joinedAt: ago(10) }, at)).toMatch(/^Joined .+\. No block yet\.$/);
  expect(personLine({ state: 'free', walked: 0 }, at)).toBe('No block yet.');
});

describe('what a helper\'s card shows of what was said to them', () => {
  const words = [
    { id: 'm1', at: ago(60), text: 'Thanks for coming.', mine: false, from: null },
    { id: 'm2', at: ago(20), text: 'Gate open behind the school.', mine: true, from: null },
    { id: 'm3', at: ago(5), text: 'Can you take the alley too?', mine: false, from: 'Avery' },
  ];
  const updates = [{ id: 'u1', at: ago(19), text: 'He comes to a squeaky ball.' }];

  const yours = { id: 'm3', kind: 'yours', text: 'Can you take the alley too?', at: ago(5), from: 'Avery' };
  const everyone = { id: 'u1', kind: 'everyone', text: 'He comes to a squeaky ball.', at: ago(19), from: 'Avery' };

  test('the newest word written to them, and under it what the owner last told everyone', () => {
    expect(wordsForCard({ words, updates, ownerName: 'Avery', now: NOW })).toEqual([yours, everyone]);
  });

  test('a word written to them stays on the card when everyone is told something later', () => {
    // The desk is told when it was seen, so it has to be there to see: the newer word to everyone goes under it.
    const later = [{ id: 'u2', at: ago(1), text: 'He is wearing a blue collar.' }, ...updates];
    expect(wordsForCard({ words, updates: later, ownerName: 'Avery', now: NOW })).toEqual([yours, { id: 'u2', kind: 'everyone', text: 'He is wearing a blue collar.', at: ago(1), from: 'Avery' }]);
  });

  test('with nothing written to them, only what the owner told everyone; and the other way round', () => {
    expect(wordsForCard({ words: words.slice(1, 2), updates, ownerName: 'Avery', now: NOW })).toEqual([everyone]);
    expect(wordsForCard({ words, updates: [], ownerName: 'Avery', now: NOW })).toEqual([yours]);
    // From anyone else who came to run the search: whose it is, is not said.
    expect(wordsForCard({ words: words.slice(0, 1), updates: [], ownerName: 'Avery', now: NOW })).toEqual([{ id: 'm1', kind: 'yours', text: 'Thanks for coming.', at: ago(60), from: null }]);
  });

  test('their own words are never shown back to them as news', () => {
    expect(wordsForCard({ words: [words[1]], updates: [], now: NOW })).toEqual([]);
  });

  test('after twelve hours the card goes back to the job', () => {
    expect(WORD_FRESH_MS).toBe(12 * 3600 * 1000);
    const old = [{ id: 'm0', at: ago(13 * 60), text: 'Old.', mine: false, from: 'Avery' }];
    expect(wordsForCard({ words: old, updates: [{ id: 'u0', at: ago(13 * 60), text: 'Old too.' }], now: NOW })).toEqual([]);
    expect(wordsForCard({ now: NOW })).toEqual([]);
  });

  test('whose it is: the owner by name, anyone else as the people running the search', () => {
    expect(wordFrom({ kind: 'yours', from: 'Avery', at: ago(5) }, at)).toBe('Avery, 9:55 pm');
    expect(wordFrom({ kind: 'yours', from: null, at: ago(5) }, at)).toBe('The people running the search, 9:55 pm');
    expect(wordFrom({ kind: 'everyone', from: 'Avery', at: ago(19) }, at)).toBe('Avery, 9:41 pm, to everyone');
    expect(wordFrom(null, at)).toBe('');
  });
});

describe('the desk\'s messages: everything said and everything that happened, in one stream', () => {
  const events = [
    { id: 'seen-s1', at: ago(12), kind: 'seen', text: 'Max was seen at W 42nd St.', sightingId: 's1' },
    { id: 'walk-a', at: ago(30), kind: 'walk', text: 'Sam walked W 43rd St.', streetId: 'a' },
    { id: 'said-u1', at: ago(19), kind: 'said', text: 'Avery: He comes to a squeaky ball.' },
    { id: 'lost', at: ago(180), kind: 'lost', text: 'Max was lost near Sinclair Ave.' },
  ];
  const words = [
    { id: 'm1', at: ago(8), text: 'Gate open behind the school.', fromDesk: false, from: 'Dana', fromHandle: 'h-dana', to: null, toHandle: null, seenAt: null },
    { id: 'm2', at: ago(1), text: 'Thanks Dana. Can you take the alley too?', fromDesk: true, mine: true, from: 'Avery', fromHandle: 'h-avery', to: 'Dana', toHandle: 'h-dana', seenAt: ago(0.5) },
    { id: 'm3', at: ago(2), text: 'Burnet Rd next please.', fromDesk: true, mine: false, from: 'Sarah', fromHandle: 'h-sarah', to: 'Mike', toHandle: 'h-mike', seenAt: null },
  ];

  test('oldest first, messages among the events', () => {
    const lines = stream({ events, words });
    expect(lines.map((l) => l.id)).toEqual(['lost', 'walk-a', 'said-u1', 'seen-s1', 'word-m1', 'word-m3', 'word-m2']);
    expect(lines.map((l) => l.kind)).toEqual(['event', 'event', 'said', 'seen', 'theirs', 'mine', 'mine']);
  });

  test('a helper\'s word carries their name and the handle to answer them by', () => {
    const line = stream({ events: [], words }).find((l) => l.id === 'word-m1');
    expect(line).toMatchObject({ kind: 'theirs', who: 'Dana', to: null, handle: 'h-dana', text: 'Gate open behind the school.' });
  });

  test('a word from the desk says who it was to and whether they have seen it; the viewer\'s own is "You"', () => {
    const lines = stream({ events: [], words });
    expect(lines.find((l) => l.id === 'word-m2')).toMatchObject({ kind: 'mine', who: 'You', to: 'Dana', handle: 'h-dana', seenAt: ago(0.5) });
    // Another person running the search wrote this one.
    expect(lines.find((l) => l.id === 'word-m3')).toMatchObject({ kind: 'mine', who: 'Sarah', to: 'Mike', seenAt: null });
  });

  test('an event keeps what it points at', () => {
    const lines = stream({ events, words: [] });
    expect(lines.find((l) => l.id === 'walk-a')).toMatchObject({ streetId: 'a', sightingId: null });
    expect(lines.find((l) => l.id === 'seen-s1')).toMatchObject({ sightingId: 's1', kind: 'seen' });
    expect(stream()).toEqual([]);
  });
});

describe('what the owner\'s phone card shows of what helpers said', () => {
  const w = (id, minutes, fromDesk, who, over = {}) => ({ id, at: ago(minutes), text: `${id} text`, fromDesk, mine: fromDesk, from: fromDesk ? 'Avery' : who, fromHandle: fromDesk ? 'h-avery' : `h-${who.toLowerCase()}`, to: fromDesk ? who : null, toHandle: fromDesk ? `h-${who.toLowerCase()}` : null, ...over });

  test('the newest word nobody has answered, with whose it is and the handle to answer them by', () => {
    const talk = [w('a', 30, false, 'Dana'), w('b', 20, false, 'Jo'), w('c', 10, false, 'Dana')];
    expect(wordsForOwner({ talk, now: NOW })).toEqual([{ id: 'c', kind: 'yours', text: 'c text', at: ago(10), from: 'Dana', handle: 'h-dana' }]);
  });

  test('one at a time: answering it brings up the next, and nothing answered is shown', () => {
    const talk = [w('a', 30, false, 'Dana'), w('b', 20, false, 'Jo'), w('c', 5, true, 'Dana')];
    expect(wordsForOwner({ talk, now: NOW }).map((x) => [x.id, x.from])).toEqual([['b', 'Jo']]);
    expect(wordsForOwner({ talk: [...talk, w('d', 1, true, 'Jo')], now: NOW })).toEqual([]);
  });

  test('an old word is not put on the card, and no id of anyone is', () => {
    expect(wordsForOwner({ talk: [w('a', 13 * 60, false, 'Dana')], now: NOW })).toEqual([]);
    expect(wordsForOwner({ now: NOW })).toEqual([]);
    const [card] = wordsForOwner({ talk: [w('a', 3, false, 'Dana')], now: NOW });
    expect(Object.keys(card).sort()).toEqual(['at', 'from', 'handle', 'id', 'kind', 'text']);
  });
});

describe('words from helpers nobody has answered', () => {
  const w = (id, minutes, fromDesk, who) => ({ id, at: ago(minutes), text: id, fromDesk, from: who, fromHandle: fromDesk ? 'h-avery' : `h-${who.toLowerCase()}`, to: fromDesk ? who : null, toHandle: fromDesk ? `h-${who.toLowerCase()}` : null });

  test('the newest per person, when the last word between them was the helper\'s', () => {
    const words = [w('a', 30, false, 'Dana'), w('b', 25, true, 'Dana'), w('c', 10, false, 'Dana'), w('d', 20, false, 'Jo'), w('e', 5, true, 'Sam')];
    expect(unanswered(words).map((x) => x.id)).toEqual(['c', 'd']);
  });

  test('the reader\'s own word is never one for them to answer', () => {
    // Someone leading who was written to answers the desk like any helper: on their own desk it is theirs, not a card.
    const words = [w('a', 30, true, 'Sarah'), { ...w('b', 20, false, 'Sarah'), mine: true }];
    expect(unanswered(words)).toEqual([]);
    expect(unanswered(words.map((x) => ({ ...x, mine: false }))).map((x) => x.id)).toEqual(['b']);
  });

  test('answered, or nothing said, is nothing to answer', () => {
    expect(unanswered([w('a', 30, false, 'Dana'), w('b', 25, true, 'Dana')])).toEqual([]);
    expect(unanswered()).toEqual([]);
  });
});
