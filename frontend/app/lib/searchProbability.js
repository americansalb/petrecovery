/**
 * Search Probability Zone Calculator
 *
 * Calculates probability zones for lost pet searches based on research data.
 * Uses OBJECTIVE factors only: species, size, time elapsed, age.
 *
 * Total probability sums to 90% (acknowledging 10% uncertainty).
 * Zone distribution: HIGH 75%, MEDIUM 20%, LOW 4%, EXTENDED 1%
 *
 * References:
 * - ASPCA Lost Pet Research
 * - Missing Animal Response Network studies
 * - University of Queensland pet displacement behavior research
 */

// Base radius in miles by species and size
const DOG_BASE_RADIUS = {
  TINY: 0.3,    // Under 10 lbs - stays very close
  SMALL: 0.5,   // 10-25 lbs
  MEDIUM: 1.0,  // 25-60 lbs - typical wandering range
  LARGE: 1.5,   // 60-90 lbs
  GIANT: 2.5,   // Over 90 lbs - can cover significant ground
};

const CAT_BASE_RADIUS = {
  indoor: 0.15,  // Indoor-only cats typically hide very close
  outdoor: 0.4,  // Outdoor-access cats have larger territory
};

// Default base radius when no size/indoor info available
const DEFAULT_BASE_RADIUS = {
  DOG: 1.0,
  CAT: 0.25,
  BIRD: 2.0,    // Birds can fly significant distances
  OTHER: 0.5,
};

// Time multipliers - how radius expands over time
const TIME_MULTIPLIERS = {
  'less_than_hour': 1.0,     // Just lost - base radius
  '1_to_6_hours': 1.3,       // Moving but not far
  '6_to_24_hours': 1.8,      // Full day of movement
  '1_to_3_days': 2.5,        // Multiple days
  '3_to_7_days': 3.5,        // Week-long search
  '1_to_2_weeks': 4.5,       // Extended period
  'more_than_2_weeks': 6.0,  // Long-term missing
};

// Age modifiers for mobility
const AGE_MODIFIERS = {
  puppy: 0.6,    // Young animals stay closer
  young: 0.9,    // Slightly reduced range
  adult: 1.0,    // Normal range
  senior: 0.7,   // Older animals don't travel as far
};

// Zone probability distribution (sums to 90%)
const ZONE_PROBABILITIES = {
  HIGH: 0.675,      // 67.5% of 90% total
  MEDIUM: 0.18,     // 18% of 90% total
  LOW: 0.036,       // 3.6% of 90% total
  EXTENDED: 0.009,  // 0.9% of 90% total
};

// Zone radius multipliers (relative to base radius)
const ZONE_MULTIPLIERS = {
  HIGH: 1.0,        // Base radius
  MEDIUM: 2.0,      // 2x base
  LOW: 4.0,         // 4x base
  EXTENDED: 8.0,    // 8x base (edge of search area)
};

// Maximum search radius cap (miles)
const MAX_SEARCH_RADIUS = 25;

/**
 * Calculate search probability zones for a lost pet
 *
 * @param {Object} params - Pet and case parameters
 * @param {string} params.species - PetSpecies: DOG, CAT, BIRD, OTHER
 * @param {string} [params.size] - PetSize: TINY, SMALL, MEDIUM, LARGE, GIANT
 * @param {boolean} [params.isIndoorCat] - For cats: true = indoor only
 * @param {string} [params.timeElapsed] - Time since pet went missing
 * @param {string} [params.age] - Pet age category: puppy, young, adult, senior
 * @param {number[]} params.lastSeenLocation - [lat, lng] of last sighting
 * @returns {Object} Probability zones with radii and probabilities
 */
