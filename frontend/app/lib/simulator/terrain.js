/**
 * Terrain Module - OSM integration for realistic barriers
 *
 * Fetches and parses OpenStreetMap data to identify:
 * - Water (rivers, lakes, ponds) - impassable
 * - Major roads (highways, busy streets) - deterrent
 * - Fences and walls - barriers
 * - Buildings - obstacles
 * - Parks and wooded areas - hiding spots
 */

// Barrier types and their properties
export const BARRIER_TYPES = {
  WATER: {
    name: 'Water',
    passable: false,
    crossingProbability: 0, // Can't cross
    color: '#3b82f6',
  },
  HIGHWAY: {
    name: 'Major Road',
    passable: true,
    crossingProbability: 0.1, // Very unlikely to cross
    color: '#ef4444',
  },
  BUSY_ROAD: {
    name: 'Busy Road',
    passable: true,
    crossingProbability: 0.4,
    color: '#f97316',
  },
  FENCE: {
    name: 'Fence/Wall',
    passable: true,
    crossingProbability: 0.2, // Can sometimes get through
    color: '#78716c',
  },
  BUILDING: {
    name: 'Building',
    passable: false,
    crossingProbability: 0,
    color: '#6b7280',
  },
};

// Terrain zones that affect behavior
export const ZONE_TYPES = {
  PARK: {
    name: 'Park/Green Space',
    hidingBonus: 1.5,
    foragingBonus: 1.3,
    color: '#22c55e',
  },
  WOODS: {
    name: 'Wooded Area',
    hidingBonus: 2.0,
    foragingBonus: 1.0,
    color: '#166534',
  },
  COMMERCIAL: {
    name: 'Commercial Area',
    hidingBonus: 0.5,
    foragingBonus: 1.5, // Dumpsters, restaurants
    color: '#f59e0b',
  },
  RESIDENTIAL: {
    name: 'Residential',
    hidingBonus: 1.0,
    foragingBonus: 0.8,
    color: '#a855f7',
  },
};

/**
 * TerrainCache - Stores parsed OSM data for simulation area
 */
export class TerrainCache {
  constructor() {
    this.barriers = [];
    this.zones = [];
    this.bounds = null;
    this.loaded = false;
    this.loading = false;
    this.error = null;
  }

