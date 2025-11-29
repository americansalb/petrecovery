/**
 * Heat Map Generation for Sightings and Search Coverage
 *
 * Generates heat map data for visualization with Mapbox/Google Maps
 */

/**
 * Generate heat map data from sightings
 */
export function generateSightingsHeatmap(sightings, options = {}) {
  const { weightByRecency = true, weightByCertainty = true, maxAge = 7 } = options;
  const now = Date.now();
  const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;

  return sightings
    .filter(s => s.latitude && s.longitude)
    .map(sighting => {
      let weight = 1;

      // Weight by recency (more recent = higher weight)
      if (weightByRecency) {
        const age = now - new Date(sighting.createdAt || sighting.sightedAt).getTime();
        const recencyWeight = Math.max(0, 1 - age / maxAgeMs);
        weight *= recencyWeight;
      }

      // Weight by certainty level
      if (weightByCertainty && sighting.certaintyLevel) {
        weight *= sighting.certaintyLevel / 5;
      }

      // Weight by verification status
      if (sighting.isVerified) {
        weight *= 1.5;
      }

      return {
        lat: sighting.latitude,
        lng: sighting.longitude,
        weight: Math.min(1, Math.max(0.1, weight)),
        id: sighting.id,
        timestamp: sighting.createdAt || sighting.sightedAt,
      };
    });
}

/**
 * Generate search coverage heat map from search areas
 */
export function generateSearchCoverageHeatmap(searchAreas) {
  const points = [];

  for (const area of searchAreas) {
    if (!area.geometry) continue;

    try {
      const geometry = typeof area.geometry === 'string'
        ? JSON.parse(area.geometry)
        : area.geometry;

      // Extract points from polygon
      const coordinates = geometry.coordinates?.[0] || geometry;

      for (const coord of coordinates) {
        points.push({
          lat: coord[1],
          lng: coord[0],
          weight: 0.8,
          searched: true,
        });
      }

      // Add centroid with higher weight
      const centroid = calculateCentroid(coordinates);
      if (centroid) {
        points.push({
          ...centroid,
          weight: 1,
          acreage: area.acreage,
        });
      }
    } catch (e) {
      console.error('Error parsing search area geometry:', e);
    }
  }

  return points;
}

/**
 * Calculate centroid of polygon
 */
function calculateCentroid(coordinates) {
  if (!coordinates || coordinates.length === 0) return null;

  let sumLat = 0;
  let sumLng = 0;

  for (const coord of coordinates) {
    sumLng += coord[0];
    sumLat += coord[1];
  }

  return {
    lat: sumLat / coordinates.length,
    lng: sumLng / coordinates.length,
  };
}

/**
 * Generate probability zones based on sightings and time
 */
export function generateProbabilityZones(lastSeenLocation, sightings, hoursElapsed) {
  const zones = [];

  // High probability zone (core search area)
  const baseRadius = calculateSearchRadius(hoursElapsed, 'high');
  zones.push({
    type: 'high',
    center: lastSeenLocation,
    radius: baseRadius,
    color: '#ef4444', // Red
    opacity: 0.3,
    label: 'High Priority',
  });

  // Medium probability zone
  zones.push({
    type: 'medium',
    center: lastSeenLocation,
    radius: baseRadius * 2,
    color: '#f97316', // Orange
    opacity: 0.2,
    label: 'Medium Priority',
  });

  // Low probability zone
  zones.push({
    type: 'low',
    center: lastSeenLocation,
    radius: baseRadius * 3.5,
    color: '#eab308', // Yellow
    opacity: 0.1,
    label: 'Extended Search',
  });

  // Adjust zones based on sightings
  if (sightings && sightings.length > 0) {
    // Find most recent verified sighting
    const recentSighting = sightings
      .filter(s => s.isVerified)
      .sort((a, b) => new Date(b.sightedAt) - new Date(a.sightedAt))[0];

    if (recentSighting) {
      // Add spotlight zone around recent sighting
      zones.push({
        type: 'spotlight',
        center: { lat: recentSighting.latitude, lng: recentSighting.longitude },
        radius: 0.5, // 0.5 miles
        color: '#22c55e', // Green
        opacity: 0.4,
        label: 'Recent Sighting',
      });
    }
  }

  return zones;
}

