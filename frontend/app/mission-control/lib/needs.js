/**
 * "Needs you": the short list of things waiting for the person running a
 * search, each with one thing to do about it. It is what makes the desk
 * something to run a search from rather than something to look at: nobody
 * has to scan three tabs to find out that Jo has been standing by for five
 * minutes.
 *
 * Pure, so every card and every sentence is tested
 * (__tests__/lib/searchNeeds.test.js). Each card is built from what the
 * search already holds: a sighting, a word nobody has answered, a helper
 * with no street, someone out much longer than their street takes. Like
 * every sentence on the desk they are times, counts and distances
 * (lib/insight.js). Nothing here says where the pet is, and nothing tells
 * a helper to stop: every action is the person at the desk asking or
 * writing in their own name.
 *
 * A card: { id, kind, label, title, body, tone, primary: { words, do },
 * more: [{ words, do }] }. `do` is what the desk does when it is pressed:
 * { type: 'give', handle, streetId } opens that person with a street
 * picked, { type: 'write', handle } opens the box to write to them,
 * { type: 'ask', handle, streetId } asks them at once, { type: 'first',
 * streetId } sends the next person who asks to that street first,
 * { type: 'show', sightingId } shows it on the map, { type: 'done', key }
 * puts the card away on this computer.
 */
import { distanceMeters } from '@/app/lib/searchGrid';
import { nearestOnPath } from '@/app/lib/streetWalks';
import { agoWords, clockTime, placeWords } from './words';
import { directionWord, givenNext, metersWords } from './insight';
import { outLong, shortTitle, unanswered } from './team';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** A sighting is something to act on for this long. After it, it is on the map and in the messages. */
export const SIGHTING_NEEDS_MS = HOUR;
/** Someone free is offered a street for this long after they joined or last walked. After it they have likely gone home. */
export const FREE_NEEDS_MS = 2 * HOUR;
/** Someone who has just joined or finished is left alone for a moment: the search may hand them a street by itself. */
export const FREE_GRACE_MS = 2 * MINUTE;
/** How many cards are shown. The rest are counted. */
export const NEEDS_SHOWN = 3;

const isOpen = (i) => i.status === 'UNSEARCHED' || i.status === 'NEEDS_REVISIT';

/** How far a street is from a place, measured from the street's own line. */
function apart(street, at) {
  if (Array.isArray(street.path) && street.path.length > 1) {
    const on = nearestOnPath(at, street.path);
    if (Number.isFinite(on.meters)) return on.meters;
  }
  return street.center ? distanceMeters(street.center, at) : Infinity;
}

/** The street still to walk that is nearest a place, among those not kept for someone else. */
export function nearestOpen(items = [], at, { forHandle = null } = {}) {
  let best = null;
  for (const street of items) {
    if (!isOpen(street)) continue;
    if (street.reserved && street.askedOfHandle !== forHandle) continue;
    const meters = apart(street, at);
    if (!best || meters < best.meters) best = { street, meters };
  }
  return best;
}

/** A street within this distance of a sighting is one of "the streets around it", as in the board's own order. */
export const AROUND_METERS = 300;

