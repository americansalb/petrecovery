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
import { RADIUS_PRESETS } from '../modes';
import { citiesFor, hasGoogleCoverage } from '../coverage';
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

function countryBox(country) {
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
 * Build a candidate source for one round.
 * Returns { next(), stats, sizeKm, rng }.
 */
export function createCandidateSource(config, roundIndex = 0) {
  const seed = config.seed ? roundSeed(config.seed, roundIndex) : `${randomSeedString()}-${Date.now()}-${roundIndex}`;
  const rng = createRng(seed);
  const presetKm = RADIUS_PRESETS[config.radius]?.km ?? RADIUS_PRESETS.standard.km;
  const stats = { skippedWater: 0 };

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
    default:
      throw new GeoSamplerError('unknown_mode', `Unknown mode: ${config.mode}`);
  }

  if (!next) throw new GeoSamplerError('empty_pool', 'No countries to sample from');
  return { next, stats, sizeKm, rng };
}
