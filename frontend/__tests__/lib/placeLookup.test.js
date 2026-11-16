/**
 * Looking up a typed place (app/lib/maps/placeLookup.js), and what the
 * place picker says when the lookup finds nothing
 * (app/components/report/LocationPicker.js).
 *
 * Found by the reporting test, 2026-11-16: once Apple MapKit failed to
 * load, the picker spun for ever from the second search on, though
 * Nominatim had already answered. And when the street lookup itself was
 * down (a 503, a rate limit) the picker said "No matches for that search",
 * and a phone with location off had no map to tap: the sighting could not
 * be sent.
 */
import { lookUpPlaces, within, LOOKUP_TIMEOUT_MS, RESULTS_MAX } from '@/app/lib/maps/placeLookup';
import { emptySearchWords, roughWords } from '@/app/components/report/LocationPicker';

const place = (name, lat, lng) => ({ name, address: `${name}, Austin`, latitude: lat, longitude: lng });
const never = () => new Promise(() => {});
const failing = () => Promise.reject(new Error('503'));

afterEach(() => {
  jest.useRealTimers();
});

describe('one geocoder that never answers holds nothing up', () => {
  test('what the others found is shown once the slow one has had its few seconds', async () => {
    jest.useFakeTimers();
    let done = null;
    lookUpPlaces([never(), Promise.resolve([place('Zilker Park', 30.2669, -97.7729)])]).then((out) => {
      done = out;
    });
    await jest.advanceTimersByTimeAsync(LOOKUP_TIMEOUT_MS - 1);
    expect(done).toBeNull();
    await jest.advanceTimersByTimeAsync(1);
    expect(done).toEqual({ results: [place('Zilker Park', 30.2669, -97.7729)], answered: true });
  });

  test('a few seconds, not a minute', () => {
    expect(LOOKUP_TIMEOUT_MS).toBeGreaterThanOrEqual(3000);
    expect(LOOKUP_TIMEOUT_MS).toBeLessThanOrEqual(10000);
  });

  test('within() gives the answer when it comes in time, and gives up when it does not', async () => {
    await expect(within(Promise.resolve('here'), 50)).resolves.toBe('here');
    jest.useFakeTimers();
    const late = within(never(), 100);
    jest.advanceTimersByTime(100);
    await expect(late).rejects.toThrow(/No answer in time/);
  });
});

describe('"no matches" and "the lookup did not work" are told apart', () => {
  test('every geocoder failing is no answer at all', async () => {
    expect(await lookUpPlaces([failing(), failing(), failing()])).toEqual({ results: [], answered: false });
  });

  test('one geocoder answering with nothing is an answer: there are no matches', async () => {
    expect(await lookUpPlaces([failing(), Promise.resolve([]), failing()])).toEqual({ results: [], answered: true });
  });

  test('a geocoder that fails adds nothing and takes nothing away', async () => {
    const out = await lookUpPlaces([failing(), Promise.resolve([place('Ramsey Ave', 30.31, -97.74)])]);
    expect(out).toEqual({ results: [place('Ramsey Ave', 30.31, -97.74)], answered: true });
  });
});

describe('the list', () => {
  test('best source first, each spot once, at most eight', async () => {
    const apple = [place('Zilker Park', 30.26691, -97.77291), { name: 'W 41st St', address: 'W 41st St, Austin', latitude: null, longitude: null }];
    const photon = [place('Zilker Park', 30.26692, -97.77292), place('Barton Springs Rd', 30.264, -97.77)];
    const nominatim = Array.from({ length: 10 }, (_, i) => place(`Street ${i}`, 30.3 + i / 100, -97.7));
    const { results } = await lookUpPlaces([Promise.resolve(apple), Promise.resolve(photon), Promise.resolve(nominatim)]);
    expect(results).toHaveLength(RESULTS_MAX);
    expect(results.map((r) => r.name).slice(0, 4)).toEqual(['Zilker Park', 'W 41st St', 'Barton Springs Rd', 'Street 0']);
  });
});

describe('what the picker says when a typed search finds nothing', () => {
  test('a lookup that did not work says so, and never "no matches"', () => {
    const words = emptySearchWords({ failed: true, canPin: true });
    expect(words).toBe('Looking up the street did not work just now. Try again in a moment, or put the pin on the map yourself.');
    expect(words).not.toMatch(/No matches/);
    expect(emptySearchWords({ failed: false, canPin: true })).toBe('No matches for that search. Try a cross-street or a nearby landmark, or put the pin on the map yourself.');
  });

  test('it offers only what the person can do', () => {
    // A pin already on the map: move it.
    expect(emptySearchWords({ placed: true, canPin: true, canLocate: true })).toMatch(/, or tap the map to move the pin yourself\.$/);
    // Location still on, and no map to open: use it.
    expect(emptySearchWords({ canLocate: true })).toMatch(/, or use your location and drag the pin to the spot\.$/);
    // Location turned off for the page: it is not offered.
    expect(emptySearchWords({ canLocate: false })).toBe('No matches for that search. Try a cross-street or a nearby landmark.');
    expect(emptySearchWords({ failed: true, canLocate: false })).not.toMatch(/location/);
  });

  test('a rough reading offers the pin on the map only where there is one to open', () => {
    expect(roughWords(true)).toBe('Your phone only gave a rough location. Type the street or the corner, or put the pin on the map.');
    expect(roughWords(false)).toBe('Your phone only gave a rough location. Type the street or the corner.');
  });

  test('the picker reads "location is off" from the browser, and every lookup goes through the one that gives up', () => {
    const fs = require('fs');
    const path = require('path');
    const picker = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'components', 'report', 'LocationPicker.js'), 'utf8');
    // Asking the browser's permission state shows the person nothing.
    expect(picker).toMatch(/navigator\.permissions\s*\.query\(\{ name: 'geolocation' \}\)/);
    expect(picker).toMatch(/setLocateDenied\(status\.state === 'denied'\)/);
    // A refusal from the device itself turns the offer off too.
    expect(picker).toMatch(/if \(error\?\.code === 1\) \{\s*setLocateDenied\(true\);/);
    // The hint is built from what can be done.
    expect(picker).toMatch(/emptySearchWords\(\{ failed: lookupFailed, placed: Boolean\(value\), canPin, canLocate: offerLocate \}\)/);
    // Every geocoder goes through the lookup that gives up on one that does not answer.
    expect(picker).toMatch(/await lookUpPlaces\(\[\s*searchAutocomplete\(/);
    expect(picker).not.toMatch(/Promise\.allSettled/);
    // An answer to an older query is not shown over a newer one.
    expect(picker).toMatch(/if \(seq !== searchSeqRef\.current\) return;/);
    // Nothing in the picker turns a failed lookup into an empty one.
    expect(picker).not.toMatch(/if \(!response\.ok\) return \[\];/);
  });
});
