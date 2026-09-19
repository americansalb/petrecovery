/**
 * Candidate points for a round, per mode.
 *
 * A source hands out {lat, lng, country, radiusKm} candidates one at a
 * time from a seeded generator. The probe (Google) or the browser
 * (Apple) then tests them in order. Seeded sources are deterministic,
 * which is all a daily challenge or a challenge link needs.
 *
 * Server only.
 */

import { createRng, randomPointInDisk, randomSeedString, roundSeed, weightedIndex } from '../random';
import { WORLD_SIZE_KM, sizeForBox } from '../distance';
import { CONTINENTS, RADIUS_PRESETS } from '../modes';
import { citiesFor, hasAppleCoverage } from '../coverage';
import { countriesInContinent, countryByCode, getCountries } from './countries';

export class GeoSamplerError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'GeoSamplerError';
    this.code = code;
  }
}

/**
 * How far out an Apple city spot lands: r = radius * u**APPLE_SPREAD.
 *
 * 1.5 rather than the 0.5 that is uniform over the disk's area. It cuts
 * the draws past half the radius from three in four to about one in
 * three, so the first spot the browser tries is far more often a street
 * Apple has driven. The edge of the city is still reachable, so a round
 * in an outer suburb is still possible; it is just no longer the common
 * case, and the common case was costing four seconds a miss.
 */
export const APPLE_SPREAD = 1.5;

/** Search radius for a country: the preset, shrunk for small countries. */
export function radiusForCountry(country, presetKm) {
  const area = country?.areaKm2 || 0;
  if (!area) return Math.min(presetKm, 5);
  return Math.min(presetKm, Math.max(1, 0.25 * Math.sqrt(area)));
}

/**
 * A box to measure a country by. spanBox, not box: a country cut by the
 * antimeridian has a raw box from -180 to +180, whose diagonal drops
 * the east-west term entirely (sin(180deg) = 0) and leaves the latitude
 * span pretending to be the diagonal.
 */
function countryBox(country) {
  if (country.spanBox) return country.spanBox;
  if (country.box) return country.box;
  if (country.disk) {
    const { center, radiusKm } = country.disk;
    const dLat = radiusKm / 110.574;
    const dLng = radiusKm / (111.32 * Math.max(0.1, Math.cos((center.lat * Math.PI) / 180)));
    return { minLat: center.lat - dLat, maxLat: center.lat + dLat, minLng: center.lng - dLng, maxLng: center.lng + dLng };
  }
  return null;
}

function unionBox(countries) {
  const boxes = countries.map(countryBox).filter(Boolean);
  if (!boxes.length) return null;
  return boxes.reduce((acc, b) => ({
    minLat: Math.min(acc.minLat, b.minLat),
    maxLat: Math.max(acc.maxLat, b.maxLat),
    minLng: Math.min(acc.minLng, b.minLng),
    maxLng: Math.max(acc.maxLng, b.maxLng),
  }));
}

/**
 * Apple Look Around is city streets, and only city streets: no
 * countryside, no photo spheres, and no server-side probe. So on Apple
 * every mode is a draw from the curated city list (app/lib/geo/coverage.js),
 * filtered by what the mode asks for, and the browser tries the drawn
 * spots in order until Look Around loads one. The list is the whole
 * Apple world; adding a covered city to it is how that world grows.
 *
 *   world      every covered city, each as likely as the next
 *   balanced,  a covered country first, weighted like the Google pool
 *   daily, cup,  (square root of area, so small ones still come up),
 *   streak     then one of its cities
 *   continent  the covered countries inside it; none is an error the
 *              lobby already prevents, said plainly if reached
 *   country    that country's cities, or an error if it has none
 */
function appleSource(config, rng, presetKm, holder) {
  const cities = citiesFor('apple');
  if (!cities.length) throw new GeoSamplerError('no_cities', 'No cities for Apple Look Around');
  const byCountry = new Map();
  for (const city of cities) {
    if (!byCountry.has(city.country)) byCountry.set(city.country, []);
    byCountry.get(city.country).push(city);
  }
  const spot = (city) => {
    // Toward the middle of the city, where Look Around actually is. See
    // randomPointInDisk: the uniform-over-area default put three draws
    // in four past half the radius, each miss cost a four-second browser
    // timeout, and a round took a median of eleven seconds to start.
    const point = randomPointInDisk(rng, city, city.radiusKm, { spread: APPLE_SPREAD });
    return { lat: point.lat, lng: point.lng, country: countryByCode(city.country), city: city.name, radiusKm: Math.min(presetKm, 2) };
  };
  const fromCities = (pool) => () => spot(pool[Math.floor(rng() * pool.length)]);
  const fromCountries = (countries) => {
    const pool = countries.filter((c) => byCountry.has(c.cca2));
    if (!pool.length) return null;
    const weights = pool.map((c) => Math.sqrt(Math.max(1, c.areaKm2 || 1)));
    return () => {
      const list = byCountry.get(pool[weightedIndex(rng, weights)].cca2);
      return spot(list[Math.floor(rng() * list.length)]);
    };
  };

  let next = null;
  switch (config.mode) {
    case 'balanced':
    case 'daily':
    case 'cup':
    case 'ranked':
    case 'streak':
      next = fromCountries(getCountries().filter((c) => c.cca2 && hasAppleCoverage(c.cca2)));
      break;
    case 'continent': {
      const all = countriesInContinent(config.region);
      if (!all.length) throw new GeoSamplerError('unknown_continent', `Unknown continent: ${config.region}`);
      const covered = all.filter((c) => hasAppleCoverage(c.cca2) && byCountry.has(c.cca2));
      if (!covered.length) {
        const label = CONTINENTS[config.region]?.label || config.region;
        throw new GeoSamplerError('no_cities', `There are no city streets in ${label} yet.`);
      }
      holder.sizeKm = sizeForBox(unionBox(covered));
      next = fromCountries(covered);
      break;
    }
    case 'country': {
      const country = countryByCode(config.region);
      if (!country) throw new GeoSamplerError('unknown_country', `Unknown country: ${config.region}`);
      const list = byCountry.get(country.cca2);
      if (!list) throw new GeoSamplerError('no_cities', `There are no city streets in ${country.name} yet.`);
      holder.sizeKm = sizeForBox(countryBox(country));
      next = fromCities(list);
      break;
    }
    default:
      throw new GeoSamplerError('unknown_mode', `${config.mode} is not a mode Apple Look Around can play`);
  }
  if (!next) throw new GeoSamplerError('empty_pool', 'No covered countries to sample from');
  return next;
}

/**
 * Build a candidate source for one round.
 * Returns { next(), stats, sizeKm, rng }.
 */
export function createCandidateSource(config, roundIndex = 0) {
  const seed = config.seed ? roundSeed(config.seed, roundIndex) : `${randomSeedString()}-${Date.now()}-${roundIndex}`;
  const rng = createRng(seed);
  const presetKm = RADIUS_PRESETS[config.radius]?.km ?? RADIUS_PRESETS.standard.km;
  const stats = { skippedWater: 0 };

  // One imagery, so one source: the curated city list, drawn by mode
  // (appleSource above). The Google branch that used to live here, with
  // its land sampler, its off-coverage pool and its covered-country
  // gate, went with Google.
  const holder = { sizeKm: WORLD_SIZE_KM };
  const next = appleSource(config, rng, presetKm, holder);
  return { next, stats, sizeKm: holder.sizeKm, rng };
}
