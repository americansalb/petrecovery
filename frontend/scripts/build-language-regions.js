#!/usr/bin/env node
/**
 * Build the map data the script game needs: the admin-1 polygons it
 * scores against, and the country labels it draws.
 *
 * Language regions used to be discs: a centre and a radius. A disc is
 * wrong in a way that shows on the map, because no language is a circle:
 * the Maithili disc covered half of Nepal and a corner of Bangladesh,
 * and the Marathi one reached into Telangana. States are not a perfect
 * model of a language either, but they are a real boundary, they are
 * what a player thinks in when they pin Kerala or Punjab, and where a
 * language covers only part of a state the region can be clipped
 * (app/lib/geo/regions.js).
 *
 * Source: Natural Earth 10m admin-1 states and provinces, public
 * domain. India is states and union territories, Sri Lanka districts,
 * Pakistan provinces, Bangladesh divisions, Nepal zones.
 *
 *   node scripts/build-language-regions.js [path-or-url]
 *
 * Default source is the Natural Earth repository on GitHub. The output
 * is committed, so the build never fetches anything.
 */

const fs = require('node:fs');
const path = require('node:path');

const SOURCE = process.argv[2]
  || 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';
const COUNTRY_SOURCE = process.argv[3]
  || 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson';
const OUT = path.join(__dirname, '..', 'app', 'lib', 'geo', 'data', 'language-regions.json');
const LABELS_OUT = path.join(__dirname, '..', 'app', 'lib', 'geo', 'data', 'country-labels.json');

/**
 * The countries a language is drawn inside rather than over: where the
 * corpus needs states, provinces, regions or districts because a
 * language covers part of the country and not the whole of it. Kurdish
 * needs four of them at once; Mandarin needs China's provinces because
 * Cantonese is not Mandarin; Yoruba and Hausa split Nigeria between
 * them. Everywhere else a country is a country.
 */
const SUBDIVIDED = {
  IND: 'IN', PAK: 'PK', BGD: 'BD', NPL: 'NP', LKA: 'LK',
  CHN: 'CN', TUR: 'TR', IRQ: 'IQ', IRN: 'IR', SYR: 'SY', AFG: 'AF',
  ESP: 'ES', FRA: 'FR', GBR: 'GB', BEL: 'BE', CHE: 'CH', ROU: 'RO',
  NGA: 'NG', ETH: 'ET', ZAF: 'ZA', CAN: 'CA',
};
// South Asia was drawn first and at two kilometres; everywhere else is
// five, which is still finer than any isogloss is knowable.
const FINE = new Set(['IN', 'PK', 'BD', 'NP', 'LK']);
const COUNTRIES = SUBDIVIDED;

// About two kilometres. Fine enough that a coastline is a coastline and
// a state border follows the river it follows; coarse enough that the
// whole of South Asia is a file you can ship.
const TOLERANCE_DEG = 0.02;
const COARSE_TOLERANCE_DEG = 0.05;
// Countries travel to the browser whole on a reveal, so they are
// thinned, but not past their coastlines: at four kilometres Reykjavik,
// Montreal and Buenos Aires all fell outside their own countries,
// because every one of them is on a coast or a river. Two kilometres
// keeps the cities inside and the file reasonable.
const COUNTRY_TOLERANCE_DEG = 0.02;
// Drop slivers, keep real islands: this is roughly the Lakshadweep
// group's smaller atolls, which are inhabited and speak Malayalam.
const MIN_RING_AREA_DEG2 = 0.0003;
const PLACES = 3;

/** Ramer-Douglas-Peucker, in degrees. The ring is closed, so keep the ends. */
function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let worst = 0;
    let index = -1;
    const [x1, y1] = points[first];
    const [x2, y2] = points[last];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const span = dx * dx + dy * dy;
    for (let i = first + 1; i < last; i++) {
      const [x, y] = points[i];
      let distance;
      if (span === 0) {
        distance = Math.hypot(x - x1, y - y1);
      } else {
        const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / span));
        distance = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
      }
      if (distance > worst) {
        worst = distance;
        index = i;
      }
    }
    if (worst > tolerance && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Shoelace area in square degrees, unsigned: only used to drop slivers. */
function ringArea(points) {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += (points[j][0] + points[i][0]) * (points[j][1] - points[i][1]);
  }
  return Math.abs(sum / 2);
}

