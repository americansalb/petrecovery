/**
 * "Needs you" (app/mission-control/lib/needs.js): the short list of things
 * waiting for the person running a search, each with one thing to do.
 */

import { needsYou, quietLine, nearestOpen, SIGHTING_NEEDS_MS, FREE_NEEDS_MS, FREE_GRACE_MS } from '@/app/mission-control/lib/needs';

const ZONE = 'America/Chicago';
const NOW = new Date('2026-11-13T04:00:00Z').getTime(); // 10 pm in Austin
const ago = (minutes) => new Date(NOW - minutes * 60000).toISOString();
const LOST = { lat: 30.3148, lng: -97.7459, at: ago(180), place: 'Sinclair Ave' };
const south = (meters, east = 0) => ({ lat: LOST.lat - meters / 111320, lng: LOST.lng + east / 96100 });
// A street running east-west, `meters` south of where the pet was lost.
const street = (id, meters, over = {}) => ({ id, title: `${id} St from A Ave to B Ave`, name: `${id} St`, minutes: 10, priority: 5, status: 'UNSEARCHED', center: south(meters), path: [[south(meters).lat, LOST.lng - 0.002], [south(meters).lat, LOST.lng + 0.002]], ...over });
const person = (name, over = {}) => ({ handle: `h-${name.toLowerCase()}`, name, kind: 'helper', state: 'free', on: null, since: null, asked: null, walked: 0, lastWalkedAt: null, lastOn: null, joinedAt: ago(30), ...over });
const picture = (over = {}) => ({ open: true, timeZone: ZONE, pet: { name: 'Max' }, owner: { firstName: 'Avery' }, lastSeen: LOST, sightings: [], ...over });
const base = (over = {}) => ({ picture: picture(), items: [street('Oak', 100), street('Elm', 300), street('Ash', 600)], people: [], words: [], leads: true, now: NOW, ...over });

describe('who gets the list', () => {
  test('only someone running the search, and only while it is open', () => {
    const busy = base({ people: [person('Jo', { joinedAt: ago(5) })] });
    expect(needsYou(busy)).toHaveLength(1);
    expect(needsYou({ ...busy, leads: false })).toEqual([]);
    expect(needsYou({ ...busy, picture: picture({ open: false }) })).toEqual([]);
    expect(needsYou()).toEqual([]);
  });
});