/**
 * Calculate recommended search radius based on time elapsed
 */
function calculateSearchRadius(hoursElapsed, zoneType = 'medium') {
  // Base radius in miles
  const baseRadii = {
    high: 0.5,
    medium: 1,
    low: 2,
  };

  let radius = baseRadii[zoneType] || 1;

  // Expand radius based on time
  if (hoursElapsed <= 2) {
    radius *= 1;
  } else if (hoursElapsed <= 6) {
    radius *= 1.5;
  } else if (hoursElapsed <= 24) {
    radius *= 2;
  } else if (hoursElapsed <= 48) {
    radius *= 3;
  } else if (hoursElapsed <= 72) {
    radius *= 4;
  } else {
    radius *= 5;
  }

  return radius;
}

/**
 * Generate grid cells for systematic search
 */
export function generateSearchGrid(center, radiusMiles, cellSizeMiles = 0.1) {
  const cells = [];
  const cellsPerSide = Math.ceil(radiusMiles * 2 / cellSizeMiles);

  // Convert miles to degrees (approximate)
  const latDegPerMile = 1 / 69;
  const lngDegPerMile = 1 / (69 * Math.cos(center.lat * Math.PI / 180));

  const cellLatSize = cellSizeMiles * latDegPerMile;
  const cellLngSize = cellSizeMiles * lngDegPerMile;

  const startLat = center.lat - (radiusMiles * latDegPerMile);
  const startLng = center.lng - (radiusMiles * lngDegPerMile);

  for (let row = 0; row < cellsPerSide; row++) {
    for (let col = 0; col < cellsPerSide; col++) {
      const cellLat = startLat + (row * cellLatSize);
      const cellLng = startLng + (col * cellLngSize);

      // Check if cell is within radius
      const distance = haversineDistance(
        center.lat, center.lng,
        cellLat + cellLatSize / 2, cellLng + cellLngSize / 2
      );

      if (distance <= radiusMiles) {
        cells.push({
          id: `${row}-${col}`,
          bounds: {
            north: cellLat + cellLatSize,
            south: cellLat,
            east: cellLng + cellLngSize,
            west: cellLng,
          },
          center: {
            lat: cellLat + cellLatSize / 2,
            lng: cellLng + cellLngSize / 2,
          },
          distance: Math.round(distance * 100) / 100,
          searched: false,
          priority: getPriority(distance, radiusMiles),
        });
      }
    }
  }

  // Sort by priority (closer = higher priority)
  return cells.sort((a, b) => a.distance - b.distance);
}

function getPriority(distance, maxRadius) {
  const ratio = distance / maxRadius;
  if (ratio < 0.33) return 'high';
  if (ratio < 0.66) return 'medium';
  return 'low';
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate coverage statistics
 */
export function calculateCoverageStats(searchAreas, totalGridCells) {
  const totalAcreage = searchAreas.reduce((sum, area) => sum + (area.acreage || 0), 0);
  const searchedCells = new Set();

  for (const area of searchAreas) {
    if (area.cellId) {
      searchedCells.add(area.cellId);
    }
  }

  return {
    totalAcreage: Math.round(totalAcreage * 10) / 10,
    areasSearched: searchAreas.length,
    coveragePercent: totalGridCells > 0
      ? Math.round((searchedCells.size / totalGridCells) * 100)
      : 0,
    uniqueCells: searchedCells.size,
  };
}

/**
 * Convert search areas to GeoJSON for map rendering
 */
export function toGeoJSON(searchAreas) {
  return {
    type: 'FeatureCollection',
    features: searchAreas.map(area => {
      let geometry;

      try {
        geometry = typeof area.geometry === 'string'
          ? JSON.parse(area.geometry)
          : area.geometry;
      } catch {
        return null;
      }

      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: geometry.coordinates || [geometry],
        },
        properties: {
          id: area.id,
          searchedBy: area.markedBy?.firstName || 'Unknown',
          acreage: area.acreage,
          timestamp: area.markedAt,
          potentialSpotting: area.potentialSpotting,
          notes: area.notes,
        },
      };
    }).filter(Boolean),
  };
}
