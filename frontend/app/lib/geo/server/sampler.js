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
import { citiesFor, citiesOffCoverage, hasAppleCoverage, hasGoogleCoverage } from '../coverage';
import { countriesInContinent, countryByCode, getCountries, sampleInCountry, sampleOnLand } from './countries';

export class GeoSamplerError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'GeoSamplerError';
    this.code = code;
  }
}

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

/** Countries a "random country" draw may land on for Google modes. */
export function coveredPool(countries = getCountries()) {
  return countries.filter((c) => c.cca2 && c.region !== 'Antarctic' && hasGoogleCoverage(c.cca2));
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
    const point = randomPointInDisk(rng, city, city.radiusKm);
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
    case 'world':
    case 'cities':
      next = fromCities(cities);
      break;
    case 'balanced':
    case 'daily':
    case 'cup':
    case 'streak':
      next = fromCountries(getCountries().filter((c) => c.cca2 && hasAppleCoverage(c.cca2)));
      break;
    case 'continent': {
      const all = countriesInContinent(config.region);
      if (!all.length) throw new GeoSamplerError('unknown_continent', `Unknown continent: ${config.region}`);
      const covered = all.filter((c) => hasAppleCoverage(c.cca2) && byCountry.has(c.cca2));
      if (!covered.length) {
        const label = CONTINENTS[config.region]?.label || config.region;
        throw new GeoSamplerError('no_cities', `Apple Look Around has no city streets in ${label} yet. Play that continent on Google Street View.`);
      }
      holder.sizeKm = sizeForBox(unionBox(covered));
      next = fromCountries(covered);
      break;
    }
    case 'country': {
      const country = countryByCode(config.region);
      if (!country) throw new GeoSamplerError('unknown_country', `Unknown country: ${config.region}`);
      const list = byCountry.get(country.cca2);
      if (!list) throw new GeoSamplerError('no_cities', `Apple Look Around has no city streets in ${country.name} yet. Play it on Google Street View.`);
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

  if (config.provider === 'apple') {
    // sizeKm for a continent or a country is set inside; read it back.
    const holder = { sizeKm: WORLD_SIZE_KM };
    const next = appleSource(config, rng, presetKm, holder);
    return { next, stats, sizeKm: holder.sizeKm, rng };
  }

  const pointIn = (country) => {
    const point = sampleInCountry(rng, country);
    if (!point) return null;
    return { lat: point.lat, lng: point.lng, country, radiusKm: radiusForCountry(country, presetKm) };
  };

  const fromPool = (pool) => {
    if (!pool.length) return null;
    const weights = pool.map((c) => Math.sqrt(Math.max(1, c.areaKm2 || 1)));
    return () => pointIn(pool[weightedIndex(rng, weights)]);
  };

  let next = null;
  let sizeKm = WORLD_SIZE_KM;

  switch (config.mode) {
    case 'world': {
      next = () => {
        const sample = sampleOnLand(rng);
        if (!sample) return null;
        stats.skippedWater += sample.skipped;
        return { lat: sample.point.lat, lng: sample.point.lng, country: sample.country, radiusKm: presetKm };
      };
      break;
    }
    case 'balanced':
    case 'daily':
    case 'cup':
    case 'kidnapped':
    case 'streak': {
      next = fromPool(coveredPool());
      break;
    }
    case 'continent': {
      const all = countriesInContinent(config.region);
      if (!all.length) throw new GeoSamplerError('unknown_continent', `Unknown continent: ${config.region}`);
      const covered = all.filter((c) => hasGoogleCoverage(c.cca2));
      const pool = covered.length ? covered : all;
      sizeKm = sizeForBox(unionBox(pool));
      next = fromPool(pool);
      break;
    }
    case 'country': {
      const country = countryByCode(config.region);
      if (!country) throw new GeoSamplerError('unknown_country', `Unknown country: ${config.region}`);
      sizeKm = sizeForBox(countryBox(country));
      next = () => pointIn(country);
      break;
    }
    case 'cities': {
      const cities = citiesFor(config.provider);
      if (!cities.length) throw new GeoSamplerError('no_cities', 'No cities for this provider');
      next = () => {
        const city = cities[Math.floor(rng() * cities.length)];
        const point = randomPointInDisk(rng, city, city.radiusKm);
        return {
          lat: point.lat,
          lng: point.lng,
          country: countryByCode(city.country),
          city: city.name,
          radiusKm: Math.min(presetKm, 2),
        };
      };
      break;
    }
    case 'everywhere': {
      // Cities in countries with no official coverage. What imagery
      // exists there is user photo spheres, which are far sparser than
      // a Street View car's line, so the probe looks further out: two
      // kilometres would come back empty most of the time.
      const cities = citiesOffCoverage();
      if (!cities.length) throw new GeoSamplerError('no_cities', 'No off-coverage cities');
      next = () => {
        const city = cities[Math.floor(rng() * cities.length)];
        const point = randomPointInDisk(rng, city, city.radiusKm);
        return {
          lat: point.lat,
          lng: point.lng,
          country: countryByCode(city.country),
          city: city.name,
          radiusKm: Math.max(presetKm, 10),
        };
      };
      break;
    }
    default:
      throw new GeoSamplerError('unknown_mode', `Unknown mode: ${config.mode}`);
  }

  if (!next) throw new GeoSamplerError('empty_pool', 'No countries to sample from');
  return { next, stats, sizeKm, rng };
}
