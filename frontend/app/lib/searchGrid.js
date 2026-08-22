/**
 * Search grid generation - the collaborative board's geometry.
 *
 * The schema has carried SearchGrid and GridCell since the start: status
 * machine, claim fields, priority, bounds per cell. Nothing ever wrote a
 * row or drew one. This module is the missing half: pure math that turns
 * a case's last-seen point and radius into cells a person can claim and
 * walk.
 *
 * Design decisions, so they are argued once:
 *
 * - A cell is ONE WALK. Too small and marking cells becomes bookkeeping;
 *   too big and "searched" stops meaning anything. 100-300m squares,
 *   chosen so the whole board stays under MAX_CELLS.
 * - The board is smaller than the alert radius. searchRadius defaults to
 *   5 miles, which is who to NOTIFY, not where feet go. Lost pets are
 *   usually close (the probability zones already say so), and a board
 *   with hundreds of cells reads as despair.
 * - Priority is why the map can say "start here" instead of "here is a
 *   grid". Seeded from distance to the last-seen point, boosted near
 *   sightings, freshest sightings loudest.
 *
 * Everything here is pure and unit-tested; Prisma stays in the routes.
 */

const METERS_PER_DEGREE_LAT = 111320;

// 800m, not the 2km first tried: a 2km board made 421 cells, and
// "2 of 421 blocks searched" reads as despair. Most recoveries happen
// close to home, a five-person party can genuinely finish ~90 blocks,
// and a finished board is the feeling this feature exists to make.
export const MAX_BOARD_RADIUS_METERS = 800;
export const MAX_CELLS = 120;
export const CELL_SIZE_CHOICES = [100, 125, 150, 175, 200, 250, 300];

/** Sightings older than this stop bending priority. */
export const SIGHTING_PRIORITY_WINDOW_MS = 72 * 60 * 60 * 1000;

export function milesToMeters(miles) {
  return miles * 1609.344;
}

export function metersPerDegreeLng(latitude) {
  return METERS_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180);
}

/**
 * Straight-line meters between two points. Equirectangular is plenty at
 * neighbourhood scale and keeps this trivially testable.
 */
export function distanceMeters(a, b) {
  const dLat = (b.lat - a.lat) * METERS_PER_DEGREE_LAT;
  const dLng = (b.lng - a.lng) * metersPerDegreeLng((a.lat + b.lat) / 2);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * The board radius for a case: its alert radius, capped to walking scale.
 */
export function boardRadiusMeters(searchRadiusMiles) {
  const requested = milesToMeters(searchRadiusMiles || 1);
  return Math.max(400, Math.min(requested, MAX_BOARD_RADIUS_METERS));
}

/**
 * Smallest cell that keeps the whole circle under MAX_CELLS.
 */
export function chooseCellSizeMeters(radiusMeters) {
  for (const size of CELL_SIZE_CHOICES) {
    const cells = Math.PI * Math.pow(radiusMeters / size, 2);
    if (cells <= MAX_CELLS) return size;
  }
  return CELL_SIZE_CHOICES[CELL_SIZE_CHOICES.length - 1];
}

/**
 * Spreadsheet-style column letters: 0 -> A, 25 -> Z, 26 -> AA.
 * Cells get names people can say over the phone: "I'll take C4."
 */
export function columnLetter(index) {
  let n = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export function cellLabel(row, col) {
  return `${columnLetter(col)}${row + 1}`;
}

/**
 * Priority 1-10 for one cell.
 *
 * Base: distance from the last-seen point, 10 at the centre falling to 3
 * at the rim. Sightings pull priority toward themselves: a cell within
 * two cell-widths of a recent sighting is raised toward 10, scaled by
 * how fresh the sighting is. The newest information always outranks the
 * oldest assumption.
 */
export function cellPriority({ center, lastSeen, sightings = [], radiusMeters, cellSizeMeters, now = Date.now() }) {
  let priority = 3;
  if (lastSeen) {
    const d = distanceMeters(center, lastSeen);
    priority = Math.round(10 - Math.min(d / radiusMeters, 1) * 7);
  }

  for (const s of sightings) {
    if (!s || typeof s.lat !== 'number' || typeof s.lng !== 'number') continue;
    const age = s.at ? now - new Date(s.at).getTime() : 0;
    if (age > SIGHTING_PRIORITY_WINDOW_MS) continue;
    const d = distanceMeters(center, { lat: s.lat, lng: s.lng });
    if (d > cellSizeMeters * 2) continue;
    const freshness = 1 - Math.max(age, 0) / SIGHTING_PRIORITY_WINDOW_MS;
    const proximity = 1 - d / (cellSizeMeters * 2);
    const boosted = Math.round(7 + 3 * freshness * proximity);
    priority = Math.max(priority, boosted);
  }

  return Math.max(1, Math.min(10, priority));
}

/**
 * Generate the full cell set for a case.
 *
 * Returns { radiusMeters, cellSizeMeters, cells } where each cell carries
 * row, col, label, bounds, center and priority - exactly what a
 * GridCell row needs, minus the ids.
 */
export function generateGrid({ center, searchRadiusMiles, sightings = [], now = Date.now() }) {
  const radiusMeters = boardRadiusMeters(searchRadiusMiles);
  const cellSizeMeters = chooseCellSizeMeters(radiusMeters);

  const latStep = cellSizeMeters / METERS_PER_DEGREE_LAT;
  const lngStep = cellSizeMeters / metersPerDegreeLng(center.lat);
  const halfSpan = Math.ceil(radiusMeters / cellSizeMeters);

  const cells = [];
  // row 0 is the northernmost band so labels read like a map, top-down.
  for (let r = 0; r <= halfSpan * 2; r += 1) {
    for (let c = 0; c <= halfSpan * 2; c += 1) {
      const centerLat = center.lat + (halfSpan - r) * latStep;
      const centerLng = center.lng + (c - halfSpan) * lngStep;
      const cellCenter = { lat: centerLat, lng: centerLng };
      if (distanceMeters(cellCenter, center) > radiusMeters) continue;

      cells.push({
        row: r,
        col: c,
        label: cellLabel(r, c),
        centerLatitude: centerLat,
        centerLongitude: centerLng,
        northLat: centerLat + latStep / 2,
        southLat: centerLat - latStep / 2,
        eastLng: centerLng + lngStep / 2,
        westLng: centerLng - lngStep / 2,
        priority: cellPriority({
          center: cellCenter,
          lastSeen: center,
          sightings,
          radiusMeters,
          cellSizeMeters,
          now,
        }),
      });
    }
  }

  return { radiusMeters, cellSizeMeters, cells };
}

/**
 * How long a claim holds with no word from its holder. Someone claims a
 * block and goes home for dinner; the block must not stay theirs all
 * night. After this, anyone may take it and the sweep releases it.
 */
export const CLAIM_TTL_MS = 90 * 60 * 1000;

export function claimIsStale(claimedAt, now = Date.now()) {
  if (!claimedAt) return false;
  return now - new Date(claimedAt).getTime() > CLAIM_TTL_MS;
}
