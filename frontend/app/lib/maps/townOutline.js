/**
 * A town's outline from OpenStreetMap (Nominatim), for a Rescue Force's
 * area. Looked up once per force and saved (app/lib/forceOutlines.js); the
 * directory and the force's page draw it, and new reports are matched to
 * it (areaCovers in app/lib/maps/forceArea.js).
 *
 * The search is the town's name inside a box around the force's center, so
 * a common name ("Clinton") finds this Clinton rather than a county of the
 * same name three states away. Of what comes back, it keeps outlines with
 * the town's own name that hold the center (or come within 3 miles of it)
 * and picks the smallest: Heredia, Costa Rica, is a city, a canton and a
 * province, and the force is the city. When nothing fits, it asks what the
 * center itself is inside, and takes that only if the name matches.
 * Nothing found means null, and the force keeps its circle.
 *
 * Nominatim asks for at most one request a second and a real User-Agent
 * (https://operations.osmfoundation.org/policies/nominatim/), so requests
 * wait in line here, a second apart.
 */

import { USER_AGENT } from '@/app/lib/brand';
import { milesBetween, milesOutside, outlineRings } from '@/app/lib/maps/forceArea';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const GAP_MS = 1100;
const TIMEOUT_MS = 15000;
// The search box: about 24 miles each way from the center.
const BOX_LAT = 0.35;
const BOX_LNG = 0.45;
const NEAR_MILES = 3;
// A town, not a province or a country. Big municipalities in Latin America
// run to tens of miles across.
const MAX_ACROSS_MILES = 120;
// Nominatim thins the outline to about 30 meters before sending it.
const THRESHOLD = 0.0003;

let line = Promise.resolve();
let lastAt = 0;

/** One request at a time, `gapMs` apart. */
function inLine(url, { fetchImpl, gapMs }) {
  const run = line.then(async () => {
    const wait = lastAt + gapMs - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetchImpl(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Nominatim answered ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  });
  line = run.catch(() => {});
  return run;
}

const GENERIC = /\b(city|town|village|township|borough|municipality|municipio|ciudad|pueblo)\b/g;

/** "Village of St. Charles" and "Saint Charles" read the same. */
export function sameTownName(a, b) {
  const norm = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[.,'’()-]/g, ' ')
      .replace(/\bst\b/g, 'saint')
      .replace(/\bft\b/g, 'fort')
      .replace(/\bmt\b/g, 'mount')
      .replace(/^\s*(city|town|village|borough|municipality|municipio|ciudad) (of|de)\b/, '')
      .replace(GENERIC, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const x = norm(a);
  return x !== '' && x === norm(b);
}

function isOutline(geo) {
  return geo && (geo.type === 'Polygon' || geo.type === 'MultiPolygon');
}

/** Miles across the outline's bounding box, corner to corner. */
function milesAcross(rings) {
  let south = 90;
  let north = -90;
  let west = 180;
  let east = -180;
  for (const ring of rings) {
    for (const [lat, lng] of ring) {
      south = Math.min(south, lat);
      north = Math.max(north, lat);
      west = Math.min(west, lng);
      east = Math.max(east, lng);
    }
  }
  return milesBetween({ lat: south, lng: west }, { lat: north, lng: east });
}

/**
 * The outline Nominatim results offer for this town and center: a result
 * with the town's name, an outline no wider than a town, holding the center
 * or within NEAR_MILES of it; the smallest such. Null when none fits.
 */
export function pickOutline(results, { town, center }) {
  const fits = (Array.isArray(results) ? results : [])
    .filter((r) => isOutline(r?.geojson) && sameTownName(r.name, town))
    .map((r) => {
      const rings = outlineRings(r.geojson);
      return { r, rings, across: rings.length ? milesAcross(rings) : Infinity };
    })
    .filter(({ rings, across }) => rings.length > 0 && across <= MAX_ACROSS_MILES)
    .filter(({ rings }) => milesOutside(rings, center) <= NEAR_MILES)
    .sort((a, b) => a.across - b.across);
  return fits.length ? fits[0].r.geojson : null;
}

/**
 * The town outline for a force ({ city, name, country, centerLatitude,
 * centerLongitude }), as GeoJSON (Polygon or MultiPolygon), or null.
 * Throws only when Nominatim cannot be reached, so the caller can try
 * again later rather than record that the town has no outline.
 */
export async function lookupTownOutline(force, { fetchImpl = fetch, gapMs = GAP_MS } = {}) {
  const town = (force.city || String(force.name || '').replace(/\s+(Pet Rescue|Rescue Force)$/i, '')).trim();
  const lat = Number(force.centerLatitude);
  const lng = Number(force.centerLongitude);
  if (!town || force.centerLatitude == null || force.centerLongitude == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  const center = { lat, lng };
  const common = `format=jsonv2&polygon_geojson=1&polygon_threshold=${THRESHOLD}`;

  const box = [lng - BOX_LNG, lat + BOX_LAT, lng + BOX_LNG, lat - BOX_LAT].map((v) => v.toFixed(4)).join(',');
  const found = await inLine(
    `${NOMINATIM}/search?q=${encodeURIComponent(town)}&${common}&limit=10&viewbox=${box}&bounded=1`,
    { fetchImpl, gapMs }
  );
  const picked = pickOutline(found, { town, center });
  if (picked) return picked;

  // What is the center itself inside, at town level? Only if it is this town.
  const here = await inLine(`${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&${common}&zoom=10`, { fetchImpl, gapMs });
  return pickOutline(here ? [here] : [], { town, center });
}
