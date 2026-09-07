#!/usr/bin/env node
/**
 * Builds app/lib/geo/data/countries-meta.json from the world-countries
 * package (devDependency): one compact row per country so the game can
 * name, flag, group and weight countries without shipping the 1 MB
 * source file. The polygons come from world-atlas at runtime and join on
 * the ISO 3166-1 numeric code (ccn3), which is the feature id there.
 *
 *   node scripts/build-geo-countries.js
 *
 * Re-run after bumping world-countries. Output is committed.
 */

const fs = require('node:fs');
const path = require('node:path');

const countries = require('world-countries');

const rows = countries
  .map((c) => ({
    ccn3: c.ccn3,
    cca2: c.cca2,
    cca3: c.cca3,
    name: c.name.common,
    region: c.region,
    subregion: c.subregion || '',
    area: c.area,
    flag: c.flag,
    lat: Array.isArray(c.latlng) ? c.latlng[0] : null,
    lng: Array.isArray(c.latlng) ? c.latlng[1] : null,
    capital: Array.isArray(c.capital) && c.capital.length ? c.capital[0] : '',
  }))
  .filter((c) => c.ccn3 && c.cca2)
  .sort((a, b) => a.name.localeCompare(b.name));

const out = path.join(__dirname, '..', 'app', 'lib', 'geo', 'data', 'countries-meta.json');
fs.writeFileSync(out, JSON.stringify(rows));
console.log(`wrote ${rows.length} countries to ${path.relative(process.cwd(), out)}`);