describe('a sighting', () => {
  const seen = { id: 's1', at: ago(12), place: 'Elm St and A Ave', ...south(300) };

  test('says where it was from where the pet was lost, and asks the nearest free person for the street it was on', () => {
    const sam = person('Sam', { walked: 1, lastWalkedAt: ago(10), lastOn: { id: 'Oak' } });
    const jo = person('Jo', { joinedAt: ago(1) });
    const [card] = needsYou(base({ picture: picture({ sightings: [seen] }), people: [jo, sam] }));
    expect(card).toMatchObject({ id: 'seen-s1', kind: 'sighting', tone: 'seen', label: 'Sighting · 12 minutes ago', title: 'Seen at Elm St and A Ave' });
    expect(card.body).toBe('300 m south of where Max was lost. Elm St is still to walk. Sam is free and last walked 200 m from there.');
    // One named person, never a group.
    expect(card.primary).toEqual({ words: 'Ask Sam to walk Elm St', do: { type: 'ask', handle: 'h-sam', streetId: 'Elm' } });
    expect(card.more).toEqual([{ words: 'Show it on the map', do: { type: 'show', sightingId: 's1' } }]);
  });

  test('someone free with no street behind them can be asked too, without a distance nobody knows', () => {
    const [card] = needsYou(base({ picture: picture({ sightings: [seen] }), people: [person('Jo', { joinedAt: ago(1) })] }));
    expect(card.body).toBe('300 m south of where Max was lost. Elm St is still to walk. Jo is free.');
    expect(card.primary.do).toEqual({ type: 'ask', handle: 'h-jo', streetId: 'Elm' });
  });

  test('with nobody free it says what the search does by itself, and asks no one', () => {
    // Dana is out, on a street far from the sighting.
    const dana = person('Dana', { state: 'walking', on: { id: 'Fir', title: 'Fir St from A Ave to B Ave' }, since: ago(5) });
    const [card] = needsYou(base({ picture: picture({ sightings: [seen] }), people: [dana], items: [street('Oak', 100, { status: 'SEARCHED' }), street('Elm', 300), street('Fir', 900, { status: 'IN_PROGRESS' })] }));
    expect(card.body).toBe('300 m south of where Max was lost. Elm St is still to walk. Nobody is free right now. The next person who asks for a street is given the ones around it first.');
    expect(card.primary).toEqual({ words: 'Show it on the map', do: { type: 'show', sightingId: 's1' } });
    expect(card.more).toEqual([]);
  });

  test('once someone has been asked for a street around it, the card says so and asks nobody else', () => {
    const sam = person('Sam', { state: 'asked', asked: { id: 'Elm', title: 'Elm St from A Ave to B Ave', at: ago(1) } });
    const jo = person('Jo', { joinedAt: ago(20) });
    // Oak St is 200 m from the sighting and still to walk, and Jo is free: one person is going, so Jo is not sent too.
    const [card] = needsYou(base({ picture: picture({ sightings: [seen] }), people: [sam, jo], items: [street('Oak', 100), street('Elm', 300, { reserved: true, askedOfHandle: 'h-sam' }), street('Ash', 600)] }));
    expect(card.body).toBe('300 m south of where Max was lost. Sam was asked to walk Elm St at 9:59 pm.');
    expect(card.primary).toEqual({ words: 'Show it on the map', do: { type: 'show', sightingId: 's1' } });
    expect(card.more).toEqual([]);
  });

  test('someone already walking a street around it is said, and nobody else is asked', () => {
    const dana = person('Dana', { state: 'walking', on: { id: 'Oak', title: 'Oak St from A Ave to B Ave' }, since: ago(5) });
    const jo = person('Jo', { joinedAt: ago(20) });
    const [card] = needsYou(base({ picture: picture({ sightings: [seen] }), people: [dana, jo] }));
    expect(card.body).toBe('300 m south of where Max was lost. Dana is walking Oak St, 200 m from it.');
    expect(card.primary.do.type).toBe('show');
    // On the very street: no distance to give.
    const on = person('Dana', { state: 'walking', on: { id: 'Elm', title: 'Elm St from A Ave to B Ave' }, since: ago(5) });
    expect(needsYou(base({ picture: picture({ sightings: [seen] }), people: [on] }))[0].body).toBe('300 m south of where Max was lost. Dana is walking Elm St.');
  });

  test('it is something to act on for an hour, the newest one only, and a street far from it is not "around it"', () => {
    expect(SIGHTING_NEEDS_MS).toBe(3600 * 1000);
    expect(needsYou(base({ picture: picture({ sightings: [{ ...seen, at: ago(61) }] }) }))).toEqual([]);
    const two = needsYou(base({ picture: picture({ sightings: [{ ...seen, id: 's0', at: ago(50) }, seen] }) }));
    expect(two.map((c) => c.id)).toEqual(['seen-s1']);
    // Seen 900 m east of every street: nothing within 300 m of it.
    const far = needsYou(base({ picture: picture({ sightings: [{ id: 's2', at: ago(5), place: null, ...south(300, 900) }] }), people: [person('Jo', { joinedAt: ago(1) })] }));
    expect(far[0]).toMatchObject({ title: 'Seen, and marked on the map', primary: { do: { type: 'show', sightingId: 's2' } } });
    expect(far[0].body).not.toMatch(/still to walk/);
  });

  test('it never says where the pet is or what anyone must do', () => {
    const cards = needsYou(base({ picture: picture({ sightings: [seen] }), people: [person('Sam', { walked: 1, lastWalkedAt: ago(10), lastOn: { id: 'Oak' } })] }));
    expect(JSON.stringify(cards)).not.toMatch(/\b(is heading|is probably|likely|should|must|stop|hold|stay back|wait)\b/i);
  });
});

describe('a word nobody has answered', () => {
  const word = (id, minutes, fromDesk, who) => ({ id, at: ago(minutes), text: `${who} says ${id}`, fromDesk, from: fromDesk ? 'Avery' : who, fromHandle: fromDesk ? 'h-avery' : `h-${who.toLowerCase()}`, to: fromDesk ? who : null, toHandle: fromDesk ? `h-${who.toLowerCase()}` : null });

  test('is shown in the helper\'s own words, with one button to answer and one to put it away', () => {
    const [card] = needsYou(base({ words: [word('a', 8, false, 'Dana')] }));
    expect(card).toEqual({
      id: 'word-a',
      kind: 'word',
      label: 'From Dana · 9:52 pm',
      title: '',
      body: '"Dana says a"',
      primary: { words: 'Answer Dana', do: { type: 'write', handle: 'h-dana' } },
      more: [{ words: 'Got it', do: { type: 'done', key: 'word-a' } }],
    });
  });

  test('answered, or put away, it is gone', () => {
    expect(needsYou(base({ words: [word('a', 8, false, 'Dana'), word('b', 2, true, 'Dana')] }))).toEqual([]);
    expect(needsYou(base({ words: [word('a', 8, false, 'Dana')], put: new Set(['word-a']) }))).toEqual([]);
  });
});