function sightingCard({ picture, items, people, name, unit, now }) {
  const seen = [...(picture.sightings || [])].filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng)).sort((a, b) => new Date(b.at) - new Date(a.at))[0];
  if (!seen || now - new Date(seen.at).getTime() > SIGHTING_NEEDS_MS) return null;
  const origin = picture.lastSeen && Number.isFinite(picture.lastSeen.lat) ? picture.lastSeen : null;
  const where = placeWords(seen.place);
  const far = origin ? distanceMeters(origin, seen) : NaN;
  const fromLost = Number.isFinite(far) ? `${metersWords(far)} ${far >= 50 ? `${directionWord(origin, seen)} of` : 'from'} where ${name} was lost.` : '';
  const show = { words: 'Show it on the map', do: { type: 'show', sightingId: seen.id } };
  const around = items
    .map((street) => ({ street, meters: apart(street, seen) }))
    .filter((x) => x.meters <= AROUND_METERS)
    .sort((a, b) => a.meters - b.meters);
  const beside = (x) => (x.meters < 30 ? '' : `, ${metersWords(x.meters)} from it`);
  const facts = [fromLost];
  let primary = show;
  const more = [];

  // One named person goes to a sighting, never a group. If someone is already on a street around it, or has
  // been asked for one, the card says so and asks nobody else.
  const there = people
    .map((p) => {
      const id = p.state === 'walking' ? p.on?.id : p.asked?.id;
      const hit = id ? around.find((x) => x.street.id === id) : null;
      return hit ? { person: p, ...hit } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.meters - b.meters)[0];
  // A named person is asked to walk a street. Squares are given out as people ask, so there the card shows the place.
  const open = unit === 'block' ? null : around.find((x) => isOpen(x.street) && !x.street.reserved);
  if (there) {
    const street = shortTitle(there.street.title);
    facts.push(there.person.state === 'walking' ? `${there.person.name} is walking ${street}${beside(there)}.` : `${there.person.name} was asked to walk ${street} at ${clockTime(there.person.asked.at, picture.timeZone)}.`);
  } else if (open) {
    const street = shortTitle(open.street.title);
    facts.push(open.meters < 30 ? `${street} is still to walk.` : `${street}, ${metersWords(open.meters)} from it, is still to walk.`);
    // The free person whose last street was nearest: the nearest thing to where they are that the search knows.
    // Only someone who joined or walked lately: a person who was here two days ago is not someone to keep a street for.
    const lately = (p) => {
      const since = p.lastWalkedAt || p.joinedAt;
      return Boolean(since) && now - new Date(since).getTime() <= FREE_NEEDS_MS;
    };
    const pick = people
      .filter((p) => p.state === 'free' && lately(p))
      .map((p) => {
        const last = p.lastOn ? items.find((i) => i.id === p.lastOn.id) : null;
        return { person: p, meters: last ? apart(last, seen) : Infinity };
      })
      .sort((a, b) => a.meters - b.meters)[0];
    if (pick) {
      facts.push(Number.isFinite(pick.meters) ? `${pick.person.name} is free and last walked ${metersWords(pick.meters)} from there.` : `${pick.person.name} is free.`);
      more.push(show);
      primary = { words: `Ask ${pick.person.name} to walk ${street}`, do: { type: 'ask', handle: pick.person.handle, streetId: open.street.id } };
    } else if (open.street.first) {
      facts.push(`Nobody is free right now. The next person who asks for a street is sent to ${street} first.`);
    } else {
      // Nobody to send: the owner can have the next person who asks sent there first, which is then true.
      facts.push('Nobody is free right now.');
      more.push(show);
      primary = { words: `Send the next person to ${street}`, do: { type: 'first', streetId: open.street.id } };
    }
  }
  return {
    id: `seen-${seen.id}`,
    kind: 'sighting',
    tone: 'seen',
    label: `Sighting · ${agoWords(seen.at, now)}`,
    title: where ? `Seen ${where}` : 'A sighting marked on the map',
    body: facts.filter(Boolean).join(' '),
    primary,
    more,
  };
}

/**
 * The cards, most pressing first, for whoever runs the search (`leads`:
 * the owner). Anyone else gets none.
 * `put` is the set of card keys this person has put away. `unit` is what
 * the search hands out: a named person is given a street, never a square.
 */
