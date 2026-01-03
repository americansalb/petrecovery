/**
 * Koopman POD Detection Model for Lost Pet Simulator
 *
 * THEORETICAL FOUNDATION:
 * This implements the Koopman exponential detection formula from search theory:
 *
 *   POD = 1 - exp(-C)
 *
 * Where Coverage C = (W × L) / A
 *   W = sweep width (effective detection distance, both sides of track)
 *   L = distance traveled by searcher in this time step
 *   A = area segment being searched
 *
 * SWEEP WIDTH:
 * Sweep width is empirically derived from SAR detection experiments.
 * It represents the effective width of the detection corridor - NOT the
 * maximum detection range, but the width that gives equivalent probability
 * to a perfect detector of that width.
 *
 * CITATIONS:
 * - Koopman, B.O. (1980). Search and Screening
 * - Koester, R.J. (2008). Lost Person Behavior
 * - Frost, J.R. (1999). Principles of Search Theory
 *
 * VERIFICATION STATUS:
 * - Formula: VERIFIED (Koopman 1980, industry standard)
 * - Sweep widths: DERIVED from SAR human detection data, adapted for pets
 * - Modifiers: DERIVED from SAR terrain/light classifications
 */

import { SAR_SWEEP_WIDTHS, UNVERIFIED_PARAMS } from './researchConfig.js';

// =============================================================================
// KOOPMAN POD CALCULATION
// =============================================================================

/**
 * Calculate Probability of Detection using Koopman formula
 *
 * POD = 1 - exp(-C), where C = (W × L) / A
 *
 * @param {number} sweepWidth - Effective sweep width in meters
 * @param {number} distanceTraveled - Distance searcher moved this step (meters)
 * @param {number} areaSearched - Area segment being searched (square meters)
 * @returns {number} Probability of detection (0-1)
 */
export function koopmanPOD(sweepWidth, distanceTraveled, areaSearched) {
  if (areaSearched <= 0 || sweepWidth <= 0 || distanceTraveled <= 0) {
    return 0;
  }

  const coverage = (sweepWidth * distanceTraveled) / areaSearched;
  return 1 - Math.exp(-coverage);
}

/**
 * Get effective sweep width for detecting a pet
 *
 * Sweep width depends on:
 * - Species (dog vs cat)
 * - Pet responsiveness (based on personality and state)
 * - Terrain type
 * - Time of day (lighting)
 * - Searcher experience/fatigue
 *
 * @param {Object} params - Detection parameters
 * @returns {number} Effective sweep width in meters
 */
export function getEffectiveSweepWidth({
  species,
  petState,
  petPersonality,
  terrainType,
  currentHour,
  searcherFatigueHours,
}) {
  // 1. Base sweep width based on species and responsiveness
  const isResponsive = determineResponsiveness(petState, petPersonality);
  let baseWidth;

  if (species === 'dog') {
    baseWidth = isResponsive
      ? SAR_SWEEP_WIDTHS.TARGET_TYPE.DOG_RESPONSIVE.width
      : SAR_SWEEP_WIDTHS.TARGET_TYPE.DOG_UNRESPONSIVE.width;
  } else {
    baseWidth = isResponsive
      ? SAR_SWEEP_WIDTHS.TARGET_TYPE.CAT_RESPONSIVE.width
      : SAR_SWEEP_WIDTHS.TARGET_TYPE.CAT_UNRESPONSIVE.width;
  }

  // 2. Apply terrain modifier
  const terrainMod = getTerrainModifier(terrainType);

  // 3. Apply lighting modifier
  const lightMod = getLightingModifier(currentHour);

  // 4. Apply fatigue modifier
  const fatigueMod = getFatigueModifier(searcherFatigueHours);

  // Calculate effective sweep width
  const effectiveWidth = baseWidth * terrainMod * lightMod * fatigueMod;

  return Math.max(effectiveWidth, 1); // Minimum 1 meter
}

