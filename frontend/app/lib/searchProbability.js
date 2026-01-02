/**
 * Search Probability Zone Calculator
 *
 * Calculates probability zones using LOG-NORMAL distributions fitted to research data.
 *
 * DATA SOURCES:
 * - Dogs: Dallas Animal Services Study (2021, PMC8185155) + Lost Pet Research
 *   - 42% found ≤400 ft, 70% found ≤1 mile, 85% found ≤5 miles
 *   - Fitted: μ = 6.71, σ = 3.55 (distance in feet)
 *
 * - Cats: Queensland Study (2018, PMC5789300)
 *   - Indoor-only (n=164): median 39m, 75th percentile 137m
 *     Fitted: μ = 3.66, σ = 1.87 (distance in meters)
 *   - Indoor-outdoor (n=150): median 300m, 75th percentile 1609m
 *     Fitted: μ = 5.70, σ = 2.49 (distance in meters)
 *
 * ZONE DEFINITIONS (cumulative probability):
 * - HIGH: 0% to 50% (where pet is most likely)
 * - MEDIUM: 50% to 75%
 * - LOW: 75% to 90%
 * - EXTENDED: 90% to 95%
 */

// =============================================================================
// RESEARCH-BACKED LOG-NORMAL PARAMETERS
// =============================================================================

// Dogs: μ and σ in ln(feet)
const DOG_PARAMS = {
  mu: 6.71,
  sigma: 3.55,
  unit: 'feet',
};

// Cats: μ and σ in ln(meters)
const CAT_PARAMS = {
  indoor: {
    mu: 3.66,
    sigma: 1.87,
    unit: 'meters',
  },
  outdoor: {
    mu: 5.70,
    sigma: 2.49,
    unit: 'meters',
  },
};

// Zone probability thresholds (cumulative)
const ZONE_THRESHOLDS = {
  HIGH: 0.50,      // 0% to 50%
  MEDIUM: 0.75,    // 50% to 75%
  LOW: 0.90,       // 75% to 90%
  EXTENDED: 0.95,  // 90% to 95%
};

// Standard normal quantiles for zone boundaries
// Φ⁻¹(p) values
const Z_SCORES = {
  0.50: 0,
  0.75: 0.674,
  0.90: 1.282,
  0.95: 1.645,
};

// Time multipliers - scales the radius based on time elapsed
// Applied as multiplier to the calculated distances
const TIME_MULTIPLIERS = {
  'less_than_hour': 0.7,    // Pet hasn't had time to travel far
  '1_to_6_hours': 1.0,      // Base case
  '6_to_24_hours': 1.3,     // Full day of potential movement
  '1_to_3_days': 1.8,       // Multiple days
  '3_to_7_days': 2.5,       // Week-long search
  '1_to_2_weeks': 3.5,      // Extended period
  'more_than_2_weeks': 5.0, // Long-term missing
};

// Age modifiers
const AGE_MODIFIERS = {
  puppy: 0.6,    // Young animals stay closer
  young: 0.9,
  adult: 1.0,
  senior: 0.7,   // Older animals don't travel as far
};

// Dog size modifiers (research shows size affects travel distance)
const DOG_SIZE_MODIFIERS = {
  TINY: 0.5,     // Under 10 lbs - stays very close
  SMALL: 0.7,    // 10-25 lbs
  MEDIUM: 1.0,   // 25-60 lbs - base case
  LARGE: 1.3,    // 60-90 lbs
  GIANT: 1.8,    // Over 90 lbs - can cover significant ground
};

// Unit conversion constants
const FEET_PER_MILE = 5280;
const METERS_PER_MILE = 1609.34;
const FEET_PER_METER = 3.28084;

// Maximum search radius cap (miles)
const MAX_SEARCH_RADIUS = 15;

// =============================================================================
// LOG-NORMAL DISTRIBUTION FUNCTIONS
// =============================================================================

/**
 * Calculate distance at a given cumulative probability using log-normal distribution
 * Formula: x = e^(μ + σ * z) where z = Φ⁻¹(p)
 *
 * @param {number} probability - Cumulative probability (0-1)
 * @param {number} mu - Log-normal μ parameter
 * @param {number} sigma - Log-normal σ parameter
 * @returns {number} Distance at that probability threshold
 */
function getDistanceAtProbability(probability, mu, sigma) {
  const z = Z_SCORES[probability] ?? approximateInverseNormal(probability);
  return Math.exp(mu + sigma * z);
}

/**
 * Approximate inverse normal CDF for probabilities not in lookup table
 * Uses Abramowitz and Stegun approximation
 */