  /**
   * Load terrain data for the given bounds
   */
  async load(centerLat, centerLng, radiusMiles) {
    if (this.loading) return;
    this.loading = true;
    this.error = null;

    try {
      // Calculate bounding box
      const latOffset = radiusMiles / 69.0;
      const lngOffset = radiusMiles / (69.0 * Math.cos(centerLat * Math.PI / 180));

      this.bounds = {
        south: centerLat - latOffset,
        north: centerLat + latOffset,
        west: centerLng - lngOffset,
        east: centerLng + lngOffset,
      };

      // Fetch OSM data
      const data = await this.fetchOSMData(this.bounds);

      // Parse barriers and zones
      this.barriers = this.parseBarriers(data);
      this.zones = this.parseZones(data);

      this.loaded = true;
    } catch (error) {
      console.error('Failed to load terrain:', error);
      this.error = error.message;
      // Continue with empty terrain - simulations will still work
      this.barriers = [];
      this.zones = [];
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Fetch OSM data using Overpass API
   */
  async fetchOSMData(bounds) {
    const { south, west, north, east } = bounds;
    const bbox = `${south},${west},${north},${east}`;

    // Overpass QL query for relevant features
    const query = `
      [out:json][timeout:25];
      (
        // Water features
        way["natural"="water"](${bbox});
        way["waterway"](${bbox});
        relation["natural"="water"](${bbox});

        // Roads
        way["highway"~"motorway|trunk|primary"](${bbox});
        way["highway"~"secondary|tertiary"](${bbox});

        // Barriers
        way["barrier"](${bbox});
        way["landuse"="construction"](${bbox});

        // Buildings (simplified - just outlines)
        way["building"](${bbox});

        // Green spaces
        way["leisure"~"park|garden"](${bbox});
        way["landuse"~"forest|wood"](${bbox});
        way["natural"~"wood|scrub"](${bbox});

        // Land use
        way["landuse"~"commercial|retail"](${bbox});
        way["landuse"="residential"](${bbox});
      );
      out body;
      >;
      out skel qt;
    `;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.ok) {
        throw new Error(`OSM API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.warn('OSM fetch failed, using empty terrain:', error);
      return { elements: [] };
    }
  }

  /**
   * Parse barriers from OSM data
   */
  parseBarriers(data) {
    const barriers = [];
    const nodes = new Map();

    // Index nodes first
    for (const element of data.elements || []) {
      if (element.type === 'node') {
        nodes.set(element.id, { lat: element.lat, lon: element.lon });
      }
    }

    // Parse ways
    for (const element of data.elements || []) {
      if (element.type !== 'way') continue;

      const coords = (element.nodes || [])
        .map(nodeId => nodes.get(nodeId))
        .filter(Boolean);

      if (coords.length < 2) continue;

      const tags = element.tags || {};
      let barrierType = null;

      // Classify the way
      if (tags.natural === 'water' || tags.waterway) {
        barrierType = 'WATER';
      } else if (tags.highway === 'motorway' || tags.highway === 'trunk') {
        barrierType = 'HIGHWAY';
      } else if (tags.highway === 'primary' || tags.highway === 'secondary') {
        barrierType = 'BUSY_ROAD';
      } else if (tags.barrier || tags.landuse === 'construction') {
        barrierType = 'FENCE';
      } else if (tags.building) {
        barrierType = 'BUILDING';
      }

      if (barrierType) {
        barriers.push({
          id: element.id,
          type: barrierType,
          coords: coords,
          segments: this.createSegments(coords),
        });
      }
    }

    return barriers;
  }

  /**
   * Parse zones from OSM data
   */
  parseZones(data) {
    const zones = [];
    const nodes = new Map();

    // Index nodes
    for (const element of data.elements || []) {
      if (element.type === 'node') {
        nodes.set(element.id, { lat: element.lat, lon: element.lon });
      }
    }

    // Parse ways as zones
    for (const element of data.elements || []) {
      if (element.type !== 'way') continue;

      const coords = (element.nodes || [])
        .map(nodeId => nodes.get(nodeId))
        .filter(Boolean);

      if (coords.length < 3) continue;

      const tags = element.tags || {};
      let zoneType = null;

      if (tags.leisure === 'park' || tags.leisure === 'garden') {
        zoneType = 'PARK';
      } else if (tags.landuse === 'forest' || tags.natural === 'wood' || tags.natural === 'scrub') {
        zoneType = 'WOODS';
      } else if (tags.landuse === 'commercial' || tags.landuse === 'retail') {
        zoneType = 'COMMERCIAL';
      } else if (tags.landuse === 'residential') {
        zoneType = 'RESIDENTIAL';
      }

      if (zoneType) {
        zones.push({
          id: element.id,
          type: zoneType,
          coords: coords,
          bounds: this.calculateBounds(coords),
        });
      }
    }

    return zones;
  }

  /**
   * Create line segments from coordinates for intersection testing
   */
  createSegments(coords) {
    const segments = [];
    for (let i = 0; i < coords.length - 1; i++) {
      segments.push({
        lat1: coords[i].lat,
        lng1: coords[i].lon,
        lat2: coords[i + 1].lat,
        lng2: coords[i + 1].lon,
      });
    }
    return segments;
  }

  /**
   * Calculate bounding box for a polygon
   */
  calculateBounds(coords) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    for (const coord of coords) {
      minLat = Math.min(minLat, coord.lat);
      maxLat = Math.max(maxLat, coord.lat);
      minLng = Math.min(minLng, coord.lon);
      maxLng = Math.max(maxLng, coord.lon);
    }

    return { minLat, maxLat, minLng, maxLng };
  }

  /**
   * Check if a movement from (lat1, lng1) to (lat2, lng2) crosses any barrier
   * Returns: { blocked: boolean, barrierType: string | null, canAttempt: boolean }
   */
  checkMovement(lat1, lng1, lat2, lng2, random) {
    if (!this.loaded || this.barriers.length === 0) {
      return { blocked: false, barrierType: null, canAttempt: true };
    }

    for (const barrier of this.barriers) {
      for (const segment of barrier.segments) {
        if (this.segmentsIntersect(
          lat1, lng1, lat2, lng2,
          segment.lat1, segment.lng1, segment.lat2, segment.lng2
        )) {
          const barrierInfo = BARRIER_TYPES[barrier.type];

          // Check if can cross
          if (!barrierInfo.passable) {
            return {
              blocked: true,
              barrierType: barrier.type,
              canAttempt: false,
            };
          }

          // Probabilistic crossing
          if (random() > barrierInfo.crossingProbability) {
            return {
              blocked: true,
              barrierType: barrier.type,
              canAttempt: true, // Can try different direction
            };
          }
        }
      }
    }

    return { blocked: false, barrierType: null, canAttempt: true };
  }

  /**
   * Check if two line segments intersect
   */
  segmentsIntersect(lat1, lng1, lat2, lng2, lat3, lng3, lat4, lng4) {
    const d1 = this.direction(lat3, lng3, lat4, lng4, lat1, lng1);
    const d2 = this.direction(lat3, lng3, lat4, lng4, lat2, lng2);
    const d3 = this.direction(lat1, lng1, lat2, lng2, lat3, lng3);
    const d4 = this.direction(lat1, lng1, lat2, lng2, lat4, lng4);

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }

    return false;
  }

  /**
   * Helper for intersection test
   */
  direction(lat1, lng1, lat2, lng2, lat3, lng3) {
    return (lat3 - lat1) * (lng2 - lng1) - (lat2 - lat1) * (lng3 - lng1);
  }

  /**
   * Get the zone type at a given location
   * Returns: { zoneType: string | null, modifiers: object }
   */
  getZoneAt(lat, lng) {
    if (!this.loaded || this.zones.length === 0) {
      return { zoneType: null, modifiers: { hidingBonus: 1.0, foragingBonus: 1.0 } };
    }

    for (const zone of this.zones) {
      // Quick bounds check first
      if (lat < zone.bounds.minLat || lat > zone.bounds.maxLat ||
          lng < zone.bounds.minLng || lng > zone.bounds.maxLng) {
        continue;
      }

      // Point-in-polygon test
      if (this.pointInPolygon(lat, lng, zone.coords)) {
        const zoneInfo = ZONE_TYPES[zone.type];
        return {
          zoneType: zone.type,
          modifiers: {
            hidingBonus: zoneInfo.hidingBonus,
            foragingBonus: zoneInfo.foragingBonus,
          },
        };
      }
    }

    return { zoneType: null, modifiers: { hidingBonus: 1.0, foragingBonus: 1.0 } };
  }

  /**
   * Ray casting point-in-polygon test
   */
  pointInPolygon(lat, lng, coords) {
    let inside = false;
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const xi = coords[i].lat, yi = coords[i].lon;
      const xj = coords[j].lat, yj = coords[j].lon;

      if (((yi > lng) !== (yj > lng)) &&
          (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  /**
   * Get all barriers for map display
   */
  getBarriersForDisplay() {
    return this.barriers.map(b => ({
      type: b.type,
      coords: b.coords.map(c => [c.lat, c.lon]),
      color: BARRIER_TYPES[b.type]?.color || '#888',
      name: BARRIER_TYPES[b.type]?.name || b.type,
    }));
  }

  /**
   * Get all zones for map display
   */
  getZonesForDisplay() {
    return this.zones.map(z => ({
      type: z.type,
      coords: z.coords.map(c => [c.lat, c.lon]),
      color: ZONE_TYPES[z.type]?.color || '#888',
      name: ZONE_TYPES[z.type]?.name || z.type,
    }));
  }
}

/**
 * Singleton terrain cache instance
 */
let globalTerrainCache = null;

export function getTerrainCache() {
  if (!globalTerrainCache) {
    globalTerrainCache = new TerrainCache();
  }
  return globalTerrainCache;
}

export function resetTerrainCache() {
  globalTerrainCache = null;
}
