/**
 * Country polygons and metadata, server side.
 *
 * Polygons: Natural Earth 1:110m via the world-atlas package (public
 * domain), decoded from TopoJSON once per process. Names, codes, flags,
 * regions and areas: app/lib/geo/data/countries-meta.json, generated
 * from world-countries by scripts/build-geo-countries.js.
 *
 * Used for three things: rejecting ocean points before probing, drawing
 * random points inside a chosen country, and naming the country a
 * panorama sits in without calling any geocoder.
 *
 * 1:110m is coarse: coastlines are simplified and small islands are
 * missing. That is fine for sampling (the imagery probe is the real
 * test) and for naming (a miss near a coast returns null, which callers
 * fall back from). Countries with no polygon at this scale (Singapore,
 * Malta, Monaco...) get a disk around their listed centre instead.
 */

import topology from 'world-atlas/countries-110m.json';
import { feature } from 'topojson-client';
import META from '../data/countries-meta.json';
import { CONTINENTS } from '../modes';
import { hasAppleCoverage, hasGoogleCoverage } from '../coverage';
import { randomPointInBox, randomPointInDisk, randomPointOnSphere, weightedIndex } from '../random';

const toRad = (deg) => (deg * Math.PI) / 180;

function ringBox(ring) {
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  for (const [lng, lat] of ring) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

/** Approximate area of a ring in km², planar with cos(lat) scaling. */
function ringAreaKm2(ring) {
  if (ring.length < 3) return 0;
  let latSum = 0;
  for (const [, lat] of ring) latSum += lat;
  const cosLat = Math.cos(toRad(latSum / ring.length)) || 1e-9;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * cosLat * y2 - x2 * cosLat * y1;
  }
  return Math.abs(sum / 2) * 111.32 * 110.574;
}

function inBox(lat, lng, box) {
  return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
}

/** Ray casting; ring is [[lng, lat], ...]. */
export function pointInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInPart(lat, lng, part) {
  if (!inBox(lat, lng, part.box)) return false;
  if (!pointInRing(lat, lng, part.outer)) return false;
  for (const hole of part.holes) {
    if (pointInRing(lat, lng, hole)) return false;
  }
  return true;
}

function unionBox(boxes) {
  if (!boxes.length) return null;
  return boxes.reduce(
    (acc, box) => ({
      minLat: Math.min(acc.minLat, box.minLat),
      maxLat: Math.max(acc.maxLat, box.maxLat),
      minLng: Math.min(acc.minLng, box.minLng),
      maxLng: Math.max(acc.maxLng, box.maxLng),
    }),
    { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 }
  );
}

function buildParts(geometry) {
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons
    .map((rings) => {
      const outer = rings[0] || [];
      const holes = rings.slice(1);
      const weight = Math.max(0, ringAreaKm2(outer) - holes.reduce((s, h) => s + ringAreaKm2(h), 0));
      return { outer, holes, box: ringBox(outer), weight };
    })
    .filter((part) => part.outer.length >= 3);
}

function diskFor(meta) {
  if (!meta || !Number.isFinite(meta.lat) || !Number.isFinite(meta.lng)) return null;
  const radiusKm = Math.max(4, Math.sqrt((meta.area || 0) / Math.PI) * 1.2);
  return { center: { lat: meta.lat, lng: meta.lng }, radiusKm };
}

let cache = null;