/**
 * Determine if pet is responsive to searchers
 *
 * A responsive pet will vocalize, move toward searchers, or be more visible.
 * An unresponsive pet hides, stays quiet, or flees.
 */
function determineResponsiveness(petState, petPersonality) {
  // State-based: hiding and fleeing pets are unresponsive
  if (petState === 'HIDING' || petState === 'FLEEING') {
    return false;
  }

  // Sheltered pets are not in the search area
  if (petState === 'SHELTERED') {
    return false;
  }

  // Personality-based: friendly pets are more responsive
  if (petPersonality === 'FRIENDLY') {
    return true;
  }

  // Shy pets are unresponsive even when not hiding
  if (petPersonality === 'SHY') {
    return false;
  }

  // Neutral pets are somewhat responsive when active
  return petState === 'WANDERING' || petState === 'FORAGING';
}

/**
 * Get terrain modifier for sweep width
 */
function getTerrainModifier(terrainType) {
  const modifiers = SAR_SWEEP_WIDTHS.TERRAIN_MODIFIERS;

  switch (terrainType) {
    case 'RURAL':
      return modifiers.OPEN;
    case 'SUBURBAN':
      return modifiers.SUBURBAN;
    case 'URBAN':
      return modifiers.URBAN_DENSE;
    case 'WOODED':
      return modifiers.WOODED;
    default:
      return modifiers.SUBURBAN;
  }
}

/**
 * Get lighting modifier based on time of day
 */
function getLightingModifier(hour) {
  const modifiers = SAR_SWEEP_WIDTHS.LIGHT_MODIFIERS;

  // Night: 21:00 - 05:00
  if (hour >= 21 || hour < 5) {
    return modifiers.NIGHT_FLASHLIGHT; // Assume flashlight at night
  }

  // Dawn: 05:00 - 07:00
  if (hour >= 5 && hour < 7) {
    return modifiers.DAWN_DUSK;
  }

  // Dusk: 18:00 - 21:00
  if (hour >= 18 && hour < 21) {
    return modifiers.DAWN_DUSK;
  }

  // Daylight
  return modifiers.DAYLIGHT;
}

/**
 * Get fatigue modifier for sweep width
 */
function getFatigueModifier(hoursSearching) {
  const modifiers = SAR_SWEEP_WIDTHS.EXPERIENCE_MODIFIERS;

  if (hoursSearching < 2) {
    return modifiers.EXPERIENCED;
  }
  if (hoursSearching < 4) {
    return 0.85; // Mild fatigue
  }
  if (hoursSearching < 6) {
    return 0.7; // Moderate fatigue
  }
  return modifiers.FATIGUED; // Heavy fatigue after 6+ hours
}

// =============================================================================
// MAIN DETECTION PROBABILITY FUNCTION
// =============================================================================

/**
 * Calculate detection probability for a single time step
 *
 * Uses the Koopman POD formula with SAR-derived sweep widths.
 *
 * @param {Object} params - Detection parameters
 * @param {number} params.distance - Distance from searcher to pet (miles)
 * @param {string} params.petState - Current pet behavioral state
 * @param {string} params.petPersonality - Pet personality (FRIENDLY, NEUTRAL, SHY)
 * @param {string} params.terrainType - URBAN, SUBURBAN, RURAL
 * @param {number} params.currentHour - Hour of day (0-23)
 * @param {number} params.searcherFatigueHours - How long searcher has been searching
 * @param {number} params.searcherStepDistance - Distance searcher moved this step (miles)
 * @param {string} params.species - 'cat' or 'dog'
 * @returns {number} Probability of detection (0-1)
 */
