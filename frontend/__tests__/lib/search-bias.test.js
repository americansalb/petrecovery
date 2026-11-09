/**
 * A typed address search is biased toward where the person is, never fenced
 * to one country: the time zone names the country, a known position gives a
 * preferred box, and an unknown zone adds nothing.
 */
import { countryForZone, searchBiasParams } from '@/app/lib/geo/searchBias';

describe('countryForZone', () => {
  test('names the country for the zones the site is used from', () => {
    expect(countryForZone('America/Chicago')).toBe('us');
    expect(countryForZone('America/Puerto_Rico')).toBe('pr');
    expect(countryForZone('America/La_Paz')).toBe('bo');
    expect(countryForZone('America/Mexico_City')).toBe('mx');
    expect(countryForZone('America/Argentina/Mendoza')).toBe('ar');
  });

  test('says nothing for a zone it does not know', () => {
    expect(countryForZone('Asia/Tokyo')).toBe('');
    expect(countryForZone('')).toBe('');
    expect(countryForZone(undefined)).toBe('');
  });
});

describe('searchBiasParams', () => {
  test('a known position gives a preferred box, not a fence', () => {
    const p = searchBiasParams({ near: { lat: 30.27, lng: -97.74 }, zone: 'America/Chicago' });
    expect(p.bounded).toBe('0');
    expect(p.countrycodes).toBe('us');
    const [left, top, right, bottom] = p.viewbox.split(',').map(Number);
    expect(left).toBeLessThan(-97.74);
    expect(right).toBeGreaterThan(-97.74);
    expect(top).toBeGreaterThan(30.27);
    expect(bottom).toBeLessThan(30.27);
  });

  test('no position and an unknown zone adds nothing', () => {
    expect(searchBiasParams({ near: null, zone: 'Asia/Tokyo' })).toEqual({});
  });

  test('a position with NaN in it is ignored', () => {
    expect(searchBiasParams({ near: { lat: NaN, lng: 1 }, zone: 'America/La_Paz' })).toEqual({ countrycodes: 'bo' });
  });
});
