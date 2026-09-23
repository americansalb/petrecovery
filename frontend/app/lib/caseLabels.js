/**
 * How a public case reads on a card, a map pin or a page title.
 *
 * One place, so the board, the map and the city pages say the same
 * thing about the same pet: the reporter's words where they exist, plain
 * words where they do not, and never a database value such as "Unknown",
 * "DOG" or "XX".
 */

import { speciesLabel } from '@/app/lib/species';
import { PIN_ONLY_LABEL } from '@/app/lib/maps/reverseLabel';

const HOUR = 3600000;
const DAY = 24 * HOUR;

/** "Unknown" is a database value, not something to show a person. */
export function known(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  return v && !/^unknown\b/i.test(v) ? v : '';
}

function sentenceCase(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

/** Lost, found or home: the one status a reader needs. */
export function caseStatus(c) {
  if (c.status === 'REUNITED' || c.resolution === 'REUNITED') return { key: 'home', label: 'Home' };
  if (c.reportType === 'FOUND') return { key: 'found', label: 'Found' };
  return { key: 'lost', label: 'Lost' };
}

/**
 * The pet's name, or what it is. A finder rarely knows the name, so a
 * found report is titled by species rather than by whatever the report
 * form stored in the name field.
 */
export function caseTitle(c) {
  const word = speciesLabel(c.petSpecies).toLowerCase();
  if (c.reportType === 'FOUND') return `Found ${word}`;
  return known(c.petName) || `Lost ${word}`;
}

/** "Bichon · White", "Dog · Golden, white". */
export function caseDescriptor(c) {
  const breed = known(c.petBreed);
  const color = known(c.petColor);
  const parts = [breed || speciesLabel(c.petSpecies)];
  if (color && !(breed && breed.toLowerCase().includes(color.toLowerCase()))) {
    parts.push(sentenceCase(color));
  }
  return parts.join(' · ');
}

/** "Orlando, FL", from the API's parsed place, or the pinned-spot wording. */
export function casePlace(c) {
  if (c.place) return c.place;
  const city = c.city && c.city !== 'Unknown' ? c.city : '';
  const state = c.state && c.state !== 'XX' ? c.state : '';
  return city ? [city, state].filter(Boolean).join(', ') : PIN_ONLY_LABEL;
}

function span(ms) {
  const days = Math.floor(Math.max(0, ms) / DAY);
  if (days >= 1) return `${days} ${days === 1 ? 'day' : 'days'}`;
  const hours = Math.max(1, Math.floor(Math.max(0, ms) / HOUR));
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/** "Missing 36 days", "Found 3 days ago", "Home after 2 days". */
export function caseTimeline(c, now = Date.now()) {
  const start = new Date(c.lastSeenAt || c.createdAt).getTime();
  const { key } = caseStatus(c);
  if (key === 'home') {
    const end = new Date(c.resolvedAt || c.updatedAt).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && end > start
      ? `Home after ${span(end - start)}`
      : 'Back home';
  }
  if (!Number.isFinite(start)) return '';
  return key === 'found' ? `Found ${span(now - start)} ago` : `Missing ${span(now - start)}`;
}