export function needsYou({ picture, items = [], people = [], words = [], leads = false, put = new Set(), unit = 'street', now = Date.now() } = {}) {
  if (!picture || !leads || !picture.open) return [];
  const name = picture.pet?.name || 'the pet';
  const zone = picture.timeZone;
  const thing = unit === 'block' ? 'block' : 'street';
  const cards = [];

  const seen = sightingCard({ picture, items, people, name, unit, now });
  if (seen) cards.push(seen);

  for (const w of unanswered(words)) {
    cards.push({
      id: `word-${w.id}`,
      kind: 'word',
      label: `From ${w.from} · ${clockTime(w.at, zone)}`,
      title: '',
      // Their words in quotation marks; what the screen knew they were about, outside them.
      body: w.about ? `"${w.text}"\nAbout ${w.about}.` : `"${w.text}"`,
      primary: { words: `Answer ${w.from}`, do: { type: 'write', handle: w.fromHandle } },
      more: [{ words: 'Got it', do: { type: 'done', key: `word-${w.id}` } }],
    });
  }

  const next = givenNext(items);
  for (const p of people) {
    if (p.state !== 'free') continue;
    const since = p.lastWalkedAt || p.joinedAt;
    if (!since) continue;
    const idle = now - new Date(since).getTime();
    if (idle < FREE_GRACE_MS || idle > FREE_NEEDS_MS) continue;
    // On squares nobody is given one by name: the card is for writing to them.
    const street = unit === 'block' ? null : next[0] || null;
    cards.push({
      id: `free-${p.handle}`,
      kind: 'free',
      label: `No ${thing} yet`,
      title: p.walked > 0 ? `${p.name} finished ${agoWords(since, now)}` : `${p.name} joined ${agoWords(since, now)}`,
      // No street to give is not "all walked" where the streets have not loaded: an empty board says nothing about them.
      body: street
        ? next.length === 1
          ? `${shortTitle(street.title)} is the most urgent street still to walk.`
          : `${shortTitle(street.title)} is one of the ${next.length} most urgent streets still to walk.`
        : unit === 'block'
          ? next.length
            ? 'The next block is given when they ask for one on their phone.'
            : items.length
              ? 'Every block has been walked or has someone on it.'
              : ''
          : items.length
            ? 'Every street has been walked or has someone on it.'
            : '',
      primary: street ? { words: `Give ${p.name} a street`, do: { type: 'give', handle: p.handle, streetId: street.id } } : { words: `Write to ${p.name}`, do: { type: 'write', handle: p.handle } },
      more: [{ words: 'Not now', do: { type: 'done', key: `free-${p.handle}-${new Date(since).getTime()}` } }],
    });
  }

  for (const p of people) {
    const minutes = p.on ? items.find((i) => i.id === p.on.id)?.minutes : null;
    const out = outLong(p, minutes, now);
    if (!out) continue;
    cards.push({
      id: `long-${p.handle}`,
      kind: 'long',
      label: 'Out a long time',
      title: `${p.name} took ${shortTitle(p.on.title)} ${out} minutes ago`,
      body: `It is a ${minutes || 20} minute ${thing}.`,
      primary: { words: `Write to ${p.name}`, do: { type: 'write', handle: p.handle } },
      more: [{ words: 'Not now', do: { type: 'done', key: `long-${p.handle}-${new Date(p.since).getTime()}` } }],
    });
  }

  return cards.filter((c) => !put.has(c.id) && !c.more.some((m) => m.do.type === 'done' && put.has(m.do.key)));
}

/** What the desk says when nothing is waiting: what the search is doing by itself. */
export function quietLine({ unit = 'street', items = [], people = [] } = {}) {
  const thing = unit === 'block' ? 'block' : 'street';
  const next = givenNext(items);
  const out = people.filter((p) => p.state === 'walking').length;
  const doing = out === 0 ? 'Nobody is out right now.' : out === 1 ? '1 person is out walking.' : `${out} people are out walking.`;
  // With no board at all there is nothing to say about the streets.
  if (!items.length) return doing;
  if (!next.length) return `${doing} Every ${thing} has been walked or has someone on it.`;
  // Where several are as urgent as each other a phone gives the nearest, so no one of them is named.
  return next.length === 1 ? `${doing} The next person who asks for a ${thing} is given ${shortTitle(next[0].title)}.` : `${doing} The next person who asks for a ${thing} is given the nearest of the ${next.length} most urgent.`;
}
