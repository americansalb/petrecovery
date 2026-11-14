/**
 * The facts of a search, in sentences: the line at the top of the search
 * screen, the times, the places. Pure, so every sentence is tested
 * (__tests__/lib/searchWords.test.js).
 *
 * These are facts, never advice. Advice on the screen comes from the
 * searcher's brief (app/lib/brief.js), the finder guide the owner's own
 * answers produce (app/lib/caseDetails.js) and the advice engine
 * (app/lib/adviceFor.js), word for word. Nothing here tells anyone what
 * to do.
 */
import { speciesLabel } from '@/app/lib/species';

/** A sighting this fresh turns the line at the top orange on every screen. The pet's page uses the same hour (app/cases/[caseNumber]/CasePageClient.js). */
export const HOT_SIGHTING_MS = 60 * 60 * 1000;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "9:40 pm", in the pet's own time zone, so everyone reads the same clock. */
export function clockTime(date, timeZone) {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timeZone || undefined })
      .format(new Date(date))
      .replace(/ | /g, ' ')
      .replace('AM', 'am')
      .replace('PM', 'pm');
  } catch {
    return '';
  }
}

function dayKey(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timeZone || undefined }).format(new Date(date));
}

/** "9:40 pm" today, "Tue 7:10 pm" this week, "Nov 3" before that. */
export function dayAndTime(date, timeZone, now = Date.now()) {
  if (!date) return '';
  const then = new Date(date);
  if (dayKey(then, timeZone) === dayKey(now, timeZone)) return clockTime(then, timeZone);
  if (now - then.getTime() < 6 * DAY) {
    const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timeZone || undefined }).format(then);
    return `${day} ${clockTime(then, timeZone)}`;
  }
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: timeZone || undefined }).format(then);
}