function ringsOf(geometry) {
  if (!geometry) return [];
  // Outer rings only. The holes in this data are enclaves that exist as
  // their own feature anyway (Puducherry inside Tamil Nadu), and both
  // answers are the same language.
  if (geometry.type === 'Polygon') return [geometry.coordinates[0]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((polygon) => polygon[0]);
  return [];
}

/**
 * Whole countries, for the languages that are one.
 *
 * Same shapes as the labels above, and the same source, so a region
 * drawn as "Iceland" is the Iceland the map draws. Simplified harder
 * than the subdivisions are: a country is a big thing, and these ship
 * to the browser on a reveal.
 */
async function buildCountries() {
  const collection = await read(COUNTRY_SOURCE);
  const countries = {};
  for (const feature of collection.features) {
    const p = feature.properties || {};
    const code = p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2;
    const name = p.NAME || p.NAME_EN;
    if (!code || code === '-99' || !name) continue;
    const rings = [];
    for (const ring of ringsOf(feature.geometry)) {
      if (ringArea(ring) < MIN_RING_AREA_DEG2) continue;
      const thinned = simplify(ring, COUNTRY_TOLERANCE_DEG).map(([lng, lat]) => [
        Number(lng.toFixed(PLACES)),
        Number(lat.toFixed(PLACES)),
      ]);
      if (thinned.length < 4) continue;
      thinned[thinned.length - 1] = thinned[0];
      rings.push(thinned);
    }
    if (!rings.length) continue;
    rings.sort((a, b) => ringArea(b) - ringArea(a));
    // Natural Earth carries a couple of entries per code (a country and
    // its dependencies); the bigger geometry is the country.
    const existing = countries[code];
    if (existing && existing.rings.reduce((n, r) => n + r.length, 0) >= rings.reduce((n, r) => n + r.length, 0)) continue;
    countries[code] = { name, rings };
  }
  process.stdout.write(`${Object.keys(countries).length} country outlines\n`);
  return countries;
}

/**
 * The country names the map writes on itself.
 *
 * A world outline with no words asks the player to recognise a country
 * by its shape, which is a different game and a worse one: the round is
 * "where is this language spoken", not "can you identify Paraguay from
 * its silhouette". Countries only. No states, no cities, nothing
 * smaller, because those would hand over the answer.
 *
 * Natural Earth carries a label anchor (LABEL_X, LABEL_Y) and the zoom
 * it wants the label to appear at (MIN_LABEL), both set by
 * cartographers rather than computed from a centroid, so Norway is
 * labelled down its middle and Chile is labelled where Chile is wide.
 *
 * What gets a label is what Natural Earth types as a country or a
 * sovereign country. Disputed and indeterminate entries are drawn like
 * any other land and left unnamed: this is a language game, and it has
 * no business adjudicating anybody's borders.
 */
async function buildLabels() {
  const collection = await read(COUNTRY_SOURCE);
  const labels = [];
  for (const feature of collection.features) {
    const p = feature.properties || {};
    const type = p.TYPE || p.type;
    if (type !== 'Country' && type !== 'Sovereign country') continue;
    // NAME is the cartographic short form: "China", not "People's
    // Republic of China", which is what belongs on a map this small.
    // Two are still long enough to run across a neighbour.
    const SHORTER = { 'United States of America': 'United States', 'Central African Rep.': 'C.A.R.' };
    const raw = p.NAME || p.NAME_EN || p.name;
    const name = SHORTER[raw] || raw;
    const lng = p.LABEL_X ?? p.label_x;
    const lat = p.LABEL_Y ?? p.label_y;
    if (!name || !Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const zoom = Math.max(1, Math.round(p.MIN_LABEL ?? p.min_label ?? 5));
    // MAX_LABEL is where the cartographers stop drawing it: zoomed into
    // India, "RUSSIA" floating over the top is clutter, not context.
    const until = Math.max(zoom, Math.round(p.MAX_LABEL ?? p.max_label ?? 12));
    labels.push({ n: name, x: Number(lng.toFixed(2)), y: Number(lat.toFixed(2)), z: zoom, u: until });
  }
  labels.sort((a, b) => a.z - b.z || a.n.localeCompare(b.n));
  fs.writeFileSync(LABELS_OUT, `${JSON.stringify({ source: 'Natural Earth 10m admin-0 (public domain)', labels })}\n`);
  process.stdout.write(`${labels.length} country labels, ${(fs.statSync(LABELS_OUT).size / 1024).toFixed(0)} KB\n`);
}

/**
 * The codes app/lib/geo/languages.js actually names. Read from the
 * source rather than imported, because that file is ES modules and this
 * script is a plain node script run by hand.
 */
function referencedCodes() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'lib', 'geo', 'languages.js'), 'utf8');
  const collect = (key) => {
    const out = new Set();
    for (const match of src.matchAll(new RegExp(`${key}: \\[([^\\]]*)\\]`, 'g'))) {
      for (const code of match[1].matchAll(/'([^']+)'/g)) out.add(code[1]);
    }
    return out;
  };
  const countries = collect('countries');
  const units = collect('units');
  process.stdout.write(`languages.js names ${countries.size} countries and ${units.size} subdivisions\n`);
  return { countries, units };
}