function approximateInverseNormal(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const a1 = -3.969683028665376e+01;
  const a2 = 2.209460984245205e+02;
  const a3 = -2.759285104469687e+02;
  const a4 = 1.383577518672690e+02;
  const a5 = -3.066479806614716e+01;
  const a6 = 2.506628277459239e+00;

  const b1 = -5.447609879822406e+01;
  const b2 = 1.615858368580409e+02;
  const b3 = -1.556989798598866e+02;
  const b4 = 6.680131188771972e+01;
  const b5 = -1.328068155288572e+01;

  const c1 = -7.784894002430293e-03;
  const c2 = -3.223964580411365e-01;
  const c3 = -2.400758277161838e+00;
  const c4 = -2.549732539343734e+00;
  const c5 = 4.374664141464968e+00;
  const c6 = 2.938163982698783e+00;

  const d1 = 7.784695709041462e-03;
  const d2 = 3.224671290700398e-01;
  const d3 = 2.445134137142996e+00;
  const d4 = 3.754408661907416e+00;

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q, r;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }
}

/**
 * Calculate cumulative probability at a given distance
 * Formula: P(X ≤ x) = Φ((ln(x) - μ) / σ)
 */
function getProbabilityAtDistance(distance, mu, sigma) {
  if (distance <= 0) return 0;
  const z = (Math.log(distance) - mu) / sigma;
  return standardNormalCDF(z);
}

/**
 * Standard normal CDF approximation
 */
function standardNormalCDF(z) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

  return 0.5 * (1.0 + sign * y);
}

// =============================================================================
// MAIN CALCULATION FUNCTION
// =============================================================================

/**
 * Calculate search probability zones for a lost pet
 *
 * @param {Object} params - Pet and case parameters
 * @param {string} params.species - PetSpecies: DOG, CAT, BIRD, OTHER
 * @param {string} [params.size] - PetSize: TINY, SMALL, MEDIUM, LARGE, GIANT (for dogs)
 * @param {boolean} [params.isIndoorCat] - For cats: true = indoor only, false = outdoor access
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
  const normalizedSpecies = (species || 'DOG').toUpperCase();

  // Get base parameters based on species
  let mu, sigma, sourceUnit;

  if (normalizedSpecies === 'DOG') {
    mu = DOG_PARAMS.mu;
    sigma = DOG_PARAMS.sigma;
    sourceUnit = DOG_PARAMS.unit;
  } else if (normalizedSpecies === 'CAT') {
    const catType = isIndoorCat === true ? 'indoor' : 'outdoor';
    mu = CAT_PARAMS[catType].mu;
    sigma = CAT_PARAMS[catType].sigma;
    sourceUnit = CAT_PARAMS[catType].unit;
  } else {
    // Default to dog parameters for other species
    mu = DOG_PARAMS.mu;
    sigma = DOG_PARAMS.sigma;
    sourceUnit = DOG_PARAMS.unit;
  }

  // Calculate base distances at zone thresholds
  const baseDistances = {};
  for (const [zoneName, probability] of Object.entries(ZONE_THRESHOLDS)) {
    baseDistances[zoneName] = getDistanceAtProbability(probability, mu, sigma);
  }

  // Apply modifiers
  let modifier = 1.0;

  // Time modifier
  if (timeElapsed && TIME_MULTIPLIERS[timeElapsed]) {
    modifier *= TIME_MULTIPLIERS[timeElapsed];
  }

  // Age modifier
  if (age && AGE_MODIFIERS[age]) {
    modifier *= AGE_MODIFIERS[age];
  }

  // Size modifier (dogs only)
  if (normalizedSpecies === 'DOG' && size && DOG_SIZE_MODIFIERS[size]) {
    modifier *= DOG_SIZE_MODIFIERS[size];
  }

  // Convert to miles and apply modifier
  const convertToMiles = (distance, unit) => {
    if (unit === 'feet') {
      return (distance / FEET_PER_MILE) * modifier;
    } else if (unit === 'meters') {
      return (distance / METERS_PER_MILE) * modifier;
    }
    return distance * modifier;
  };

  // Build zones array
  const zoneNames = ['HIGH', 'MEDIUM', 'LOW', 'EXTENDED'];
  const zoneProbabilities = [0.50, 0.25, 0.15, 0.05]; // Individual zone probabilities
  let cumulativeProbability = 0;

  const zones = zoneNames.map((zoneName, index) => {
    const radiusMiles = Math.min(
      convertToMiles(baseDistances[zoneName], sourceUnit),
      MAX_SEARCH_RADIUS
    );

    const probability = zoneProbabilities[index];
    cumulativeProbability += probability;

    return {
      name: zoneName,
      radius: radiusMiles, // Always in miles internally
      probability,
      probabilityPercent: Math.round(probability * 100 * 10) / 10,
      cumulativeProbability,
      cumulativePercent: Math.round(cumulativeProbability * 100 * 10) / 10,
      color: getZoneColor(zoneName),
      fillOpacity: getZoneFillOpacity(zoneName),
    };
  });

  // Calculate confidence level
  let confidenceLevel = 'basic';
  const confidenceFactors = ['species'];

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
  }

  return {
    center: lastSeenLocation,
    zones,
    totalProbability: 0.95,
    confidenceLevel,
    confidenceFactors,
    parameters: {
      species: normalizedSpecies,
      size: size || null,
      isIndoorCat: normalizedSpecies === 'CAT' ? isIndoorCat : null,
      timeElapsed: timeElapsed || null,
      age: age || null,
    },
    // Include research params for transparency
    researchParams: {
      mu,
      sigma,
      sourceUnit,
      modifier,
    },
  };
}

// =============================================================================
// ZONE STYLING
// =============================================================================

function getZoneColor(zoneName) {
  const colors = {
    HIGH: '#22c55e',     // Green - highest probability
    MEDIUM: '#eab308',   // Yellow/amber
    LOW: '#f97316',      // Orange
    EXTENDED: '#ef4444', // Red - edge of search
  };
  return colors[zoneName] || '#6b7280';
}

function getZoneFillOpacity(zoneName) {
  const opacities = {
    HIGH: 0.20,
    MEDIUM: 0.15,
    LOW: 0.10,
    EXTENDED: 0.06,
  };
  return opacities[zoneName] || 0.1;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate points multiplier for a search location
 */
