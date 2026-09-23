/**
 * Every map draws its tiles from app/lib/maps/tiles.js.
 *
 * CARTO's free tiles began arriving stamped "API KEY REQUIRED", as a 200,
 * and because seventeen files had each written a tile URL in for
 * themselves, every map on the site showed the stamp at once: the report
 * form's pin, each pet's page, shelters, Rescue Forces, and the map on
 * every printed flyer. Keeping tile addresses in one module makes the next
 * provider change one edit instead of a hunt.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');

const TILES_MODULE = 'app/lib/maps/tiles.js';
// The game draws its own maps (Apple MapKit and its own layers).
const GAME = ['app/geo/', 'app/lib/geo/'];
const TILE_ADDRESS = /\{z\}|\$\{z\}|tile\.openstreetmap\.org|cartocdn|arcgisonline\.com|basemaps\./;

function sources() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(full);
      } else if (/\.(js|jsx|ts|tsx|mjs)$/.test(entry.name)) {
        out.push(full);
      }
    }
  };
  for (const dir of ['app', 'lib', 'components']) walk(path.join(ROOT, dir));
  return out.filter((file) => rel(file) !== TILES_MODULE && !GAME.some((g) => rel(file).startsWith(g)));
}

test('no file outside app/lib/maps/tiles.js names a map tile address', () => {
  const found = [];
  for (const file of sources()) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (TILE_ADDRESS.test(line)) found.push(`${rel(file)}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  // Import TILE_URL / tileLayerOptions / tileUrl from app/lib/maps/tiles.js.
  expect(found).toEqual([]);
});

test('the shared basemap needs no key and credits OpenStreetMap', () => {
  const tiles = require('@/app/lib/maps/tiles');
  expect(tiles.TILE_URL).toMatch(/^https:\/\/tile\.openstreetmap\.org\//);
  expect(tiles.TILE_URL).not.toMatch(/key=|cartocdn/);
  expect(tiles.tileUrl(15, 1, 2)).toBe('https://tile.openstreetmap.org/15/1/2.png');
  expect(tiles.tileLayerOptions().attribution).toMatch(/OpenStreetMap/);
  expect(tiles.TILE_ATTRIBUTION_TEXT).toMatch(/OpenStreetMap/);
});

test('dark maps invert the shared tiles, and the stylesheet defines how', () => {
  const tiles = require('@/app/lib/maps/tiles');
  expect(tiles.tileLayerOptions({ dark: true }).className).toBe('map-tiles-dark');
  expect(tiles.tileLayerOptions().className).toBeUndefined();
  expect(fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')).toMatch(/\.map-tiles-dark\s*\{[^}]*filter:\s*invert/);
});