async function read(source) {
  if (/^https?:/.test(source)) {
    process.stdout.write(`fetching ${source}\n`);
    const response = await fetch(source);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  }
  return JSON.parse(fs.readFileSync(source, 'utf8'));
}

(async () => {
  const collection = await read(SOURCE);
  let units = {};
  let kept = 0;
  let rawPoints = 0;
  let outPoints = 0;

  for (const feature of collection.features) {
    const cca2 = COUNTRIES[feature.properties?.adm0_a3];
    if (!cca2) continue;
    const id = feature.properties.iso_3166_2;
    const name = feature.properties.name;
    if (!id || !name) {
      process.stdout.write(`skipped a ${cca2} feature with no code or name\n`);
      continue;
    }
    const rings = [];
    for (const ring of ringsOf(feature.geometry)) {
      rawPoints += ring.length;
      if (ringArea(ring) < MIN_RING_AREA_DEG2) continue;
      const thinned = simplify(ring, FINE.has(cca2) ? TOLERANCE_DEG : COARSE_TOLERANCE_DEG).map(([lng, lat]) => [
        Number(lng.toFixed(PLACES)),
        Number(lat.toFixed(PLACES)),
      ]);
      if (thinned.length < 4) continue;
      // Close it again: rounding can move the last point off the first.
      thinned[thinned.length - 1] = thinned[0];
      rings.push(thinned);
      outPoints += thinned.length;
    }
    if (!rings.length) {
      process.stdout.write(`skipped ${id} (${name}): no ring survived\n`);
      continue;
    }
    // Largest ring first, so the label and the centre land on the
    // mainland rather than on an island.
    rings.sort((a, b) => ringArea(b) - ringArea(a));
    units[id] = { name, cca2, rings };
    kept += 1;
  }

  await buildLabels();
  let countries = await buildCountries();

  // Only what the corpus names. Natural Earth has 258 countries and
  // 4,596 subdivisions; the game uses a fraction of each, and the rest
  // is dead weight in a file the server parses on boot.
  const wanted = referencedCodes();
  const keptCountries = {};
  for (const [code, shape] of Object.entries(countries)) if (wanted.countries.has(code)) keptCountries[code] = shape;
  const keptUnits = {};
  for (const [id, unit] of Object.entries(units)) if (wanted.units.has(id)) keptUnits[id] = unit;
  const missing = [...wanted.countries].filter((c) => !keptCountries[c]).concat([...wanted.units].filter((u) => !keptUnits[u]));
  if (missing.length) throw new Error(`languages.js names places this source does not have: ${missing.join(', ')}`);
  countries = keptCountries;
  units = keptUnits;

  const out = {
    source: 'Natural Earth 10m admin-0 and admin-1 (public domain)',
    note: 'Built by scripts/build-language-regions.js. `countries` are whole countries; `units` are the subdivisions of the countries a language covers only part of.',
    toleranceDeg: TOLERANCE_DEG,
    countries,
    units,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(out)}\n`);
  const size = fs.statSync(OUT).size;
  process.stdout.write(`${kept} units, ${rawPoints} points in, ${outPoints} out, ${(size / 1024).toFixed(0)} KB\n${OUT}\n`);
})().catch((error) => {
  process.stderr.write(`${error?.message || error}\n`);
  process.exit(1);
});
