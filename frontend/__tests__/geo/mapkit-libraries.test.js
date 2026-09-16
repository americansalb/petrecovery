/**
 * The game must load the MapKit bundle that actually ships Look Around,
 * and must ask for every library it reads a member from.
 *
 * This exists because the same bug shipped three times (#264, #277,
 * #278). The game loaded cdn.apple-mapkit.com/mk/5.x.x/mapkit.js, the
 * legacy full bundle. Read that file and `LookAround` appears only as a
 * getter that throws and as a string in a list of names: there is no
 * implementation in it, `load` is deleted, and `loadLibraries` is a
 * stub that logs a warning. So the getter throws forever, and each fix
 * in turn checked it, checked loadedLibraries, then waited twelve
 * seconds for it, while every Apple round on the live site stayed dead.
 *
 * mapkit.core.js is the bundle with the library registry that contains
 * look-around. Nothing is on its namespace until the library carrying
 * it is loaded, so the list has to be complete.
 */

const fs = require('node:fs');
const path = require('node:path');

const GEO = path.join(__dirname, '..', '..', 'app', 'geo');
const LOADER = path.join(GEO, 'lib', 'appleMapKit.js');
const source = fs.readFileSync(LOADER, 'utf8');

/** Which library carries which member, from mapkit.core.js. */
const LIBRARY_OF = {
  Map: 'map',
  Coordinate: 'map',
  CoordinateSpan: 'map',
  CoordinateRegion: 'map',
  CameraZoomRange: 'map',
  Padding: 'map',
  Style: 'map',
  FeatureVisibility: 'map',
  Annotation: 'annotations',
  MarkerAnnotation: 'annotations',
  PinAnnotation: 'annotations',
  ImageAnnotation: 'annotations',
  CircleOverlay: 'overlays',
  PolylineOverlay: 'overlays',
  PolygonOverlay: 'overlays',
  TileOverlay: 'overlays',
  Geocoder: 'services',
  Search: 'services',
  PlaceLookup: 'services',
  Directions: 'services',
  LookAround: 'look-around',
  LookAroundPreview: 'look-around',
  LookAroundScene: 'look-around',
};

/** Every file under app/geo, so a new call site cannot hide. */
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.jsx?$/.test(entry.name) ? [full] : [];
  });
}

const requested = (source.match(/const LIBRARIES = \[([^\]]*)\]/) || [, ''])[1]
  .split(',')
  .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
  .filter(Boolean);

describe('MapKit bundle and libraries', () => {
  test('loads mapkit.core.js, not the legacy full bundle', () => {
    expect(source).toMatch(/mapkit\.core\.js/);
    // The full bundle is the one with no Look Around in it.
    expect(source).not.toMatch(/5\.x\.x\/mapkit\.js/);
  });

  test('asks for look-around explicitly', () => {
    expect(requested).toContain('look-around');
  });

  test('asks for every library app/geo reads a member from', () => {
    const used = new Set();
    for (const file of walk(GEO)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const match of text.matchAll(/\bmapkit\.([A-Z][A-Za-z]+)/g)) {
        const library = LIBRARY_OF[match[1]];
        if (library) used.add(library);
      }
    }
    const missing = [...used].filter((library) => !requested.includes(library));
    expect(missing).toEqual([]);
  });

  test('only asks for libraries MapKit actually has', () => {
    const known = ['map', 'annotations', 'overlays', 'services', 'geojson', 'user-location', 'look-around', 'full-map', 'legacy'];
    expect(requested.filter((l) => !known.includes(l))).toEqual([]);
  });
});
