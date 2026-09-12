#!/usr/bin/env node
/**
 * Build the admin-1 polygons the script game scores against.
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
const OUT = path.join(__dirname, '..', 'app', 'lib', 'geo', 'data', 'admin1-south-asia.json');

// The countries the script game's South Asian languages are spoken in.
const COUNTRIES = { IND: 'IN', PAK: 'PK', BGD: 'BD', NPL: 'NP', LKA: 'LK' };

// About two kilometres. Fine enough that a coastline is a coastline and
// a state border follows the river it follows; coarse enough that the
// whole of South Asia is a file you can ship.
const TOLERANCE_DEG = 0.02;
// Drop slivers, keep real islands: this is roughly the Lakshadweep
// group's smaller atolls, which are inhabited and speak Malayalam.
const MIN_RING_AREA_DEG2 = 0.0004;
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
  const units = {};
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
      const thinned = simplify(ring, TOLERANCE_DEG).map(([lng, lat]) => [
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

  const out = {
    source: 'Natural Earth 10m admin-1 states and provinces (public domain)',
    note: 'Built by scripts/build-language-regions.js. India: states and union territories. Sri Lanka: districts. Pakistan: provinces. Bangladesh: divisions. Nepal: zones.',
    toleranceDeg: TOLERANCE_DEG,
    units,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(out)}\n`);
  const size = fs.statSync(OUT).size;
  process.stdout.write(`${kept} units, ${rawPoints} points in, ${outPoints} out, ${(size / 1024).toFixed(0)} KB\n${OUT}\n`);
})().catch((error) => {
  process.stderr.write(`${error?.message || error}\n`);
  process.exit(1);
});
