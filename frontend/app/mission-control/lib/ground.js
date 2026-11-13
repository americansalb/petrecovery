/**
 * What the search screen says about ground: the areas of a search
 * (app/lib/searchCircle.js cuts them, app/lib/searchZones.js keeps them),
 * who is on them, how much has been searched and what is given out next.
 * Pure, so every sentence is tested (__tests__/lib/searchGround.test.js).
 *
 * A search is a circle of ground around where the pet was lost, in areas.
 * An area is hectares, not one walk: several people can be on one, and
 * what the screen counts is how many times it has been searched, never
 * that it is "done". Like every sentence on the desk (lib/insight.js)
 * these are counts, times and distances. Nothing here says where the pet
 * is, and nothing tells a helper to stop: every action is the person at
 * the desk asking or writing in their own name.
 */
import { RING, inWords, inArea, rankAreas } from '@/app/lib/searchCircle';
import { distanceMeters } from '@/app/lib/searchGrid';
import { agoWords, clockTime, placeWords } from './words';
import { activity, directionWord, durationWords, metersWords, whenWords } from './insight';
import { outLong, unanswered } from './team';
import { SIGHTING_NEEDS_MS, FREE_NEEDS_MS, FREE_GRACE_MS } from './needs';

const capital = (text) => String(text || '').charAt(0).toUpperCase() + String(text || '').slice(1);

/** The circle round a sighting: one person goes there, and it is not one of the circle's own areas. */
export const isSeenCircle = (area) => area?.ring === RING.SEEN;
/** The circle's own areas: what "2 of 5 areas" counts. */
export const circleAreas = (areas = []) => areas.filter((a) => !isSeenCircle(a));

/** An area's name inside a sentence ("the west side") and at the start of one ("The west side"). */
export const areaName = (area) => inWords(area?.name || area?.title);
export const AreaName = (area) => capital(areaName(area));

/** The short name written on the map: "Middle", "North", "Far north-east". A sighting's circle is named by the sighting's own mark. */
export function mapLabel(area) {
  if (!area || isSeenCircle(area)) return '';
  if (area.key === 'middle') return 'Middle';
  return String(area.name || '').replace(/ side$/, '');
}

/** "once", "twice", "3 times". */
export const timesWords = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

