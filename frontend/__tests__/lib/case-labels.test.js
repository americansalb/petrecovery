/**
 * app/lib/caseLabels.js: how a public case reads on the board, a map pin
 * and the pet's own page. The descriptions and phone values below are the
 * shapes real reports store.
 */

import {
  caseStatus,
  caseTitle,
  caseDescriptor,
  casePlace,
  caseTimeline,
  caseSize,
  caseDescription,
  casePhone,
  shortDate,
  timeAgo,
} from '@/app/lib/caseLabels';

const DAY = 86400000;

describe('caseStatus', () => {
  test('an open lost report is lost, an open found report is found', () => {
    expect(caseStatus({ status: 'ACTIVE', reportType: 'LOST' }).key).toBe('lost');
    expect(caseStatus({ status: 'SIGHTING_REPORTED', reportType: 'LOST' }).key).toBe('lost');
    expect(caseStatus({ status: 'IN_PROGRESS', reportType: 'FOUND' }).key).toBe('found');
  });

  test('every outcome that brings the pet home reads as home', () => {
    expect(caseStatus({ status: 'REUNITED' }).key).toBe('home');
    for (const resolution of ['REUNITED', 'FOUND_BY_OWNER', 'FOUND_AT_SHELTER', 'CAME_HOME']) {
      expect(caseStatus({ status: 'CLOSED_OTHER', resolution }).key).toBe('home');
    }
  });

  test('a search closed any other way reads as closed, never as still lost', () => {
    expect(caseStatus({ status: 'CLOSED_OTHER', resolution: 'SEARCH_CEASED' })).toEqual({ key: 'closed', label: 'Closed' });
    expect(caseStatus({ status: 'CLOSED_OTHER', resolution: 'DECEASED' }).key).toBe('closed');
    expect(caseTimeline({ status: 'CLOSED_OTHER', lastSeenAt: new Date() })).toBe('Search closed');
  });

  test('a case with no status (older callers) is treated as open', () => {
    expect(caseStatus({ reportType: 'LOST' }).key).toBe('lost');
  });
});

describe('titles, descriptors and places', () => {
  test('found reports are titled by species, not the generated name', () => {
    expect(caseTitle({ reportType: 'FOUND', petName: 'white, brown MEDIUM Cat', petSpecies: 'CAT' })).toBe('Found cat');
    expect(caseTitle({ reportType: 'LOST', petName: 'Linda', petSpecies: 'DOG' })).toBe('Linda');
    expect(caseTitle({ reportType: 'LOST', petName: 'Unknown', petSpecies: 'DOG' })).toBe('Lost dog');
  });

  test('the breed line drops a colour the breed already names', () => {
    expect(caseDescriptor({ petSpecies: 'DOG', petColor: 'Golden, White' })).toBe('Dog · Golden, white');
    expect(caseDescriptor({ petSpecies: 'DOG', petBreed: 'Golden Retriever', petColor: 'Golden' })).toBe('Golden Retriever');
  });

  test('the place falls back to the pinned-spot wording, never "Unknown, XX"', () => {
    expect(casePlace({ place: 'Orlando, FL' })).toBe('Orlando, FL');
    expect(casePlace({ city: 'Unknown', state: 'XX' })).toBe('Near the pinned spot');
  });

  test('sizes read as words', () => {
    expect(caseSize({ petSize: 'MEDIUM' })).toBe('Medium');
    expect(caseSize({ petSize: 'EXTRA_LARGE' })).toBe('Extra large');
    expect(caseSize({ petSize: null })).toBe('');
  });

  test('the timeline counts from the last sighting', () => {
    const now = Date.parse('2026-09-23T12:00:00Z');
    expect(caseTimeline({ status: 'ACTIVE', reportType: 'LOST', lastSeenAt: new Date(now - 36 * DAY) }, now)).toBe('Missing 36 days');
    expect(caseTimeline({ status: 'ACTIVE', reportType: 'FOUND', lastSeenAt: new Date(now - 3 * DAY) }, now)).toBe('Found 3 days ago');
    expect(
      caseTimeline({ status: 'REUNITED', lastSeenAt: new Date(now - 5 * DAY), resolvedAt: new Date(now - 3 * DAY) }, now)
    ).toBe('Home after 2 days');
  });
});

describe('caseDescription', () => {
  const pet = (petDescription, extra = {}) => caseDescription({ petSpecies: 'DOG', petColor: 'Golden, White', petDescription, ...extra });

  test('the line the report form writes by itself is dropped', () => {
    expect(pet('Golden, White DOG')).toBe('');
    expect(caseDescription({ petSpecies: 'DOG', petColor: 'White', petBreed: 'Bichon', petDescription: 'White DOG - Bichon' })).toBe('');
    expect(caseDescription({ petSpecies: 'CAT', petColor: 'white, brown', petDescription: 'Found white, brown cat' })).toBe('');
  });

  test('what the reporter typed around it stays', () => {
    expect(caseDescription({ petSpecies: 'CAT', petColor: 'white, tan, gray', petDescription: 'Indoor cat. white, tan, gray CAT' })).toBe('Indoor cat.');
    expect(caseDescription({ petSpecies: 'CAT', petColor: 'White, Gray', petDescription: 'Outdoor access cat. White, Gray CAT' })).toBe('Outdoor access cat.');
  });

  test('a real description is left alone', () => {
    const text = 'Friendly 4-year-old golden retriever. White patch on chest, wearing a blue collar.';
    expect(caseDescription({ petSpecies: 'DOG', petColor: 'Golden', petDescription: text })).toBe(text);
    expect(pet('')).toBe('');
    expect(pet(null)).toBe('');
  });

  test('a colour with regex characters cannot break the match', () => {
    expect(caseDescription({ petSpecies: 'DOG', petColor: 'Black (mostly)', petDescription: 'Black (mostly) DOG' })).toBe('');
  });
});

describe('casePhone', () => {
  test('a real number becomes a dialable tel value', () => {
    expect(casePhone({ contact: { phone: '(512) 555-0100' } })).toEqual({ display: '(512) 555-0100', tel: '5125550100' });
    expect(casePhone({ contact: { phone: '+1 512 555 0100' } })).toEqual({ display: '+1 512 555 0100', tel: '+15125550100' });
  });

  test('placeholders and junk give no Call button', () => {
    expect(casePhone({ contact: { phone: 'Not provided' } })).toBeNull();
    expect(casePhone({ contact: { phone: '123' } })).toBeNull();
    expect(casePhone({ contact: null })).toBeNull();
    expect(casePhone({})).toBeNull();
  });
});

describe('dates', () => {
  const now = Date.parse('2026-09-23T12:00:00Z');
  test('recent times read as how long ago', () => {
    expect(timeAgo(now - 20 * 1000, now)).toBe('just now');
    expect(timeAgo(now - 1 * 60000, now)).toBe('1 minute ago');
    expect(timeAgo(now - 12 * 60000, now)).toBe('12 minutes ago');
    expect(timeAgo(now - 3 * 3600000, now)).toBe('3 hours ago');
    expect(timeAgo(now - 4 * DAY, now)).toBe('4 days ago');
  });

  test('older times read as a date, with the year only when it differs', () => {
    expect(timeAgo('2026-08-01T12:00:00Z', now)).toBe('Aug 1');
    expect(shortDate('2025-12-25T12:00:00Z', now)).toBe('Dec 25, 2025');
    expect(shortDate('not a date', now)).toBe('');
    expect(timeAgo(null, now)).toBe('');
    expect(shortDate(undefined, now)).toBe('');
  });
});
