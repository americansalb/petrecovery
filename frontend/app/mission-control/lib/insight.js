/**
 * What a search's own numbers say, for the desk (Mission Control on a
 * computer): how much ground is left and how long it takes, what the
 * sightings have in common, why a street is where it is in the order, and
 * what happened when. Pure, so every sentence is tested
 * (__tests__/lib/searchInsight.test.js).
 *
 * Everything here is a count, a time, a distance or a published finding
 * with its source. Nothing is advice (that is the advice engine's and the
 * searcher's brief's, word for word) and nothing is a guess about where
 * the pet is.
 */
import { distanceMeters } from '@/app/lib/searchGrid';
import { nearestOnPath, SIGHTING_REACH_METERS } from '@/app/lib/streetWalks';
import { clockTime, dayAndTime, placeWords } from './words';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * Published findings on how far from where they went missing lost pets
 * were found. Each was read in the paper itself on 2026-11-12:
 *
 *  - Dogs: Kremer T. A New Web-Based Tool for RTO-Focused Animal Shelter
 *    Data Analysis. Front Vet Sci. 2021;8:669428. Dallas Animal Services,
 *    fiscal year 2019 (October 2018 to September 2019), 5,228 stray dogs
 *    returned to their owners: "70% of dogs are not found beyond 1 mile
 *    away from their owner address", and 42% of all dogs "go <400 ft
 *    away". Straight-line distance from the owner's address to where the
 *    dog was picked up: from HOME, which is not always where a dog was
 *    lost.
 *  - Cats: Huang L, and others. Search Methods Used to Locate Missing
 *    Cats and Locations Where Missing Cats Are Found. Animals.
 *    2018;8(1):5. Cats found alive: "the median distance was 50 m (25th
 *    and 75th percentiles 9 and 500 m, respectively)", measured "from
 *    where the cat went missing to where it was found".
 *
 * The sentences below say only that, with the study's own limits (whose
 * dogs, which cats, measured from where). They do not say where this pet
 * is. A ring on the map is labelled with its distance and nothing else:
 * a share of dogs written on this pet's map would read as a claim about
 * this pet. `show` is what the button that draws them says.
 */
export const RESEARCH = {
  DOG: {
    rings: [
      { meters: 122, label: '400 ft' },
      { meters: 1609, label: '1 mile' },
    ],
    line: 'In Dallas shelter records for the 2019 fiscal year, of 5,228 stray dogs returned to their owners, 42% were picked up within 400 feet of home and 70% within a mile.',
    show: 'Show 400 ft and 1 mile',
    source: 'Kremer, Frontiers in Veterinary Science, 2021',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8185155/',
  },
  CAT: {
    rings: [
      { meters: 50, label: '50 m' },
      { meters: 500, label: '500 m' },
    ],
    line: 'In a study of missing cats, half of the cats found alive were within 50 metres of where they went missing, and 3 in 4 within 500 metres.',
    show: 'Show 50 m and 500 m',
    source: 'Huang and others, Animals, 2018',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5789300/',
  },
};

/** The finding for a species, or null where there is none to cite. */
export function researchFor(species) {
  return RESEARCH[String(species || '').toUpperCase()] || null;
}

const isOpen = (i) => i.status === 'UNSEARCHED' || i.status === 'NEEDS_REVISIT';

/** Walked at least once, whatever it is now: a street put up for another look, or on its second pass, has still been walked. */
const wasWalked = (i) => i.status === 'SEARCHED' || Number(i.searchCount) > 0;

/**
 * The ground: how many streets, how many walked at least once (`searched`),
 * how many of those are not being walked again right now (`done`, the
 * green of the bar), how many being walked, how many up for another look,
 * and the walking that is left.
 */
export function coverage(items = []) {
  const total = items.length;
  const searched = items.filter(wasWalked).length;
  const walking = items.filter((i) => i.status === 'IN_PROGRESS').length;
  const done = items.filter((i) => wasWalked(i) && i.status !== 'IN_PROGRESS').length;
  const again = items.filter((i) => i.status === 'NEEDS_REVISIT').length;
  const open = items.filter(isOpen);
  const minutesLeft = open.reduce((sum, i) => sum + (Number(i.minutes) || 0), 0);
  return { total, searched, done, walking, again, open: open.length, minutesLeft, share: total ? searched / total : 0 };
}

