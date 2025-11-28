/**
 * AI Route Planning for Search Operations
 *
 * Optimizes search routes based on sightings, terrain, and probability.
 */

import { calculateDistance } from '@/app/lib/geofence';

/**
 * Generate optimized search route from waypoints
 */
export function optimizeSearchRoute(waypoints, startLocation) {
  if (!waypoints.length) return [];

  // Use nearest neighbor algorithm for basic optimization
  const route = [];
  const remaining = [...waypoints];
  let current = startLocation;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = calculateDistance(
        current.lat, current.lng,
        remaining[i].lat, remaining[i].lng
      );

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    const nearest = remaining.splice(nearestIdx, 1)[0];
    route.push({
      ...nearest,
      distanceFromPrevious: nearestDist,
    });
    current = { lat: nearest.lat, lng: nearest.lng };
  }

  return route;
}

/**
 * Calculate search probability zones based on sightings
 */
export function calculateProbabilityZones(sightings, lastSeenLocation, hoursElapsed) {
  const zones = [];

  // Zone 1: High probability - near recent sightings
  const recentSightings = sightings.filter((s) => {
    const hoursAgo = (Date.now() - new Date(s.spottedAt).getTime()) / 3600000;
    return hoursAgo < 24;
  });

  if (recentSightings.length > 0) {
    const centroid = calculateCentroid(recentSightings);
    zones.push({
      type: 'high_probability',
      center: centroid,
      radiusMiles: 0.5,
      priority: 1,
      reason: 'Recent sightings cluster',
    });
  }

  // Zone 2: Medium probability - expanded from last known location
  const baseRadius = calculateSearchRadius(hoursElapsed);
  zones.push({
    type: 'medium_probability',
    center: lastSeenLocation,
    radiusMiles: baseRadius,
    priority: 2,
    reason: 'Expected travel distance',
  });

  // Zone 3: Low probability - outer perimeter
  zones.push({
    type: 'low_probability',
    center: lastSeenLocation,
    radiusMiles: baseRadius * 2,
    priority: 3,
    reason: 'Extended search area',
  });

  return zones;
}

/**
 * Calculate expected search radius based on time elapsed
 * Assumes average pet travel distance of 0.5-2 miles per day
 */
function calculateSearchRadius(hoursElapsed) {
  const days = hoursElapsed / 24;
  const minRadius = 0.25; // Miles
  const maxDailyTravel = 2; // Miles per day

  return Math.max(minRadius, Math.min(days * maxDailyTravel, 15));
}

/**
 * Calculate centroid of sighting locations
 */
function calculateCentroid(sightings) {
  const n = sightings.length;
  if (n === 0) return null;

  const sum = sightings.reduce(
    (acc, s) => ({
      lat: acc.lat + (s.latitude || s.lat),
      lng: acc.lng + (s.longitude || s.lng),
    }),
    { lat: 0, lng: 0 }
  );

  return { lat: sum.lat / n, lng: sum.lng / n };
}

/**
 * Generate search grid for systematic coverage
 */
export function generateSearchGrid(center, radiusMiles, cellSizeMiles = 0.1) {
  const grid = [];
  const cellsPerSide = Math.ceil((radiusMiles * 2) / cellSizeMiles);
  const latDelta = cellSizeMiles / 69; // Approximate degrees per mile
  const lngDelta = cellSizeMiles / (69 * Math.cos(center.lat * Math.PI / 180));

  const startLat = center.lat - radiusMiles / 69;
  const startLng = center.lng - (radiusMiles / 69) / Math.cos(center.lat * Math.PI / 180);

  for (let i = 0; i < cellsPerSide; i++) {
    for (let j = 0; j < cellsPerSide; j++) {
      const cellCenter = {
        lat: startLat + i * latDelta + latDelta / 2,
        lng: startLng + j * lngDelta + lngDelta / 2,
      };

      const distFromCenter = calculateDistance(
        center.lat, center.lng,
        cellCenter.lat, cellCenter.lng
      );

      if (distFromCenter <= radiusMiles) {
        grid.push({
          id: `cell-${i}-${j}`,
          center: cellCenter,
          bounds: {
            north: startLat + (i + 1) * latDelta,
            south: startLat + i * latDelta,
            east: startLng + (j + 1) * lngDelta,
            west: startLng + j * lngDelta,
          },
          searched: false,
          priority: distFromCenter <= radiusMiles / 2 ? 'high' : 'normal',
        });
      }
    }
  }

  return grid;
}

/**
 * Suggest next search areas based on coverage
 */
export function suggestNextSearchAreas(grid, searchedAreas) {
  // Mark searched cells
  const searchedSet = new Set(searchedAreas.map((a) => a.cellId));
  const unsearched = grid.filter((cell) => !searchedSet.has(cell.id));

  // Prioritize high priority cells and cells adjacent to searched areas
  return unsearched
    .map((cell) => {
      let score = cell.priority === 'high' ? 2 : 1;

      // Boost cells adjacent to searched areas
      const isAdjacent = searchedAreas.some((searched) => {
        const dist = calculateDistance(
          cell.center.lat, cell.center.lng,
          searched.lat, searched.lng
        );
        return dist < 0.2; // Within 0.2 miles
      });

      if (isAdjacent) score += 1;

      return { ...cell, score };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Calculate optimal distribution of searchers
 */
export function distributeSearchers(searchers, zones) {
  const distribution = [];

  // Sort zones by priority
  const sortedZones = [...zones].sort((a, b) => a.priority - b.priority);

  // Distribute searchers proportionally
  const totalPriority = sortedZones.reduce((sum, z) => sum + (4 - z.priority), 0);

  let assigned = 0;
  for (const zone of sortedZones) {
    const weight = (4 - zone.priority) / totalPriority;
    const count = Math.max(1, Math.round(searchers.length * weight));
    const zoneSearchers = searchers.slice(assigned, assigned + count);

    distribution.push({
      zone,
      searchers: zoneSearchers,
      coverage: zone.radiusMiles / Math.max(zoneSearchers.length, 1),
    });

    assigned += count;
    if (assigned >= searchers.length) break;
  }

  return distribution;
}

/**
 * Estimate time to search an area
 */
export function estimateSearchTime(areaSqMiles, numSearchers, searchSpeedMph = 2) {
  const coveragePerSearcher = areaSqMiles / numSearchers;
  const hoursNeeded = coveragePerSearcher / searchSpeedMph;
  return Math.ceil(hoursNeeded * 60); // Return minutes
}

/**
 * Generate directions between waypoints
 */
export function generateDirections(route) {
  return route.map((waypoint, idx) => {
    if (idx === 0) {
      return {
        ...waypoint,
        instruction: `Start at ${waypoint.address || 'starting point'}`,
      };
    }

    const prev = route[idx - 1];
    const bearing = calculateBearing(prev.lat, prev.lng, waypoint.lat, waypoint.lng);
    const direction = bearingToDirection(bearing);

    return {
      ...waypoint,
      instruction: `Head ${direction} to ${waypoint.address || 'next point'} (${waypoint.distanceFromPrevious?.toFixed(2)} mi)`,
    };
  });
}

function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

function bearingToDirection(bearing) {
  const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}
