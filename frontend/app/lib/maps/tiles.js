/**
 * The basemap every map on the pet site draws, in one place.
 *
 * CARTO's free basemaps began answering any request without an API key
 * with a tile stamped "API KEY REQUIRED", and they answer it with a 200,
 * so nothing failed and nothing fell back. Every live map showed the
 * stamp: the pin in the lost-pet report form, each pet's page, the
 * sighting form, shelters, Rescue Forces and Mission Control, and the map
 * printed on every flyer (whose fallback to OpenStreetMap never ran,
 * because the stamped tile arrived as a success). Seventeen files had
 * each written the URL in for themselves.
 *
 * OpenStreetMap's own tiles need no key. Their usage policy asks for the
 * attribution below and a real User-Agent on server requests, and
 * forbids bulk downloading, which nothing here does. The dark map
 * screens draw the same tiles inverted (the map-tiles-dark class in
 * app/globals.css) rather than depending on a second provider.
 *
 * Enforced by __tests__/map-tiles.test.js: no other file names a tile URL.
 */

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const TILE_MAX_ZOOM = 19;

/**
 * Leaflet options for the basemap. `dark: true` draws it inverted, for the
 * screens designed on a dark map; `calm: true` mutes OpenStreetMap's
 * colours so pins stand out on the redesigned light pages.
 */
export function tileLayerOptions({ dark = false, calm = false, ...rest } = {}) {
  const className = dark ? 'map-tiles-dark' : calm ? 'map-tiles-calm' : undefined;
  return {
    attribution: TILE_ATTRIBUTION,
    maxZoom: TILE_MAX_ZOOM,
    ...(className ? { className } : {}),
    ...rest,
  };
}

/** One tile, for code that fetches tiles itself (the flyer's static map). */
export function tileUrl(z, x, y) {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

/** Plain-text attribution, for places that cannot render a link (a PDF). */
export const TILE_ATTRIBUTION_TEXT = '© OpenStreetMap contributors';

/* Satellite imagery and the road-and-place overlay drawn over it, for the
   flyer-posting map and the search map's satellite view. Esri serves both
   without a key; the overlay replaces CARTO's labels-only tiles, which
   carry the same stamp. */
export const SATELLITE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const SATELLITE_LABELS_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}';
export const SATELLITE_ATTRIBUTION = 'Imagery &copy; Esri';