/** "about 40 minutes", "about 1 hour", "about 2 and a half hours", "about 7 hours". */
export function durationWords(minutes) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 55) return `about ${Math.max(5, Math.round(m / 5) * 5)} minutes`;
  const halves = Math.round(m / 30);
  const whole = Math.floor(halves / 2);
  const half = halves % 2 === 1;
  if (whole === 0) return 'about half an hour';
  if (whole === 1) return half ? 'about an hour and a half' : 'about 1 hour';
  return half ? `about ${whole} and a half hours` : `about ${whole} hours`;
}

/**
 * The ground in sentences. `thing` is "street" or "block". The time left
 * is given for one person and, where several are on a street right now,
 * for that many: a sum, said as a sum, and not a promise about people who
 * are busy on streets of their own.
 */
export function groundLines({ items = [], unit = 'street', name = 'the pet' } = {}) {
  const thing = unit === 'block' ? 'block' : 'street';
  const c = coverage(items);
  if (!c.total) return [];
  const lines = [];
  if (c.searched === 0 && c.walking === 0) lines.push(c.total === 1 ? `1 ${thing} around where ${name} was lost. It has not been walked yet.` : `${c.total} ${thing}s around where ${name} was lost. None has been walked yet.`);
  else if (c.total === 1) lines.push(c.walking ? `The one ${thing} is being walked now.` : `The one ${thing} has been walked.`);
  else lines.push(`${c.searched} of ${c.total} ${thing}s ${c.searched === 1 ? 'has' : 'have'} been walked${c.walking ? `, and ${c.walking === 1 ? '1 is' : `${c.walking} are`} being walked now` : ''}.`);
  if (c.open > 0) {
    const alone = `Walking the ${c.open === 1 ? 'one' : c.open} still to walk takes one person ${durationWords(c.minutesLeft)}`;
    lines.push(c.walking >= 2 ? `${alone}, or ${c.walking} people ${durationWords(c.minutesLeft / c.walking)}.` : `${alone}.`);
  } else if (c.walking === 0) {
    lines.push(`Every ${thing} has been walked at least once.`);
  }
  if (c.again > 0) lines.push(`${c.again === 1 ? `1 ${thing} is` : `${c.again} ${thing}s are`} marked for another look.`);
  return lines;
}

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

/** The compass word for the way from `a` to `b`. */
export function directionWord(a, b) {
  const dLat = b.lat - a.lat;
  const dLng = (b.lng - a.lng) * Math.cos((a.lat * Math.PI) / 180);
  const degrees = (Math.atan2(dLng, dLat) * 180) / Math.PI;
  return COMPASS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

/** "120 m", "0.8 km": a straight-line distance, rounded as people say it. */
export function metersWords(meters) {
  if (!Number.isFinite(meters)) return '';
  if (meters < 50) return 'under 50 m';
  // 995 m and up is said in kilometres, so it is never "1000 m".
  if (meters < 995) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** A time as a sentence says it: "at 9:30 pm" today, "on Tue at 8:00 pm" this week, "on Nov 3" before that. */
export function whenWords(date, timeZone, now = Date.now()) {
  const words = dayAndTime(date, timeZone, now);
  if (!words) return '';
  if (/^\d/.test(words)) return `at ${words}`;
  const space = words.indexOf(' ');
  // "Tue 8:00 pm" is a day and a clock time; "Nov 3" is a date.
  return /\d:\d\d/.test(words) ? `on ${words.slice(0, space)} at ${words.slice(space + 1)}` : `on ${words}`;
}

function hourIn(date, timeZone) {
  try {
    return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timeZone || undefined }).format(new Date(date))) % 24;
  } catch {
    return new Date(date).getHours();
  }
}

/**
 * What the sightings have in common, as far as the sightings themselves
 * say: how many and since when, where the newest is from where the pet was
 * lost, whether each was farther out than the one before, whether they all
 * lie the same way, and whether they were all at night. A pattern is only
 * stated where every sighting fits it.
 */