export function getPointsMultiplier(searchLocation, probabilityData) {
  if (!probabilityData?.center || !searchLocation) return 1.0;

  const distance = calculateDistanceMiles(
    probabilityData.center[0],
    probabilityData.center[1],
    searchLocation[0],
    searchLocation[1]
  );

  for (const zone of probabilityData.zones) {
    if (distance <= zone.radius) {
      const multipliers = { HIGH: 4.0, MEDIUM: 2.5, LOW: 1.5, EXTENDED: 1.0 };
      return multipliers[zone.name] || 1.0;
    }
  }

  return 0.5; // Outside all zones
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
 * Format distance for display based on locale
 *
 * @param {number} miles - Distance in miles
 * @param {boolean} useMetric - If true, show meters/km; if false, show feet/miles
 * @returns {string} Formatted distance string
 */
export function formatDistance(miles, useMetric = false) {
  if (useMetric) {
    const meters = miles * METERS_PER_MILE;
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(1)} km`;
    }
  } else {
    // US units: feet for < 0.2 miles, otherwise miles
    if (miles < 0.2) {
      const feet = Math.round(miles * FEET_PER_MILE);
      return `${feet.toLocaleString()} ft`;
    } else {
      return `${miles.toFixed(2)} mi`;
    }
  }
}

/**
 * Format zone description for display
 */
export function formatZoneDescription(zone, useMetric = false) {
  const radiusText = formatDistance(zone.radius, useMetric);
  return `${zone.name}: ${zone.probabilityPercent}% chance within ${radiusText}`;
}

/**
 * Get search priority message
 */
export function getSearchPriorityMessage(probabilityData, useMetric = false) {
  const highZone = probabilityData.zones.find(z => z.name === 'HIGH');
  if (!highZone) return 'Focus search near last seen location';

  const radiusText = formatDistance(highZone.radius, useMetric);
  return `Priority: Search within ${radiusText} of last sighting (${highZone.probabilityPercent}% probability)`;
}

/**
 * Get probability at a specific distance from last seen location
 * Useful for showing "X% chance pet is within this distance"
 */
export function getProbabilityAtDistanceMiles(distanceMiles, probabilityData) {
  if (!probabilityData?.researchParams) return null;

  const { mu, sigma, sourceUnit, modifier } = probabilityData.researchParams;

  // Convert miles back to source unit and remove modifier
  let distanceInSourceUnit;
  if (sourceUnit === 'feet') {
    distanceInSourceUnit = (distanceMiles / modifier) * FEET_PER_MILE;
  } else if (sourceUnit === 'meters') {
    distanceInSourceUnit = (distanceMiles / modifier) * METERS_PER_MILE;
  } else {
    distanceInSourceUnit = distanceMiles / modifier;
  }

  return getProbabilityAtDistance(distanceInSourceUnit, mu, sigma);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  calculateProbabilityZones,
  getPointsMultiplier,
  formatDistance,
  formatZoneDescription,
  getSearchPriorityMessage,
  getProbabilityAtDistanceMiles,
};