/** "Sarah", "Sarah and Mike", "Sarah, Mike and Jo". */
export function listWords(names = []) {
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Where an area is, as a sentence: how far it reaches and which way, and
 * the streets that run through it. Streets are named so a person can find
 * the ground; nobody is told to walk them.
 */
export function whereWords(area) {
  if (!area) return '';
  const marks = (area.landmarks || []).slice(0, 2);
  return `${area.reach}${marks.length ? `, around ${listWords(marks)}` : ''}.`;
}

const WATER_WORDS = { river: 'a river', canal: 'a canal', stream: 'a stream', pond: 'a pond or lake' };

/**
 * What the map shows in an area that someone on foot should know of, in
 * sentences: its main roads, a rail line, its water (app/lib/searchHazards.js).
 * With `advice`, each says what to do about it, for the person going. The
 * list is the map's, so an empty one means the map shows none, not that
 * there is none.
 *
 * This is the only caution a card carries, and only where the map shows
 * something. Founder, 2026-11-13: "If you put too many warnings you are
 * putting the idea in people's heads. That is part of the reason you put
 * it kinda tucked away in waiver no one reads". So no card repeats a
 * general caution, and the limits (the map can be wrong, the site checks
 * no ground, no warning does not mean safe) are said in the waiver
 * (prisma/legal/liability-waiver.js, section 2) and not on a card.
 */
export function hazardLines(area, { advice = true } = {}) {
  const held = Array.isArray(area?.hazards) ? area.hazards : [];
  const lines = [];
  const say = (fact, what) => lines.push(advice ? `${fact} ${what}` : fact);
  const roads = held.filter((h) => h.kind === 'road');
  if (roads.length) {
    const named = roads.map((h) => h.name).filter(Boolean);
    const fact = named.length > 1 ? `${listWords(named)} are main roads in this area.` : named.length ? `${named[0]} is a main road in this area.` : 'A main road runs through this area.';
    say(fact, 'Stay off the roadway and cross only at a crossing.');
  }
  if (held.some((h) => h.kind === 'rail')) say('A rail line runs through this area.', 'Stay off the tracks and outside any fence.');
  const water = held.filter((h) => h.kind === 'water').map((h) => h.name || WATER_WORDS[h.what] || WATER_WORDS.pond);
  if (water.length) say(`${capital(listWords(water))} ${water.length > 1 ? 'are' : 'is'} in this area.`, 'Look from the bank or a path, and stay out of the water.');
  return lines;
}

/**
 * How long a search goes on counting. A lost pet moves, so ground that was
 * searched yesterday is not ground that is searched: each search of an
 * area fades to nothing over this many hours (founder, 2026-11-13: "does
 * it not fade over time?").
 */
export const FADE_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;
/** What a search counts for by how much of the area the person says they covered. Nobody saying is taken as a little under most. */
const COVER_WEIGHT = { ALL: 1, MOST: 0.75, PART: 0.4 };
const COVER_UNSAID = 0.6;
const COVER_WORDS = { ALL: 'all of it', MOST: 'most of it', PART: 'part of it' };
/** A search that took this share of the time an area takes one person counts in full: the estimate is a generous one. */
const FULL_TIME_SHARE = 0.6;
/** What one full, fresh search counts for. Never the whole: one pass misses a pet that is hiding. */
const ONE_SEARCH = 0.8;

/** "just now", "12 min ago", "3 h ago", "yesterday", "2 days ago": short enough to sit under an area's name on the map. */
export function agoShort(at, now = Date.now()) {
  if (!at) return '';
  const ms = Math.max(0, now - new Date(at).getTime());
  if (ms < 2 * 60 * 1000) return 'just now';
  if (ms < HOUR_MS) return `${Math.round(ms / 60000)} min ago`;
  if (ms < 24 * HOUR_MS) return `${Math.round(ms / HOUR_MS)} h ago`;
  const days = Math.floor(ms / (24 * HOUR_MS));
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** The searches of an area, newest first. An area from before each search was kept has its last one. */
const searchesOf = (area) => (Array.isArray(area?.history) && area.history.length ? area.history : area?.searchedAt ? [{ at: area.searchedAt, marked: Boolean(area.marked), minutes: null, covered: null, by: area.searchedByName || null }] : []);

/**
 * How strongly an area counts as searched right now, from 0 to 1, out of
 * every search of it: how much of it each covered, how long each took
 * against what the area takes, and how long ago each was. It is what the
 * green on the map, the dial and the list is drawn from, so ground
 * searched an hour ago by someone who covered all of it is deep green and
 * ground somebody passed through yesterday is nearly bare. An estimate
 * for shading and for the order ground is offered in. It is never shown
 * as a number: nobody can say how likely a search was to find a pet.
 */
export function searchStrength(area, now = Date.now()) {
  let missed = 1;
  for (const one of searchesOf(area)) {
    const hours = Math.max(0, now - new Date(one.at).getTime()) / HOUR_MS;
    const fresh = Math.max(0, 1 - hours / FADE_HOURS);
    const cover = COVER_WEIGHT[one.covered] || COVER_UNSAID;
    const time = one.minutes && area.minutes ? Math.min(1, one.minutes / (area.minutes * FULL_TIME_SHARE)) : 1;
    missed *= 1 - ONE_SEARCH * fresh * cover * time;
  }
  return Math.max(0, Math.min(1, 1 - missed));
}

/** Searched, nobody on it, and the last search a day or more ago: it has faded to nothing. */
export function isFaded(area, now = Date.now()) {
  return Boolean(area?.searchCount > 0 && area.status !== 'IN_PROGRESS' && area.searchedAt && now - new Date(area.searchedAt).getTime() >= FADE_HOURS * HOUR_MS);
}

/**
 * The record of an area, one sentence to a search, newest first: when, who
 * (where names go), how long, how much of it they say they covered, and in
 * their own words what they could not get to. A search far shorter than
 * the area takes says so.
 */
export function searchLog(area, { timeZone, now = Date.now() } = {}) {
  return searchesOf(area).map((one) => {
    const when = `${capital(agoWords(one.at, now))}, ${whenWords(one.at, timeZone, now)}`;
    if (one.marked) return `${when}: put down as searched${one.by ? ` by ${one.by}` : ''}. Nobody on the site was on it, so how long and how fully is not known.`;
    const parts = [one.by || 'A helper'];
    if (one.minutes) parts.push(`${one.minutes} ${one.minutes === 1 ? 'minute' : 'minutes'}`);
    if (one.covered) parts.push(`covered ${COVER_WORDS[one.covered]}`);
    const quick = one.minutes && area.minutes && one.minutes < area.minutes / 3 ? ` The area takes about ${area.minutes}.` : '';
    const missed = one.note ? ` Could not get to: "${one.note}"` : '';
    return `${when}: ${parts.join(', ')}.${quick}${missed}`;
  });
}

/**
 * An area's state in two or three words, for the map's label and a row's
 * edge. With `now`, a searched area says how long ago: "Searched 3 h ago".
 */
export function areaState(area, now = null) {
  if (!area) return '';
  if (area.status === 'IN_PROGRESS') {
    const names = (area.who || []).map((w) => w.name);
    const doing = isSeenCircle(area) ? 'is there' : 'is searching it';
    if (names.length === 1) return `${names[0]} ${doing}`;
    return area.on > 1 ? `${area.on} people on it` : isSeenCircle(area) ? 'Someone is there' : 'Being searched';
  }
  if (area.status === 'NEEDS_REVISIT') return 'Another look';
  if (area.searchCount > 0 && now != null && area.searchedAt) return `Searched ${agoShort(area.searchedAt, now)}`;
  if (area.searchCount > 0) return `Searched ${timesWords(area.searchCount)}`;
  return 'Not searched';
}

/**
 * What has happened on an area, as the Ground list says it: who is on it
 * and since when, or when it was last searched, how many times, and by
 * whom. Names are whatever the board sent: it sends them only to the
 * owner and the forces looking for the pet. `owner` is the owner's first
 * name and `isOwner` whether the reader is them, for the circle round a
 * sighting the owner set off for.
 */
export function areaLine(area, { timeZone, now = Date.now(), owner = null, isOwner = false } = {}) {
  if (!area) return '';
  const there = isSeenCircle(area);
  const before = area.searchCount > 0 ? ` Searched ${timesWords(area.searchCount)} before.` : '';
  if (area.status === 'IN_PROGRESS') {
    const names = (area.who || []).map((w) => w.name);
    const since = area.claimedAt ? `, since ${clockTime(area.claimedAt, timeZone)}` : '';
    const doing = there ? 'there' : 'searching it';
    if (names.length) return `${listWords(names)} ${names.length === 1 ? 'is' : 'are'} ${doing}${since}.${before}`;
    return `${area.on === 1 ? '1 person is' : `${area.on} people are`} ${doing}${since}.${before}`;
  }
  if (there && area.going) {
    const at = clockTime(area.going.at, timeZone);
    return isOwner ? `You set off for it at ${at}.` : `${owner || 'The owner'} set off for it at ${at}.`;
  }
  if (area.searchCount > 0) {
    const by = area.searchedByName ? (area.marked ? `, put down by ${area.searchedByName}` : `, by ${area.searchedByName}`) : '';
    // How long ago first, then the clock: the age is what a search is run on.
    const when = `${agoWords(area.searchedAt, now)} ${whenWords(area.searchedAt, timeZone, now)}`;
    const last = area.searchCount === 1 ? `Searched once, ${when}${by}.` : `Searched ${timesWords(area.searchCount)}. Last ${when}${by}.`;
    return area.status === 'NEEDS_REVISIT' ? `${last} Down for another look.` : last;
  }
  return there ? 'Nobody has gone there yet.' : 'Not searched yet.';
}

/**
 * The facts about one area, for the card that opens when it is picked:
 * where it is and how long it takes, whether the pet was seen in it, what
 * has happened on it, and who was asked to search it.
 */
export function areaFacts(area, { picture = null, circle = null, now = Date.now() } = {}) {
  if (!area) return [];
  const name = picture?.pet?.name || 'the pet';
  const zone = picture?.timeZone;
  const facts = [`${whereWords(area)} About ${area.minutes} minutes for one person.`];
  if (!isSeenCircle(area) && circle?.center) {
    const seen = (picture?.sightings || [])
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && inArea({ lat: s.lat, lng: s.lng }, circle.center, area))
      .sort((a, b) => new Date(b.at) - new Date(a.at))[0];
    if (seen) facts.push(`${name} was seen in it ${whenWords(seen.at, zone, now)}.`);
  }
  // What the map shows in it that someone on foot should know of, so the person asking knows before they ask.
  facts.push(...hazardLines(area, { advice: false }));
  facts.push(areaLine(area, { timeZone: zone, now, owner: picture?.owner?.firstName || null, isOwner: Boolean(picture?.viewer?.isOwner) }));
  for (const ask of area.asked || []) {
    facts.push(`${ask.name} was asked to ${isSeenCircle(area) ? 'go' : 'search it'} at ${clockTime(ask.at, zone)}${ask.seenAt ? ' and has seen that' : ''}.`);
  }
  if (area.first) facts.push('The next people who ask for ground are sent here first.');
  return facts;
}

/**
 * The ground in numbers, over the circle's own areas: how many, how many
 * searched at least once (`searched`), how many of those nobody is on
 * right now (`done`, the green of the bar), how many being searched, how
 * many up for another look, what nobody has searched or is on (`left`)
 * and how long that takes one person. `people` is everyone on any area
 * now, a sighting's circle included.
 */
export function groundCoverage(areas = [], now = Date.now()) {
  const own = circleAreas(areas);
  const left = own.filter((a) => !(a.searchCount > 0) && a.status !== 'IN_PROGRESS');
  return {
    total: own.length,
    searched: own.filter((a) => a.searchCount > 0).length,
    done: own.filter((a) => a.searchCount > 0 && a.status !== 'IN_PROGRESS').length,
    searching: own.filter((a) => a.status === 'IN_PROGRESS').length,
    again: own.filter((a) => a.status === 'NEEDS_REVISIT').length,
    // Searched a day or more ago: the search has faded, and the ground is as good as unsearched again.
    faded: own.filter((a) => isFaded(a, now)).length,
    left: left.length,
    minutesLeft: left.reduce((sum, a) => sum + (Number(a.minutes) || 0), 0),
    people: areas.reduce((sum, a) => sum + (Number(a.on) || 0), 0),
  };
}

/** The ground in sentences, for "What the search shows". `circle` is the board's ({ radius, ... }). */
export function groundLines({ areas = [], circle = null, name = 'the pet' } = {}) {
  const c = groundCoverage(areas);
  if (!c.total) return [];
  const within = circle?.radius ? ` within ${metersWords(circle.radius)}` : '';
  const lines = [];
  if (c.searched === 0 && c.searching === 0) lines.push(`${c.total} areas of ground${within} of where ${name} was lost. None has been searched yet.`);
  else if (c.searched === c.total) lines.push(`All ${c.total} areas${within} have been searched at least once.`);
  else lines.push(`${c.searched} of the ${c.total} areas${within} ${c.searched === 1 ? 'has' : 'have'} been searched${c.searching ? `, and ${c.searching === 1 ? '1 is' : `${c.searching} are`} being searched now` : ''}.`);
  if (c.left > 0) lines.push(`Searching the ${c.left === 1 ? 'one' : c.left} left takes one person ${durationWords(c.minutesLeft)}.`);
  if (c.again > 0) lines.push(`${c.again === 1 ? '1 area is' : `${c.again} areas are`} down for another look.`);
  return lines;
}

/**
 * The areas as the next person to ask would find them, whoever is reading:
 * the reader may be on an area themselves, or asked to search one, and a
 * circle round a sighting that the reader is at, or the owner has set off
 * for, is given to nobody else. (The board says `full` for the person it
 * is sent to, and the owner's own setting off does not keep the owner out.)
 */
export function forAnyoneElse(areas = []) {
  return areas.map((a) => ({ ...a, mine: false, askedOfMe: false, full: Boolean(a.full || (isSeenCircle(a) && (a.going || a.on > 0))) }));
}

/**
 * Why an area is the one offered to a free person, as a fact about that
 * area: nothing here speaks for the areas it was not. `everySearched` is
 * whether every area of the circle has been searched at least once.
 */
export function whyThisArea(area, { name = 'the pet', timeZone, now = Date.now(), everySearched = false } = {}) {
  if (!area) return '';
  if (area.status === 'IN_PROGRESS') return `${AreaName(area)} has ${area.on === 1 ? '1 person' : `${area.on} people`} on it, and room for more.`;
  if (area.status === 'NEEDS_REVISIT') return `${AreaName(area)} is down for another look.`;
  if (area.searchCount > 0) {
    const last = area.searchedAt ? `${AreaName(area)} was last searched ${whenWords(area.searchedAt, timeZone, now)}.` : `${AreaName(area)} has been searched ${timesWords(area.searchCount)}.`;
    return everySearched ? `Every area has been searched. ${last}` : last;
  }
  return isSeenCircle(area) ? `Nobody has gone to where ${name} was seen.` : `${AreaName(area)} has not been searched.`;
}

/**
 * The areas a helper who asks now is given one of: the first in the order
 * ground is given out in (app/lib/searchCircle.js, rankAreas), and all of
 * them where several are as urgent as each other and nobody is on any (a
 * phone then gives the one nearest its helper, which a desk cannot know).
 */
export function givenNextAreas(areas = []) {
  const order = rankAreas(forAnyoneElse(areas));
  if (!order.length) return [];
  const [top] = order;
  const open = (a) => (a.status === 'UNSEARCHED' || a.status === 'NEEDS_REVISIT') && !a.on && !a.coming;
  if (!open(top)) return [areas.find((a) => a.id === top.id)];
  // A sighting's circle is given before the side the pet was seen in, however urgent that side is: it ties with nothing.
  const tied = new Set(order.filter((a) => open(a) && a.priority === top.priority && isSeenCircle(a) === isSeenCircle(top)).map((a) => a.id));
  return areas.filter((a) => tied.has(a.id));
}

/** "30", or "30 to 45": how long the ground that could be given takes, so the first card never contradicts the area that is. */
export function minutesRange(areas = []) {
  const all = areas.filter((a) => !a.full && !a.mine && !(a.searchCount > 0)).map((a) => a.minutes).filter(Number.isFinite);
  const from = all.length ? all : areas.map((a) => a.minutes).filter(Number.isFinite);
  if (!from.length) return '';
  const low = Math.min(...from);
  const high = Math.max(...from);
  return low === high ? `${low}` : `${low} to ${high}`;
}

/** What the desk says when nothing is waiting: what the search is doing by itself. */
export function quietGround({ areas = [], people = [] } = {}) {
  const out = people.filter((p) => p.state === 'walking').length;
  const doing = out === 0 ? 'Nobody is out right now.' : out === 1 ? '1 person is out searching.' : `${out} people are out searching.`;
  const next = givenNextAreas(areas);
  if (!next.length) return doing;
  return next.length === 1 ? `${doing} The next person who asks is given ${areaName(next[0])}.` : `${doing} The next person who asks is given the nearest of the ${next.length} most urgent areas.`;
}

/** "The middle 3 times, the south side twice, the rest once." */
export function coveredWords(areas = []) {
  const own = circleAreas(areas);
  if (!own.length) return '';
  const least = Math.min(...own.map((a) => a.searchCount));
  const more = own.filter((a) => a.searchCount > least).sort((a, b) => b.searchCount - a.searchCount);
  if (!more.length) return `Each ${timesWords(least)}.`;
  if (more.length === own.length - 1 && own.length > 2) {
    // All but one: said from the one.
    const rest = own.find((a) => a.searchCount === least);
    return `${AreaName(rest)} ${timesWords(least)}, the rest more.`;
  }
  const named = more.slice(0, 3).map((a) => `${areaName(a)} ${timesWords(a.searchCount)}`);
  return `${capital(named.join(', '))}, the rest ${timesWords(least)}.`;
}

function sightingCard({ picture, areas, people, name, now }) {
  const seen = [...(picture.sightings || [])].filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng)).sort((a, b) => new Date(b.at) - new Date(a.at))[0];
  if (!seen || now - new Date(seen.at).getTime() > SIGHTING_NEEDS_MS) return null;
  const zone = picture.timeZone;
  const origin = picture.lastSeen && Number.isFinite(picture.lastSeen.lat) ? picture.lastSeen : null;
  const where = placeWords(seen.place);
  const far = origin ? distanceMeters(origin, seen) : NaN;
  const fromLost = Number.isFinite(far) ? `${metersWords(far)} ${far >= 50 ? `${directionWord(origin, seen)} of` : 'from'} where ${name} was lost.` : '';
  const show = { words: 'Show it on the map', do: { type: 'show', sightingId: seen.id } };
  // One named person goes to a sighting, never a group: the card says who that is, and asks nobody else.
  const one = 'One person goes to a sighting, never a group.';
  const ring = areas.find((a) => isSeenCircle(a) && a.sightingId === seen.id) || null;
  const there = ring?.who?.[0] || null;
  const asked = ring?.asked?.[0] || null;
  const facts = [fromLost];
  let primary = show;
  const more = [];
  if (there) {
    facts.push(`${there.name} is there. ${one}`);
    primary = { words: `Write to ${there.name}`, do: { type: 'write', handle: there.handle } };
    more.push(show);
  } else if (ring?.going || seen.ownerGoingAt || asked) {
    // The owner set off, someone was asked to go, or both: an ask is the owner's own word, and stands beside their setting off.
    const went = ring?.going?.at || seen.ownerGoingAt;
    const said = [];
    if (went) said.push(`${picture.viewer?.isOwner ? 'You' : picture.owner?.firstName || 'The owner'} set off for it at ${clockTime(went, zone)}.`);
    if (asked) said.push(`${asked.name} was asked to go at ${clockTime(asked.at, zone)}${asked.seenAt ? ' and has seen that' : ''}.`);
    // With both, two people are going by the owner's own word, so the card does not say one goes.
    facts.push(`${said.join(' ')} ${said.length > 1 ? 'Nobody else is given it.' : one}`);
  } else if (ring) {
    // Someone free who joined or finished lately: a person who was here two days ago is not someone to send.
    const lately = (p) => {
      const since = p.lastWalkedAt || p.joinedAt;
      return Boolean(since) && now - new Date(since).getTime() <= FREE_NEEDS_MS;
    };
    // The one whose last area was nearest: the nearest thing to where they are that the search knows.
    const pick = people
      .filter((p) => p.state === 'free' && lately(p))
      .map((p) => {
        const last = p.lastOn ? areas.find((a) => a.id === p.lastOn.id) : null;
        return { person: p, meters: last?.center ? distanceMeters(last.center, seen) : Infinity };
      })
      .sort((a, b) => a.meters - b.meters)[0];
    if (pick) {
      facts.push(`${pick.person.name} is free. ${one}`);
      primary = { words: `Ask ${pick.person.name} to go`, do: { type: 'ask', handle: pick.person.handle, areaId: ring.id } };
      more.push(show);
    } else {
      facts.push('Nobody is free right now. The next person who asks for ground is given it.');
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
 * "Needs you" for a search on areas: the things waiting for the person
 * running it, most pressing first, each with one thing to do about it.
 * The same cards as lib/needs.js describes, and `do` the same: { type:
 * 'ask', handle, areaId } asks that person at once, { type: 'give', handle,
 * areaId } opens them with an area picked, { type: 'write', handle },
 * { type: 'show', sightingId }, { type: 'widen' }, { type: 'againAll' },
 * { type: 'done', key }. For whoever runs the search (`leads`); anyone else
 * gets none.
 */
export function needsForGround({ picture, areas = [], circle = null, people = [], words = [], leads = false, put = new Set(), now = Date.now() } = {}) {
  if (!picture || !leads || !picture.open) return [];
  const name = picture.pet?.name || 'the pet';
  const zone = picture.timeZone;
  const cards = [];

  const seen = sightingCard({ picture, areas, people, name, now });
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

  // Each free person is offered different ground: the areas in the order they are given out, one each. The
  // circle round a sighting that has its own card above is that card's to deal with: one person is asked to go
  // there, once, and the others are offered the ground round it.
  const order = rankAreas(forAnyoneElse(areas)).filter((a) => !(seen && isSeenCircle(a) && `seen-${a.sightingId}` === seen.id));
  const circleOwn = circleAreas(areas);
  const everySearched = circleOwn.length > 0 && circleOwn.every((a) => a.searchCount > 0);
  let turn = 0;
  // The person the sighting's card offers to send is that card's too: one card about them, not two.
  const sent = seen?.primary.do.type === 'ask' ? seen.primary.do.handle : null;
  for (const p of people) {
    if (p.state !== 'free' || p.handle === sent) continue;
    const since = p.lastWalkedAt || p.joinedAt;
    if (!since) continue;
    const idle = now - new Date(since).getTime();
    if (idle < FREE_GRACE_MS || idle > FREE_NEEDS_MS) continue;
    const ranked = order[turn] || order[0] || null;
    const area = ranked ? areas.find((a) => a.id === ranked.id) : null;
    turn += 1;
    const why = whyThisArea(area, { name, timeZone: zone, now, everySearched });
    cards.push({
      id: `free-${p.handle}`,
      kind: 'free',
      label: 'No area yet',
      title: p.walked > 0 ? `${p.name} finished ${agoWords(since, now)}` : `${p.name} joined ${agoWords(since, now)}`,
      body: why,
      primary: area
        ? { words: isSeenCircle(area) ? `Ask ${p.name} to go there` : `Ask ${p.name} to search ${areaName(area)}`, do: { type: 'ask', handle: p.handle, areaId: area.id } }
        : { words: `Write to ${p.name}`, do: { type: 'write', handle: p.handle } },
      more: [...(area ? [{ words: 'Pick another area', do: { type: 'give', handle: p.handle, areaId: area.id } }] : []), { words: 'Not now', do: { type: 'done', key: `free-${p.handle}-${new Date(since).getTime()}` } }],
    });
  }

  // Every area of the circle searched, and none put up for another look: the two things to do about it.
  const own = circleAreas(areas);
  if (circle && own.length > 0 && own.every((a) => a.searchCount > 0) && !own.some((a) => a.status === 'NEEDS_REVISIT')) {
    const key = `covered-${own.length}-${own.reduce((sum, a) => sum + a.searchCount, 0)}`;
    const widen = !circle.widened && circle.wide > circle.edge;
    const again = { words: 'Search these again', do: { type: 'againAll' } };
    cards.push({
      id: 'covered',
      kind: 'covered',
      label: 'The circle is covered',
      title: `Every area within ${metersWords(circle.radius)} has been searched`,
      body: `${coveredWords(own)}${widen ? ` Widening adds 8 areas, from ${metersWords(circle.edge)} to ${metersWords(circle.wide)}.` : ''}`,
      primary: widen ? { words: `Widen to ${metersWords(circle.wide)}`, do: { type: 'widen' } } : again,
      more: [...(widen ? [again] : []), { words: 'Not now', do: { type: 'done', key } }],
    });
  }

  for (const p of people) {
    const minutes = p.on ? areas.find((a) => a.id === p.on.id)?.minutes : null;
    const out = outLong(p, minutes, now);
    if (!out) continue;
    cards.push({
      id: `long-${p.handle}`,
      kind: 'long',
      label: 'Out a long time',
      title: `${p.name} started ${inWords(p.on.title)} ${out} minutes ago`,
      body: `It takes about ${minutes || 30} minutes.`,
      primary: { words: `Write to ${p.name}`, do: { type: 'write', handle: p.handle } },
      more: [{ words: 'Not now', do: { type: 'done', key: `long-${p.handle}-${new Date(p.since).getTime()}` } }],
    });
  }

  return cards.filter((c) => !put.has(c.id) && !c.more.some((m) => m.do.type === 'done' && put.has(m.do.key)));
}

/**
 * What happened, newest first, for a search on areas: the pet was lost and
 * seen and what the owner wrote (lib/insight.js, activity), and who started
 * and searched which area. Built from what the board and the picture
 * already carry, so it shows a name exactly where they do. An area's row
 * carries its last search, as a street's did.
 */
export function groundActivity({ areas = [], picture = null, now = Date.now() } = {}) {
  if (!picture) return [];
  const events = activity({ items: [], picture, now });
  for (const area of areas) {
    const title = areaName(area);
    for (const w of area.who || []) {
      if (w.since) events.push({ id: `start-${area.id}-${w.handle}`, at: w.since, kind: 'start', text: isSeenCircle(area) ? `${w.name} went to ${title}.` : `${w.name} started ${title}.`, streetId: area.id });
    }
    if (!(area.who || []).length && area.status === 'IN_PROGRESS' && area.claimedAt) events.push({ id: `start-${area.id}`, at: area.claimedAt, kind: 'start', text: `Someone started ${title}.`, streetId: area.id });
    if (area.searchedAt) {
      const who = area.searchedByName || 'Someone';
      events.push({ id: `walk-${area.id}-${new Date(area.searchedAt).getTime()}`, at: area.searchedAt, kind: 'walk', text: area.marked ? `${who} put ${title} down as searched.` : `${who} searched ${title}.`, streetId: area.id });
    }
  }
  return events.filter((e) => e.at && new Date(e.at).getTime() <= now + 5 * 60 * 1000).sort((a, b) => new Date(b.at) - new Date(a.at));
}