export function sightingLines({ sightings = [], lastSeen = null, timeZone, now = Date.now(), name = 'the pet' } = {}) {
  const origin = lastSeen && Number.isFinite(lastSeen.lat) && Number.isFinite(lastSeen.lng) ? { lat: lastSeen.lat, lng: lastSeen.lng } : null;
  const seen = sightings.filter((s) => s && Number.isFinite(s.lat) && Number.isFinite(s.lng)).sort((a, b) => new Date(a.at) - new Date(b.at));
  if (!seen.length) return [`Nobody has reported seeing ${name} yet.`];
  const lines = [];
  const first = seen[0];
  const newest = seen[seen.length - 1];
  const where = placeWords(newest.place);
  const far = origin ? distanceMeters(origin, newest) : NaN;
  const fromLost = origin && Number.isFinite(far) ? `${metersWords(far)} ${far >= 50 ? `${directionWord(origin, newest)} of` : 'from'} where ${name} was lost` : '';
  if (seen.length === 1) {
    lines.push(`1 sighting, ${whenWords(newest.at, timeZone, now)}${where ? ` ${where}` : ''}${fromLost ? `, ${fromLost}` : ''}.`);
    return lines;
  }
  lines.push(`${seen.length} sightings since ${dayAndTime(first.at, timeZone, now)}. The latest was ${whenWords(newest.at, timeZone, now)}${where ? ` ${where}` : ''}${fromLost ? `, ${fromLost}` : ''}.`);
  if (origin) {
    const away = seen.map((s) => distanceMeters(origin, s));
    // "Farther each time" needs three, and each step has to be a real one.
    if (seen.length >= 3 && away.every((d, i) => i === 0 || d > away[i - 1] + 30)) lines.push(`Each was farther from where ${name} was lost than the one before.`);
    const ways = seen.filter((s, i) => away[i] >= 50).map((s) => directionWord(origin, s));
    if (ways.length === seen.length && ways.every((w) => w === ways[0])) lines.push(`${seen.length === 2 ? 'Both' : `All ${seen.length}`} were ${ways[0]} of where ${name} was lost.`);
  }
  const hours = seen.map((s) => hourIn(s.at, timeZone));
  if (hours.every((h) => h >= 20 || h < 6)) lines.push(`${seen.length === 2 ? 'Both' : `All ${seen.length}`} were between 8 pm and 6 am.`);
  else if (hours.every((h) => h >= 6 && h < 20)) lines.push(`${seen.length === 2 ? 'Both' : `All ${seen.length}`} were between 6 am and 8 pm.`);
  return lines;
}

/**
 * A street's card names a sighting inside this distance of it. It is the
 * distance at which a fresh sighting moves a street up the order
 * (app/lib/searchBoard.js, livePriority), so the card says why it moved.
 */
const NEAR_SIGHTING_METERS = SIGHTING_REACH_METERS * 2;

/**
 * The facts about one street, for the card that opens when it is picked:
 * how far it is from where the pet was lost, whether a sighting is next
 * to it, and what has happened on it. Names are whatever the board sent:
 * it sends them only to the owner and the forces looking for the pet.
 */
export function streetFacts(street, { lastSeen = null, sightings = [], timeZone, now = Date.now(), name = 'the pet', unit = 'street' } = {}) {
  if (!street) return [];
  const facts = [];
  const center = street.center;
  const origin = lastSeen && Number.isFinite(lastSeen.lat) ? { lat: lastSeen.lat, lng: lastSeen.lng } : null;
  if (origin && center) {
    const d = distanceMeters(origin, center);
    facts.push(d < 50 ? `Right where ${name} was lost.` : `${metersWords(d)} ${directionWord(origin, center)} of where ${name} was lost.`);
  }
  // Measured from the street's own line, as the order of the streets is: a long street is next to a sighting anywhere along it.
  const apart = (s) => {
    const on = Array.isArray(street.path) && street.path.length > 1 ? nearestOnPath(s, street.path) : null;
    if (on && Number.isFinite(on.meters)) return on.meters;
    return center ? distanceMeters(center, s) : Infinity;
  };
  const near = sightings
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && apart(s) <= NEAR_SIGHTING_METERS)
    .sort((a, b) => new Date(b.at) - new Date(a.at))[0];
  // The distance itself, so "near" is never left to mean more than it does.
  if (near) facts.push(apart(near) < 30 ? `${name} was seen on it ${whenWords(near.at, timeZone, now)}.` : `${metersWords(apart(near))} from where ${name} was seen ${whenWords(near.at, timeZone, now)}.`);
  const who = (n) => n || 'Someone';
  if (street.status === 'IN_PROGRESS') facts.push(`${who(street.claimedByName)} has been on it since ${clockTime(street.claimedAt, timeZone)}.`);
  if (street.searchedAt) {
    const times = street.searchCount > 1 ? ` It has been walked ${street.searchCount} times in all.` : '';
    // Put down from the desk for someone who walked it without the site: said as that, never as the owner's own walk.
    if (street.marked) facts.push(`${who(street.searchedByName)} put it down as walked ${whenWords(street.searchedAt, timeZone, now)}, for someone who walked it without the site.${times}`);
    else facts.push(`${who(street.searchedByName)} walked it ${whenWords(street.searchedAt, timeZone, now)}.${times}`);
  } else if (street.status !== 'IN_PROGRESS') {
    facts.push(`Nobody has walked this ${unit === 'block' ? 'block' : 'street'}.`);
  }
  if (street.status === 'NEEDS_REVISIT') facts.push('Marked for another look.');
  return facts;
}