function build() {
  const metaByN = new Map(META.map((m) => [m.ccn3, m]));
  const metaByName = new Map(META.map((m) => [m.name, m]));
  const usedCodes = new Set();
  const list = [];

  const features = feature(topology, topology.objects.countries).features;
  for (const f of features) {
    const id = f.id !== undefined && f.id !== null ? String(f.id).padStart(3, '0') : '';
    const name = f.properties?.name || '';
    const meta = metaByN.get(id) || metaByName.get(name) || null;
    const parts = buildParts(f.geometry);
    const box = unionBox(parts.map((p) => p.box));
    const record = {
      ccn3: meta?.ccn3 || `ne-${name}`,
      cca2: meta?.cca2 || '',
      cca3: meta?.cca3 || '',
      name: meta?.name || name,
      flag: meta?.flag || '',
      region: meta?.region || '',
      subregion: meta?.subregion || '',
      areaKm2: meta?.area || parts.reduce((s, p) => s + p.weight, 0),
      center: meta && Number.isFinite(meta.lat) ? { lat: meta.lat, lng: meta.lng } : null,
      box,
      parts,
      disk: null,
    };
    if (record.cca2) usedCodes.add(record.cca2);
    list.push(record);
  }

  // Countries with no polygon at 1:110m still exist for the picker and
  // for sampling (as a disk around their listed centre).
  for (const meta of META) {
    if (usedCodes.has(meta.cca2)) continue;
    if (meta.region === 'Antarctic') continue;
    const disk = diskFor(meta);
    if (!disk) continue;
    list.push({
      ccn3: meta.ccn3,
      cca2: meta.cca2,
      cca3: meta.cca3,
      name: meta.name,
      flag: meta.flag,
      region: meta.region,
      subregion: meta.subregion,
      areaKm2: meta.area || 0,
      center: disk.center,
      box: null,
      parts: [],
      disk,
    });
  }

  const byCode = new Map();
  for (const c of list) if (c.cca2) byCode.set(c.cca2, c);
  const withPolygons = list.filter((c) => c.parts.length > 0);
  cache = { list, byCode, withPolygons };
  return cache;
}

function index() {
  return cache || build();
}

/** Every country record (polygon-backed and disk-backed). */
export function getCountries() {
  return index().list;
}

export function countryByCode(cca2) {
  return index().byCode.get(String(cca2 || '').toUpperCase()) || null;
}

/** The country a point lies in, or null (ocean, Antarctica edge, tiny island). */
export function countryAt(lat, lng) {
  for (const country of index().withPolygons) {
    if (!inBox(lat, lng, country.box)) continue;
    for (const part of country.parts) {
      if (pointInPart(lat, lng, part)) return country;
    }
  }
  return null;
}

/** Countries in a continent preset (see modes.CONTINENTS). */
export function countriesInContinent(continentId) {
  const preset = CONTINENTS[continentId];
  if (!preset) return [];
  return index().list.filter((c) => {
    if (!c.cca2) return false;
    if (preset.regions && preset.regions.includes(c.region)) return true;
    if (preset.subregions && preset.subregions.includes(c.subregion)) return true;
    return false;
  });
}

/**
 * A random point inside a country: pick a polygon part by area, then
 * rejection-sample its bounding box. Disk-backed countries sample the
 * disk. Falls back to the listed centre after too many rejections.
 */
export function sampleInCountry(rng, country, { maxAttempts = 400 } = {}) {
  if (!country) return null;
  if (!country.parts.length) {
    if (country.disk) return randomPointInDisk(rng, country.disk.center, country.disk.radiusKm);
    return country.center ? { ...country.center } : null;
  }
  const weights = country.parts.map((p) => p.weight);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const part = country.parts[weightedIndex(rng, weights)];
    const point = randomPointInBox(rng, part.box);
    if (pointInPart(point.lat, point.lng, part)) return point;
  }
  return country.center ? { ...country.center } : randomPointInBox(rng, country.box);
}

/**
 * A point uniformly distributed over land (Antarctica excluded by
 * default). Returns the point, its country, and how many water points
 * were thrown away on the way, which the game shows as a stat.
 */
export function sampleOnLand(rng, { exclude = ['AQ'], maxAttempts = 5000 } = {}) {
  let skipped = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const point = randomPointOnSphere(rng);
    const country = countryAt(point.lat, point.lng);
    if (country && !exclude.includes(country.cca2)) {
      return { point, country, skipped };
    }
    skipped++;
  }
  return null;
}

/** Compact rows for the lobby's country picker. */
export function countryOptions() {
  return index()
    .list.filter((c) => c.cca2 && c.region !== 'Antarctic')
    .map((c) => ({
      code: c.cca2,
      name: c.name,
      flag: c.flag,
      region: c.region,
      subregion: c.subregion,
      google: hasGoogleCoverage(c.cca2),
      apple: hasAppleCoverage(c.cca2),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Public shape of a country for API responses. */
export function publicCountry(country) {
  if (!country) return null;
  return { code: country.cca2, name: country.name, flag: country.flag };
}