describe('someone with no street', () => {
  test('a helper who joined a few minutes ago is offered the most urgent street', () => {
    const [card] = needsYou(base({ people: [person('Jo', { joinedAt: ago(5) })], items: [street('Oak', 100, { priority: 5 }), street('Elm', 300, { priority: 9 })] }));
    expect(card).toMatchObject({ id: 'free-h-jo', kind: 'free', label: 'No street yet', title: 'Jo joined 5 minutes ago', body: 'Elm St is the most urgent street still to walk.' });
    expect(card.primary).toEqual({ words: 'Give Jo a street', do: { type: 'give', handle: 'h-jo', streetId: 'Elm' } });
    expect(card.more).toEqual([{ words: 'Not now', do: { type: 'done', key: `free-h-jo-${new Date(ago(5)).getTime()}` } }]);
  });

  test('someone who has just finished a street says so', () => {
    const [card] = needsYou(base({ people: [person('Sam', { walked: 2, lastWalkedAt: ago(10), joinedAt: ago(90) })] }));
    expect(card.title).toBe('Sam finished 10 minutes ago');
  });

  test('they are left alone for the first two minutes, and after two hours they have likely gone home', () => {
    expect(FREE_GRACE_MS).toBe(2 * 60000);
    expect(FREE_NEEDS_MS).toBe(2 * 3600000);
    expect(needsYou(base({ people: [person('Jo', { joinedAt: ago(1) })] }))).toEqual([]);
    expect(needsYou(base({ people: [person('Jo', { joinedAt: ago(121) })] }))).toEqual([]);
    expect(needsYou(base({ people: [person('Jo', { joinedAt: ago(119) })] }))).toHaveLength(1);
  });

  test('put away, it stays away until they finish another street', () => {
    const jo = person('Jo', { joinedAt: ago(5) });
    const key = `free-h-jo-${new Date(ago(5)).getTime()}`;
    expect(needsYou(base({ people: [jo], put: new Set([key]) }))).toEqual([]);
    // Jo walks a street and is free again: a new moment, so the card comes back.
    const again = person('Jo', { joinedAt: ago(40), walked: 1, lastWalkedAt: ago(3) });
    expect(needsYou(base({ people: [again], put: new Set([key]) }))).toHaveLength(1);
  });

  test('a street kept for someone else is not offered, and with nothing left the card offers a word', () => {
    const jo = person('Jo', { joinedAt: ago(5) });
    const kept = needsYou(base({ people: [jo], items: [street('Oak', 100, { priority: 9, reserved: true }), street('Elm', 300)] }));
    expect(kept[0].primary.do).toEqual({ type: 'give', handle: 'h-jo', streetId: 'Elm' });
    const none = needsYou(base({ people: [jo], items: [street('Oak', 100, { status: 'SEARCHED' })] }));
    expect(none[0]).toMatchObject({ body: 'Every street has been walked or has someone on it.', primary: { words: 'Write to Jo', do: { type: 'write', handle: 'h-jo' } } });
  });
});

describe('someone out much longer than their street takes', () => {
  test('is a card with their name, the street and the minutes, and one thing to do: write to them', () => {
    const dana = person('Dana', { state: 'walking', on: { id: 'Oak', title: 'Oak St from A Ave to B Ave' }, since: ago(50) });
    const [card] = needsYou(base({ people: [dana] }));
    expect(card).toMatchObject({ id: 'long-h-dana', kind: 'long', label: 'Out a long time', title: 'Dana took Oak St 50 minutes ago', body: 'It is a 10 minute street.' });
    expect(card.primary).toEqual({ words: 'Write to Dana', do: { type: 'write', handle: 'h-dana' } });
    // Nothing here tells Dana to stop, and nothing takes the street from her.
    expect(JSON.stringify(card)).not.toMatch(/stop|free the street|take it back/i);
  });

  test('a careful walk is not flagged', () => {
    const dana = person('Dana', { state: 'walking', on: { id: 'Oak', title: 'Oak St from A Ave to B Ave' }, since: ago(30) });
    expect(needsYou(base({ people: [dana] }))).toEqual([]);
  });
});