/** "just now", "30 minutes ago", "2 hours ago", "3 days ago". */
export function agoWords(date, now = Date.now()) {
  if (!date) return '';
  const ms = Math.max(0, now - new Date(date).getTime());
  if (ms < 2 * MINUTE) return 'just now';
  if (ms < HOUR) return `${Math.round(ms / MINUTE)} minutes ago`;
  if (ms < DAY) {
    const hours = Math.round(ms / HOUR);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  const days = Math.round(ms / DAY);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** "Day 4": the day of the search, counting the day the pet was lost as day 1. */
export function searchDay(lostAt, now = Date.now()) {
  if (!lostAt) return null;
  return Math.max(1, Math.floor((now - new Date(lostAt).getTime()) / DAY) + 1);
}

/** "Avery's dog, black and tan": who this is, under the name. */
export function petSub({ owner = null, species, color = '', breed = '' } = {}) {
  const kind = speciesLabel(species).toLowerCase();
  const whose = owner ? `${owner}'s ${kind}` : `Lost ${kind}`;
  const looks = [colorWords(color), breed && !/^unknown$/i.test(breed) ? String(breed).trim().toLowerCase() : '']
    .filter(Boolean)
    .join(' ');
  return looks ? `${whose}, ${looks}` : whose;
}

/**
 * A pet's colours as a person says them. The report keeps a list ("Dark brown, Brown"), which after
 * "Kevin's dog," read as a sentence that had lost its way: "Kevin's dog, dark brown, brown". The last
 * two are joined with "and", a colour named twice is said once.
 */
function colorWords(color) {
  const seen = new Set();
  const list = String(color || '')
    .split(/\s*[,;/]\s*/)
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c && !seen.has(c) && seen.add(c));
  if (list.length < 2) return list[0] || '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** "at W 40th St and Ramsey Ave", "on Ramsey Ave", "near Zilker Park", or ''. */
export function placeWords(place) {
  const label = String(place || '').trim();
  if (!label) return '';
  if (/ and /.test(label)) return `at ${label}`;
  if (/\b(St|Ave|Blvd|Rd|Dr|Ln|Ct|Pl|Pkwy|Cir|Trl|Ter|Hwy|Way|Street|Avenue|Road|Drive|Lane)$/i.test(label)) return `on ${label}`;
  return `near ${label}`;
}

/** The newest sighting, if it is under an hour old. */
export function hotSighting(sightings = [], now = Date.now()) {
  const newest = sightings[0];
  if (!newest) return null;
  return now - new Date(newest.at).getTime() <= HOT_SIGHTING_MS ? newest : null;
}

/** Past this, a sighting the owner never opened is history, not news: the map still shows it. */
const UNOPENED_NEWS_MS = 48 * 60 * 60 * 1000;

/**
 * The sighting that leads the owner's screen: the newest place the pet
 * was seen, while that is news to the owner. It is news when the pet was
 * seen within the hour, when it only reached the owner within the hour
 * ("seen yesterday", sent now), and for as long as the owner has not
 * opened it, then an hour more: someone who wakes at seven to a sighting
 * from two in the night still gets the card and its directions.
 */
export function ownerSighting(sightings = [], now = Date.now()) {
  const newest = sightings[0];
  if (!newest) return null;
  const since = (date) => (date ? now - new Date(date).getTime() : Infinity);
  if (Math.min(since(newest.at), since(newest.sentAt), since(newest.ownerSeenAt)) <= HOT_SIGHTING_MS) return newest;
  // Not opened yet, and not yet history.
  if (!newest.ownerSeenAt && Math.min(since(newest.at), since(newest.sentAt)) <= UNOPENED_NEWS_MS) return newest;
  return null;
}

/**
 * The one sentence at the top of every search screen: where the search
 * stands. { text, tone } where tone is 'lost', 'seen', 'home' or 'closed'.
 */
export function situationLine(picture, now = Date.now()) {
  if (!picture) return { text: '', tone: 'lost' };
  const name = picture.pet?.name || 'The pet';
  const zone = picture.timeZone;
  if (picture.reunited) return { text: `${name} is home.`, tone: 'home' };
  if (!picture.open) return { text: 'This search has ended.', tone: 'closed' };
  const hot = hotSighting(picture.sightings, now);
  if (hot) {
    const bits = [`Seen at ${clockTime(hot.at, zone)}`, placeWords(hot.place)].filter(Boolean).join(' ');
    // Everyone looking learns the owner is heading there. It is a fact about the owner, and asks nothing of anyone.
    const owner = picture.owner?.firstName;
    const coming = hot.ownerGoingAt && owner && !picture.viewer?.isOwner ? ` ${owner} is on the way.` : '';
    return { text: `${bits}.${coming}`, tone: 'seen' };
  }
  const lost = picture.lastSeen?.at ? `Lost ${agoWords(picture.lastSeen.at, now)}` : 'Lost';
  const from = picture.lastSeen?.place ? ` near ${picture.lastSeen.place}` : '';
  const newest = (picture.sightings || [])[0];
  const since = newest
    ? `Last seen ${dayAndTime(newest.at, zone, now)}${placeWords(newest.place) ? ` ${placeWords(newest.place)}` : ''}.`
    : `Nobody has seen ${name} since.`;
  return { text: `${lost}${from}. ${since}`, tone: 'lost' };
}

/** "2 neighbors are out looking", "1 neighbor is out looking", "Nobody is out looking yet". */
export function lookingLine(helpers = 0) {
  if (helpers <= 0) return 'Nobody is out looking yet';
  return helpers === 1 ? '1 neighbor is out looking' : `${helpers} neighbors are out looking`;
}

/**
 * The owner's line: who was told. '' when nobody was alerted. `helpers` is
 * how many people are out looking: with someone out, the line does not say
 * that none of the alerted neighbors has answered. That counts answers to
 * the alert, and above "3 neighbors are out looking" it reads as untrue.
 */
export function neighborsLine(neighbors, name = 'the pet', helpers = 0) {
  if (!neighbors || !neighbors.told) return '';
  const told = neighbors.told === 1 ? '1 neighbor was alerted' : `${neighbors.told} neighbors were alerted`;
  const answered = neighbors.answered > 0 ? ` ${neighbors.answered} answered.` : helpers > 0 ? '' : ' None has answered yet.';
  return `${told}.${answered} You are told the moment someone sees ${name}.`;
}

/** A phone number as people read it: "(512) 555-0100". Other shapes pass through. */
export function phoneWords(phone) {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  const us = digits.length === 10 ? digits : digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : null;
  return us ? `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}` : raw;
}

/** The `tel:` form of a number. */
export function phoneTel(phone) {
  const raw = String(phone || '').trim();
  return `${raw.startsWith('+') ? '+' : ''}${raw.replace(/\D/g, '')}`;
}
