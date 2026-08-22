/**
 * The search grid's geometry and rules.
 *
 * SearchGrid and GridCell sat in the schema with zero rows and zero
 * consumers; this pins the math that finally fills them. Everything here
 * is pure - the routes own Prisma.
 */

const {
  milesToMeters,
  distanceMeters,
  boardRadiusMeters,
  chooseCellSizeMeters,
  columnLetter,
  cellLabel,
  cellPriority,
  generateGrid,
  claimIsStale,
  CLAIM_TTL_MS,
  MAX_CELLS,
  MAX_BOARD_RADIUS_METERS,
} = require('@/app/lib/searchGrid');

const AUSTIN = { lat: 30.2672, lng: -97.7431 };

describe('board sizing', () => {
  it('caps the board at walking scale, whatever the alert radius says', () => {
    // searchRadius defaults to 5 MILES - who to notify, not where feet go.
    expect(boardRadiusMeters(5)).toBe(MAX_BOARD_RADIUS_METERS);
    expect(boardRadiusMeters(0.4)).toBeCloseTo(milesToMeters(0.4), 0);
    expect(boardRadiusMeters(0.1)).toBe(400);
  });

  it('never produces an unmanageable number of cells', () => {
    for (const miles of [0.25, 0.5, 1, 2, 5, 50]) {
      const { cells } = generateGrid({ center: AUSTIN, searchRadiusMiles: miles });
      expect(cells.length).toBeGreaterThan(10);
      expect(cells.length).toBeLessThanOrEqual(MAX_CELLS);
    }
  });

  it('picks the smallest cell that fits the cap', () => {
    // Small board: fine-grained cells. Max board: bigger walks.
    expect(chooseCellSizeMeters(400)).toBe(100);
    const maxSize = chooseCellSizeMeters(MAX_BOARD_RADIUS_METERS);
    expect(Math.PI * Math.pow(MAX_BOARD_RADIUS_METERS / maxSize, 2)).toBeLessThanOrEqual(MAX_CELLS);
  });
});

describe('cell identity', () => {
  it('labels cells like a spreadsheet, sayable over the phone', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
    expect(cellLabel(3, 2)).toBe('C4');
  });

  it('keeps row/col unique across the board', () => {
    const { cells } = generateGrid({ center: AUSTIN, searchRadiusMiles: 1 });
    const keys = new Set(cells.map((c) => `${c.row}:${c.col}`));
    expect(keys.size).toBe(cells.length);
    const labels = new Set(cells.map((c) => c.label));
    expect(labels.size).toBe(cells.length);
  });

  it('builds bounds that actually contain the center', () => {
    const { cells } = generateGrid({ center: AUSTIN, searchRadiusMiles: 0.5 });
    for (const c of cells) {
      expect(c.northLat).toBeGreaterThan(c.centerLatitude);
      expect(c.southLat).toBeLessThan(c.centerLatitude);
      expect(c.eastLng).toBeGreaterThan(c.centerLongitude);
      expect(c.westLng).toBeLessThan(c.centerLongitude);
    }
  });
});

describe('priority - why the map can say "start here"', () => {
  it('is highest at the last-seen point and falls with distance', () => {
    const { cells } = generateGrid({ center: AUSTIN, searchRadiusMiles: 1 });
    const byDistance = [...cells].sort(
      (a, b) =>
        distanceMeters({ lat: a.centerLatitude, lng: a.centerLongitude }, AUSTIN) -
        distanceMeters({ lat: b.centerLatitude, lng: b.centerLongitude }, AUSTIN)
    );
    expect(byDistance[0].priority).toBe(10);
    expect(byDistance[byDistance.length - 1].priority).toBeLessThanOrEqual(4);
  });

  it('pulls priority toward a fresh sighting', () => {
    const rim = { lat: AUSTIN.lat + 0.012, lng: AUSTIN.lng };
    const quiet = cellPriority({
      center: rim, lastSeen: AUSTIN, sightings: [], radiusMeters: 1600, cellSizeMeters: 150,
    });
    const loud = cellPriority({
      center: rim, lastSeen: AUSTIN,
      sightings: [{ lat: rim.lat, lng: rim.lng, at: new Date().toISOString() }],
      radiusMeters: 1600, cellSizeMeters: 150,
    });
    expect(loud).toBe(10);
    expect(loud).toBeGreaterThan(quiet);
  });

  it('lets a stale sighting fade back out', () => {
    const rim = { lat: AUSTIN.lat + 0.012, lng: AUSTIN.lng };
    const now = Date.now();
    const old = cellPriority({
      center: rim, lastSeen: AUSTIN,
      sightings: [{ lat: rim.lat, lng: rim.lng, at: new Date(now - 80 * 3600_000).toISOString() }],
      radiusMeters: 1600, cellSizeMeters: 150, now,
    });
    const fresh = cellPriority({
      center: rim, lastSeen: AUSTIN,
      sightings: [{ lat: rim.lat, lng: rim.lng, at: new Date(now - 3600_000).toISOString() }],
      radiusMeters: 1600, cellSizeMeters: 150, now,
    });
    expect(fresh).toBeGreaterThan(old);
  });
});

describe('claims go stale', () => {
  it('holds inside the TTL, releases after it', () => {
    const now = Date.now();
    expect(claimIsStale(new Date(now - CLAIM_TTL_MS + 60_000), now)).toBe(false);
    expect(claimIsStale(new Date(now - CLAIM_TTL_MS - 60_000), now)).toBe(true);
    expect(claimIsStale(null, now)).toBe(false);
  });
});