export function calculateDetectionProbability({
  distance,
  petState,
  petPersonality,
  terrainType,
  currentHour,
  searcherFatigueHours,
  searcherStepDistance = 0.02, // Default: ~100m per 5-minute step
  species = 'dog',
}) {
  // Sheltered pets cannot be found by search
  if (petState === 'SHELTERED') {
    return 0;
  }

  // Convert distance from miles to meters
  const distanceMeters = distance * 1609.34;

  // Get effective sweep width
  const sweepWidth = getEffectiveSweepWidth({
    species,
    petState,
    petPersonality,
    terrainType,
    currentHour,
    searcherFatigueHours,
  });

  // If pet is beyond sweep width range, detection is unlikely
  // The sweep width represents the effective detection corridor half-width
  // At distances beyond 2× sweep width, detection probability approaches zero
  if (distanceMeters > sweepWidth * 3) {
    // Apply exponential distance decay beyond sweep width
    const decayFactor = Math.exp(-(distanceMeters - sweepWidth) / sweepWidth);
    return decayFactor * 0.1; // Max 10% at edge of range
  }

  // Calculate search area for this step
  // Model: searcher sweeps an area based on distance traveled
  const searcherDistanceMeters = searcherStepDistance * 1609.34;

  // Search area is the corridor swept: width × distance traveled
  // But we're checking a specific cell containing the pet
  // The area is the "local cell" being searched
  const cellRadius = sweepWidth * 1.5; // Effective cell radius
  const cellArea = Math.PI * cellRadius * cellRadius;

  // Calculate coverage factor
  // Higher coverage when pet is closer to searcher track
  const proximityFactor = Math.max(0, 1 - (distanceMeters / (sweepWidth * 2)));

  // Apply Koopman formula with proximity adjustment
  const effectiveTrackLength = searcherDistanceMeters * (0.5 + 0.5 * proximityFactor);
  const coverage = (sweepWidth * effectiveTrackLength) / cellArea;

  const pod = 1 - Math.exp(-coverage);

  // Clamp to valid range
  return Math.max(0, Math.min(1, pod));
}

/**
 * Get sweep width for display/debugging
 */
export function getSweepWidthInfo(params) {
  const width = getEffectiveSweepWidth(params);
  const isResponsive = determineResponsiveness(params.petState, params.petPersonality);

  return {
    effectiveWidth: width,
    effectiveWidthMiles: width / 1609.34,
    isResponsive,
    terrainModifier: getTerrainModifier(params.terrainType),
    lightModifier: getLightingModifier(params.currentHour),
    fatigueModifier: getFatigueModifier(params.searcherFatigueHours),
    formula: 'POD = 1 - exp(-C), C = (W × L) / A',
    citation: 'Koopman 1980, Koester 2008'
  };
}

/**
 * Get a human-readable description of detection difficulty
 */
export function getDetectionDifficulty(probability) {
  if (probability >= 0.7) return 'Very Likely';
  if (probability >= 0.4) return 'Likely';
  if (probability >= 0.15) return 'Moderate';
  if (probability >= 0.05) return 'Difficult';
  return 'Very Difficult';
}

/**
 * Calculate cumulative POD after multiple search passes
 *
 * POD_cumulative = 1 - (1 - POD_per_pass)^n
 *
 * @param {number} podPerPass - POD for single pass
 * @param {number} numPasses - Number of search passes
 * @returns {number} Cumulative POD
 */
export function cumulativePOD(podPerPass, numPasses) {
  return 1 - Math.pow(1 - podPerPass, numPasses);
}

/**
 * Calculate required number of passes for target POD
 *
 * n = ln(1 - POD_target) / ln(1 - POD_per_pass)
 *
 * @param {number} podPerPass - POD for single pass
 * @param {number} targetPOD - Desired cumulative POD
 * @returns {number} Number of passes needed (rounded up)
 */
export function requiredPasses(podPerPass, targetPOD) {
  if (podPerPass <= 0 || podPerPass >= 1 || targetPOD <= 0 || targetPOD >= 1) {
    return Infinity;
  }
  return Math.ceil(Math.log(1 - targetPOD) / Math.log(1 - podPerPass));
}