export function calculateProbabilityZones({
  species,
  size,
  isIndoorCat,
  timeElapsed,
  age,
  lastSeenLocation,
}) {
  // Normalize species
  const normalizedSpecies = (species || 'OTHER').toUpperCase();

  // Step 1: Determine base radius
  let baseRadius;

  if (normalizedSpecies === 'DOG') {
    baseRadius = DOG_BASE_RADIUS[size] || DEFAULT_BASE_RADIUS.DOG;
  } else if (normalizedSpecies === 'CAT') {
    if (isIndoorCat === true) {
      baseRadius = CAT_BASE_RADIUS.indoor;
    } else if (isIndoorCat === false) {
      baseRadius = CAT_BASE_RADIUS.outdoor;
    } else {
      baseRadius = DEFAULT_BASE_RADIUS.CAT;
    }
  } else {
    baseRadius = DEFAULT_BASE_RADIUS[normalizedSpecies] || DEFAULT_BASE_RADIUS.OTHER;
  }

  // Step 2: Apply time multiplier
  const timeMultiplier = TIME_MULTIPLIERS[timeElapsed] || TIME_MULTIPLIERS['6_to_24_hours'];
  let adjustedRadius = baseRadius * timeMultiplier;

  // Step 3: Apply age modifier (if provided)
  if (age) {
    const ageMod = AGE_MODIFIERS[age] || AGE_MODIFIERS.adult;
    adjustedRadius *= ageMod;
  }

  // Step 4: Generate zones
  const zones = Object.entries(ZONE_MULTIPLIERS).map(([zoneName, multiplier]) => {
    const radius = Math.min(adjustedRadius * multiplier, MAX_SEARCH_RADIUS);
    const probability = ZONE_PROBABILITIES[zoneName];

    return {
      name: zoneName,
      radius,
      probability,
      probabilityPercent: Math.round(probability * 100 * 10) / 10, // e.g., 67.5
      color: getZoneColor(zoneName),
      fillOpacity: getZoneFillOpacity(zoneName),
    };
  });

  // Calculate the confidence level based on available data
  let confidenceLevel = 'basic';
  let confidenceFactors = ['species'];

  if (normalizedSpecies === 'DOG' && size) {
    confidenceLevel = 'good';
    confidenceFactors.push('size');
  } else if (normalizedSpecies === 'CAT' && isIndoorCat !== undefined && isIndoorCat !== null) {
    confidenceLevel = 'good';
    confidenceFactors.push('indoor/outdoor status');
  }

  if (timeElapsed) {
    confidenceFactors.push('time elapsed');
    if (confidenceLevel === 'good') confidenceLevel = 'high';
  }

  if (age) {
    confidenceFactors.push('age');
    if (confidenceLevel === 'high') confidenceLevel = 'very high';
  }

  return {
    center: lastSeenLocation,
    zones,
    baseRadius,
    adjustedRadius,
    totalProbability: 0.9, // 90% - acknowledging 10% unknown
    confidenceLevel,
    confidenceFactors,
    parameters: {
      species: normalizedSpecies,
      size: size || null,
      isIndoorCat: normalizedSpecies === 'CAT' ? isIndoorCat : null,
      timeElapsed: timeElapsed || null,
      age: age || null,
    },
  };
}

/**
 * Get zone color for map display
 */
function getZoneColor(zoneName) {
  const colors = {
    HIGH: '#ef4444',     // Red - highest probability
    MEDIUM: '#f97316',   // Orange
    LOW: '#eab308',      // Yellow
    EXTENDED: '#6366f1', // Indigo - edge of search
  };
  return colors[zoneName] || '#6b7280';
}

/**
 * Get zone fill opacity for map display
 */
function getZoneFillOpacity(zoneName) {
  // Very subtle opacities - visible but not overwhelming
  const opacities = {
    HIGH: 0.10,      // 10% - subtle red tint
    MEDIUM: 0.06,    // 6% - barely visible orange
    LOW: 0.03,       // 3% - very faint yellow
    EXTENDED: 0.015, // 1.5% - almost invisible indigo edge
  };
  return opacities[zoneName] || 0.05;
}

/**
 * Calculate points multiplier for a location based on zone
 *
 * @param {number[]} searchLocation - [lat, lng] of search activity
 * @param {Object} probabilityData - Result from calculateProbabilityZones
 * @returns {number} Points multiplier (1.0 - 4.0)
 */
export function getPointsMultiplier(searchLocation, probabilityData) {
  if (!probabilityData?.center || !searchLocation) return 1.0;

  const distance = calculateDistanceMiles(
    probabilityData.center[0],
    probabilityData.center[1],
    searchLocation[0],
    searchLocation[1]
  );

  // Find which zone the location falls into
  for (const zone of probabilityData.zones) {
    if (distance <= zone.radius) {
      // Higher multiplier for higher probability zones
      const multipliers = {
        HIGH: 4.0,
        MEDIUM: 2.5,
        LOW: 1.5,
        EXTENDED: 1.0,
      };
      return multipliers[zone.name] || 1.0;
    }
  }

  // Outside all zones - no bonus
  return 0.5; // Reduced points for searching outside probability zones
}

/**
 * Calculate distance between two points in miles
 */
function calculateDistanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format zone info for display
 */
export function formatZoneDescription(zone) {
  const radiusText = zone.radius < 1
    ? `${Math.round(zone.radius * 5280)} feet`
    : `${zone.radius.toFixed(1)} miles`;

  return `${zone.name}: ${zone.probabilityPercent}% chance within ${radiusText}`;
}

/**
 * Get search priority message based on zones
 */
export function getSearchPriorityMessage(probabilityData) {
  const highZone = probabilityData.zones.find(z => z.name === 'HIGH');
  if (!highZone) return 'Focus search near last seen location';

  const radiusText = highZone.radius < 1
    ? `${Math.round(highZone.radius * 5280)} feet`
    : `${highZone.radius.toFixed(1)} miles`;

  return `Priority: Search within ${radiusText} of last sighting (${highZone.probabilityPercent}% probability)`;
}

export default {
  calculateProbabilityZones,
  getPointsMultiplier,
  formatZoneDescription,
  getSearchPriorityMessage,
};