/** The state of a street in two or three words, for a list row and the map's label. */
export function stateWords(street) {
  if (!street) return '';
  if (street.status === 'IN_PROGRESS') return street.claimedByName ? `${street.claimedByName} is on it` : 'Being walked';
  if (street.status === 'SEARCHED') return 'Walked';
  if (street.status === 'NEEDS_REVISIT') return 'Another look';
  return 'Not walked';
}

/**
 * Streets nobody has walked, most urgent first: the board's own order,
 * which is the order a helper is given them in. (Among streets of the
 * same urgency a helper gets the one nearest to them, which a desk cannot
 * know, so those stay as the board sent them.)
 */
export function lookFirst(items = []) {
  return items.filter(isOpen).sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

/**
 * The streets a helper who asks now is given one of: the most urgent
 * still to walk, all of them where several are as urgent as each other
 * (a phone then gives the one nearest its helper, which a desk cannot
 * know, so no single one of them can be called "the next"). One kept for
 * someone who was asked is not given to anyone else.
 */
export function givenNext(items = []) {
  const open = lookFirst(items).filter((i) => !i.reserved);
  if (!open.length) return [];
  const top = open[0].priority || 0;
  return open.filter((i) => (i.priority || 0) === top);
}

/**
 * What happened, newest first: the pet was lost, streets were started and
 * walked, the pet was seen, the owner wrote something. Built from what the
 * board and the picture already carry, so it shows a name exactly where
 * they do.
 */
export function activity({ items = [], picture = null, now = Date.now() } = {}) {
  if (!picture) return [];
  const name = picture.pet?.name || 'The pet';
  const events = [];
  if (picture.lastSeen?.at) {
    events.push({ id: 'lost', at: picture.lastSeen.at, kind: 'lost', text: `${name} was lost${picture.lastSeen.place ? ` near ${picture.lastSeen.place}` : ''}.` });
  }
  for (const s of picture.sightings || []) {
    const where = placeWords(s.place);
    events.push({ id: `seen-${s.id}`, at: s.at, kind: 'seen', text: `${name} was seen${where ? ` ${where}` : ''}${s.by ? `, reported by ${s.by}` : ''}.`, sightingId: s.id });
    if (s.ownerGoingAt && picture.owner?.firstName) events.push({ id: `going-${s.id}`, at: s.ownerGoingAt, kind: 'owner', text: `${picture.owner.firstName} set off for it.`, sightingId: s.id });
  }
  for (const i of items) {
    const title = i.title || i.name;
    if (i.status === 'IN_PROGRESS' && i.claimedAt) events.push({ id: `start-${i.id}`, at: i.claimedAt, kind: 'start', text: `${i.claimedByName || 'Someone'} started ${title}.`, streetId: i.id });
    if (i.searchedAt) events.push({ id: `walk-${i.id}`, at: i.searchedAt, kind: 'walk', text: i.marked ? `${i.searchedByName || 'Someone'} put ${title} down as walked.` : `${i.searchedByName || 'Someone'} walked ${title}.`, streetId: i.id });
  }
  // What the owner told everyone helping: the picture sends only the owner's own words (app/lib/searchPicture.js).
  const owner = picture.owner?.firstName || null;
  for (const u of picture.updates || []) {
    events.push({ id: `said-${u.id}`, at: u.at, kind: 'said', text: owner ? `${owner}: ${u.text}` : u.text });
  }
  return events
    .filter((e) => e.at && new Date(e.at).getTime() <= now + 5 * MINUTE)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}

/** "4 days", "6 hours", "40 minutes": how long the pet has been missing, for the number at the top. */
export function missingFor(lostAt, now = Date.now()) {
  if (!lostAt) return '';
  const ms = Math.max(0, now - new Date(lostAt).getTime());
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))} min`;
  if (ms < 48 * HOUR) return `${Math.round(ms / HOUR)} ${Math.round(ms / HOUR) === 1 ? 'hour' : 'hours'}`;
  return `${Math.round(ms / (24 * HOUR))} days`;
}