describe('the order, and when nothing is waiting', () => {
  test('a sighting first, then a word, then people with no street, then anyone out long', () => {
    const seen = { id: 's1', at: ago(12), place: 'Elm St', ...south(300) };
    const cards = needsYou(
      base({
        picture: picture({ sightings: [seen] }),
        people: [person('Dana', { state: 'walking', on: { id: 'Oak', title: 'Oak St from A Ave to B Ave' }, since: ago(50) }), person('Jo', { joinedAt: ago(5) })],
        words: [{ id: 'a', at: ago(8), text: 'Gate open.', fromDesk: false, from: 'Dana', fromHandle: 'h-dana', to: null, toHandle: null }],
      })
    );
    expect(cards.map((c) => c.kind)).toEqual(['sighting', 'word', 'free', 'long']);
  });

  test('with nothing waiting the desk says what the search is doing by itself', () => {
    const items = [street('Oak', 100, { priority: 5 }), street('Elm', 300, { priority: 9 })];
    expect(quietLine({ items, people: [] })).toBe('Nobody is out right now. The next person who asks for a street is given Elm St.');
    const walking = [person('Dana', { state: 'walking' }), person('Sam', { state: 'walking' })];
    expect(quietLine({ items, people: walking })).toBe('2 people are out walking. The next person who asks for a street is given Elm St.');
    expect(quietLine({ items: [street('Oak', 100, { status: 'SEARCHED' })], people: [walking[0]] })).toBe('1 person is out walking. Every street has been walked or has someone on it.');
    expect(quietLine({ unit: 'block', items: [{ ...street('Oak', 100, { priority: 9 }), title: 'Block C1' }], people: [] })).toBe('Nobody is out right now. The next person who asks for a block is given Block C1.');
  });

  test('where several streets are as urgent as each other no one of them is named: a phone gives the nearest to its helper', () => {
    const tied = [street('Oak', 100, { priority: 9 }), street('Elm', 300, { priority: 9 }), street('Ash', 320, { priority: 9 }), street('Fir', 420, { priority: 4 })];
    expect(quietLine({ items: tied, people: [] })).toBe('Nobody is out right now. The next person who asks for a street is given the nearest of the 3 most urgent.');
    const jo = person('Jo', { joinedAt: ago(5) });
    const [card] = needsYou(base({ people: [jo], items: tied }));
    expect(card.body).toBe('Oak St is one of the 3 most urgent streets still to walk.');
  });

  test('where the search is on squares nobody is given one by name: the cards say "block" and offer a word', () => {
    const blocks = [{ ...street('Oak', 100, { priority: 9 }), title: 'Block C1' }, { ...street('Elm', 300, { priority: 5 }), title: 'Block D2' }];
    const jo = person('Jo', { joinedAt: ago(5) });
    const [free] = needsYou(base({ people: [jo], items: blocks, unit: 'block' }));
    expect(free).toMatchObject({ label: 'No block yet', body: 'The next block is given when they ask for one on their phone.', primary: { words: 'Write to Jo', do: { type: 'write', handle: 'h-jo' } } });
    // A sighting on squares shows the place; it asks nobody by name, since a square cannot be kept for a person.
    const seen = { id: 's1', at: ago(12), place: 'Elm St', ...south(300) };
    const [card] = needsYou(base({ picture: picture({ sightings: [seen] }), people: [jo], items: blocks, unit: 'block' }));
    expect(card.kind).toBe('sighting');
    expect(card.primary.do).toEqual({ type: 'show', sightingId: 's1' });
    expect(JSON.stringify(needsYou(base({ picture: picture({ sightings: [seen] }), people: [jo], items: blocks, unit: 'block' })))).not.toMatch(/"type":"(ask|give)"/);
    const dana = person('Dana', { state: 'walking', on: { id: 'Oak', title: 'Block C1' }, since: ago(70) });
    expect(needsYou(base({ people: [dana], items: blocks, unit: 'block' }))[0].body).toBe('It is a 10 minute block.');
  });

  test('with no streets at all it says nothing about streets: an empty board is not "all walked"', () => {
    expect(quietLine({ items: [], people: [] })).toBe('Nobody is out right now.');
    const jo = person('Jo', { joinedAt: ago(5) });
    const [card] = needsYou(base({ people: [jo], items: [] }));
    expect(card).toMatchObject({ body: '', primary: { words: 'Write to Jo' } });
    expect(JSON.stringify(card)).not.toMatch(/walked/);
  });
});

describe('nearestOpen', () => {
  test('measures from the street\'s own line, and passes over streets walked, held or kept for someone else', () => {
    const at = south(300, 150);
    const items = [street('Oak', 100), street('Elm', 300, { status: 'SEARCHED' }), street('Ash', 320, { reserved: true, askedOfHandle: 'h-sam' }), street('Fir', 420)];
    expect(nearestOpen(items, at).street.id).toBe('Fir');
    // For the person it is kept for, it is the nearest.
    expect(nearestOpen(items, at, { forHandle: 'h-sam' }).street.id).toBe('Ash');
    expect(nearestOpen([], at)).toBeNull();
  });
});
