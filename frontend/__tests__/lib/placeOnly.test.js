/**
 * placeOnly (app/lib/needOptions.js): a place as people who are not the
 * owner may read it. The street or the landmark, and never a house
 * number, wherever in the address the number is written.
 */

jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: {} }));

import { placeOnly, placeName } from '@/app/lib/needOptions';
import { isNoPlace } from '@/app/lib/maps/reverseLabel';

describe('placeOnly', () => {
  test.each([
    ['4001 Ramsey Ave, Austin, TX 78756', 'Ramsey Ave'],
    ['4001B Ramsey Ave', 'Ramsey Ave'],
    ['4001 1/2 Ramsey Ave, Austin', 'Ramsey Ave'],
    ['near 6701 Burnet Rd, Austin', 'Burnet Rd'],
    ['1200 Barton Springs Rd, Austin, TX', 'Barton Springs Rd'],
  ])('a number in front is a house: %s', (address, place) => {
    expect(placeOnly(address)).toBe(place);
  });

  test.each([
    ['Hauptstrasse 12, Berlin', 'Hauptstrasse'],
    ['Av. Insurgentes Sur 1234, Col. Del Valle', 'Av. Insurgentes Sur'],
    ['Calle 5 de Mayo 23, Centro', 'Calle 5 de Mayo'],
    ['Rue de Rivoli 7b', 'Rue de Rivoli'],
  ])('a number behind is a house too: %s', (address, place) => {
    expect(placeOnly(address)).toBe(place);
  });

  test.each([
    ['5th St and Main St', '5th St and Main St'],
    ['42nd St', '42nd St'],
    ['1st Ave, Seattle', '1st Ave'],
    ['3rd St and W 40th St', '3rd St and W 40th St'],
    ['120 5th St, Austin, TX', '5th St'],
    ['W 40th St and Ramsey Ave', 'W 40th St and Ramsey Ave'],
  ])('a numbered street is a street: %s', (address, place) => {
    expect(placeOnly(address)).toBe(place);
  });

  test.each([
    ['Highway 290', 'Highway 290'],
    ['County Road 12', 'County Road 12'],
    ['FM 1826, Austin', 'FM 1826'],
    ['Loop 360', 'Loop 360'],
    ['Pier 39, San Francisco', 'Pier 39'],
    ['Calle 26, Bogota', 'Calle 26'],
    ['I-35 frontage road', 'I-35 frontage road'],
  ])('a road or a landmark whose name ends in a number keeps it: %s', (address, place) => {
    expect(placeOnly(address)).toBe(place);
  });

  test.each([
    ['Zilker Park, Austin, TX', 'Zilker Park'],
    ['Ramsey Park', 'Ramsey Park'],
  ])('a landmark is itself: %s', (address, place) => {
    expect(placeOnly(address)).toBe(place);
  });

  test('where no street can be told apart from a number, the town if there is one, and otherwise nothing', () => {
    expect(placeOnly('4001, Austin, TX')).toBe('Austin, TX');
    expect(placeOnly('4001')).toBe('');
    expect(placeOnly('30.2672, -97.7431')).toBe('');
    expect(placeOnly('')).toBe('');
    expect(placeOnly(null)).toBe('');
    expect(placeOnly(undefined)).toBe('');
  });

  test('words stored where a sighting had no street are no place, so nothing reads "near Marked on the map"', () => {
    for (const words of ['Marked on the map', 'marked on the map.', 'Unknown location', '  ']) {
      expect(placeOnly(words)).toBe('');
      expect(placeName(words)).toBe('');
      expect(isNoPlace(words)).toBe(true);
    }
    expect(isNoPlace('30.2672, -97.7431')).toBe(true);
    expect(isNoPlace('Zilker Park')).toBe(false);
    // A street that only starts with those words is still a street.
    expect(placeOnly('Marked Tree Rd')).toBe('Marked Tree Rd');
  });

  test('no result ever begins with a house number', () => {
    const addresses = ['4001 Ramsey Ave', '12 34 Foo St', '99 Red Balloons Rd, Berlin', '7 Eleven Way', '4001 1/2 Ramsey Ave', '15B Baker Street 3', '221B Baker Street, London'];
    for (const address of addresses) {
      const place = placeOnly(address);
      expect({ address, ok: !/^\d+[a-z]?\s/i.test(place) || /^\d+(st|nd|rd|th)\b/i.test(place) }).toEqual({ address, ok: true });
    }
  });
});

describe('every screen that names a sighting\'s place reads naturally with no street', () => {
  const fs = require('fs');
  const path = require('path');
  const read = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

  test('the pet\'s page asks the one check before it prints "near"', () => {
    // "Seen 5 minutes ago near Marked on the map" (2026-11-16): the hot sighting and "What happened".
    expect(read('app/cases/[caseNumber]/CasePageClient.js')).toMatch(/const where = isNoPlace\(s\.address\) \? '' : /);
    expect(read('app/cases/[caseNumber]/components/Activity.js')).toMatch(/function nearWhat\(address\) \{\s*if \(isNoPlace\(address\)\) return '';/);
  });

  test('nothing stores or prints the words that stood in for a place', () => {
    expect(read('app/lib/witness.js')).not.toMatch(/'Marked on the map/);
    expect(read('app/lib/searchPicture.js')).not.toMatch(/Marked on the map/);
    expect(read('app/mission-control/desktop/Board.js')).not.toMatch(/'Marked on the map'/);
    expect(read('app/api/activity/feed/route.js')).not.toMatch(/near \$\{s\.address\}/);
  });
});
