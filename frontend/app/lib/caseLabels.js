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
import { isCaseOpen } from '@/app/lib/caseStatus';

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

// Outcomes that mean the pet is back with its family (enum CaseResolution).
const HOME_RESOLUTIONS = new Set(['REUNITED', 'FOUND_BY_OWNER', 'FOUND_AT_SHELTER', 'CAME_HOME']);

/**
 * Lost, found, home or closed: the one status a reader needs. A search
 * closed for any other reason (the owner stopped, or worse) reads as
 * closed, never as still lost, and the reason stays private.
 */
export function caseStatus(c) {
  if (c.status === 'REUNITED' || HOME_RESOLUTIONS.has(c.resolution)) return { key: 'home', label: 'Home' };
  if (c.status && !isCaseOpen(c.status)) return { key: 'closed', label: 'Closed' };
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
  if (key === 'closed') return 'Search closed';
  if (!Number.isFinite(start)) return '';
  return key === 'found' ? `Found ${span(now - start)} ago` : `Missing ${span(now - start)}`;
}

/** "Medium", "Extra large": the size enum as a word, or '' when unknown. */
export function caseSize(c) {
  const v = known(c.petSize);
  return v ? sentenceCase(v.replace(/_/g, ' ')) : '';
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The reporter's description, minus the line the report form writes on
 * its own. That line is the colour and the species enum ("Golden, White
 * DOG", "Found white, brown cat", "White DOG - Bichon"), which repeats the
 * breed line above it. What the reporter typed around it stays, so
 * "Indoor cat. white, tan, gray CAT" keeps "Indoor cat."
 */
export function caseDescription(c) {
  let text = String(c.petDescription || '').trim();
  const color = String(c.petColor || '').trim();
  const species = String(c.petSpecies || '').trim();
  if (text && color && species) {
    const breed = known(c.petBreed);
    const tail = breed ? `(?:\\s*-\\s*${escapeRegExp(breed)})?` : '';
    const generated = new RegExp(`(?:found\\s+)?${escapeRegExp(color)}\\s+${escapeRegExp(species)}\\b${tail}`, 'i');
    text = text.replace(generated, '');
  }
  text = text.replace(/^[\s.,;:-]+|[\s,;:-]+$/g, '').trim();
  return /[a-z0-9]/i.test(text) ? text : '';
}

/**
 * The contact number as something a phone can dial, or null. Found
 * reports stored the words "Not provided" when the finder left it blank,
 * which made a Call button that dialled nothing. US numbers read the way
 * people write them, (407) 492-2284, whether stored as +14074922284 or
 * 407-492-2284; anything else shows as stored.
 */
export function casePhone(c) {
  const raw = String(c.contact?.phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  const us = digits.length === 10 ? digits : digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : null;
  const display = us ? `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}` : raw;
  return { display, tel: `${raw.startsWith('+') ? '+' : ''}${digits}` };
}

/** "Aug 18", or "Aug 18, 2025" when it was another year. */
export function shortDate(date, now = Date.now()) {
  const d = date == null || date === '' ? new Date(NaN) : new Date(date);
  if (!Number.isFinite(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** "just now", "12 minutes ago", "3 hours ago", "4 days ago", then the date. */
export function timeAgo(date, now = Date.now()) {
  const t = date == null || date === '' ? NaN : new Date(date).getTime();
  if (!Number.isFinite(t)) return '';
  const minutes = Math.floor(Math.max(0, now - t) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return shortDate(t, now);
}
