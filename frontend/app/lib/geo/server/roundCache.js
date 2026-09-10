/**
 * Resolved rounds for seeded games, kept for a day.
 *
 * The daily challenge and challenge links are deterministic already, but
 * coverage can shift between two people's probes, and re-probing the same
 * seed for every player is wasted time. So the first resolution of a
 * (seed, round, settings) key is stored and reused until it expires.
 * Panorama ids go stale, which is why nothing lives longer than a day.
 * Rooms keep their rounds on the room itself and do not use this.
 *
 * Both stores swallow their own errors: a cache that is down must never
 * stop a round.
 */

import prisma from '@/app/lib/geo/server/db';

export const ROUND_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function roundCacheKey(config, roundIndex) {
  if (!config?.seed) return null;
  return [config.provider, config.seed, roundIndex, config.mode, config.region || '-', config.radius].join('|');
}

function rowToImagery(row) {
  return {
    panoId: row.panoId,
    heading: row.heading,
    lat: row.lat,
    lng: row.lng,
    country: row.countryCode || row.countryName ? { cca2: row.countryCode || '', name: row.countryName || '', flag: row.countryFlag || '' } : null,
    city: row.city || '',
    date: row.imageDate || '',
    sizeKm: row.sizeKm,
    stats: row.stats || null,
  };
}

function imageryToRow(imagery, now) {
  return {
    panoId: imagery.panoId,
    heading: imagery.heading || 0,
    lat: imagery.lat,
    lng: imagery.lng,
    countryCode: imagery.country?.cca2 || null,
    countryName: imagery.country?.name || null,
    countryFlag: imagery.country?.flag || null,
    city: imagery.city || null,
    imageDate: imagery.date || null,
    sizeKm: imagery.sizeKm,
    stats: imagery.stats || null,
    expiresAt: new Date(now + ROUND_CACHE_TTL_MS),
  };
}

export const prismaRoundCache = {
  async get(key, now = Date.now()) {
    try {
      const row = await prisma.geoRoundCache.findUnique({ where: { key } });
      if (!row || row.expiresAt.getTime() < now) return null;
      return rowToImagery(row);
    } catch {
      return null;
    }
  },
  async set(key, imagery, now = Date.now()) {
    try {
      const data = imageryToRow(imagery, now);
      await prisma.geoRoundCache.upsert({ where: { key }, create: { key, ...data }, update: data });
    } catch {
      /* the cache is a convenience */
    }
  },
};

/** For tests and for running without a database. */
export function createMemoryRoundCache() {
  const map = new Map();
  return {
    async get(key, now = Date.now()) {
      const row = map.get(key);
      if (!row || row.expiresAt.getTime() < now) return null;
      return rowToImagery(row);
    },
    async set(key, imagery, now = Date.now()) {
      map.set(key, { key, ...imageryToRow(imagery, now) });
    },
    size() {
      return map.size;
    },
  };
}
