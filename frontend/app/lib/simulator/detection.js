/**
 * Detection Model - Probabilistic detection of pets by searchers
 *
 * P(detection) = base_rate
 *              × visibility_modifier(terrain)
 *              × activity_modifier(pet_state)
 *              × fatigue_modifier(searcher_hours)
 *              × time_of_day_modifier(hour)
 *              × distance_falloff(distance)
 */

// Base detection rates by distance (miles)
// These represent probability per 5-minute tick
const BASE_RATES = [
  { maxDistance: 0.002, rate: 0.95 },   // < 10 ft
  { maxDistance: 0.006, rate: 0.70 },   // 10-30 ft
  { maxDistance: 0.019, rate: 0.40 },   // 30-100 ft
  { maxDistance: 0.057, rate: 0.15 },   // 100-300 ft
  { maxDistance: Infinity, rate: 0.02 }, // 300+ ft
];

// Pet state modifiers
const STATE_MODIFIERS = {
  FLEEING: 1.2,      // Motion catches eye
  HIDING: 0.1,       // Very hard to find
  FORAGING: 1.0,     // Normal visibility
  WANDERING: 1.0,    // Normal visibility
  TERRITORIAL: 0.9,  // Slightly cautious
  SHELTERED: 0.0,    // Not in search area
};

// Terrain modifiers
const TERRAIN_MODIFIERS = {
  URBAN: {
    base: 0.8,        // Buildings provide cover
    hiding: 0.15,     // Many hiding spots
  },
  SUBURBAN: {
    base: 1.0,        // Standard visibility
    hiding: 0.1,      // Some cover
  },
  RURAL: {
    base: 1.5,        // Open terrain, better visibility
    hiding: 0.3,      // Fewer hiding spots
  },
};

// Personality modifiers
const PERSONALITY_MODIFIERS = {
  FRIENDLY: 1.3,     // May approach humans
  NEUTRAL: 1.0,
  SHY: 0.6,          // Actively avoids
};

// Fatigue modifiers by hours searching
function getFatigueModifier(hours) {
  if (hours < 2) return 1.0;
  if (hours < 4) return 0.9;
  if (hours < 6) return 0.75;
  return 0.5;  // Diminishing returns after 6 hours
}

// Time of day modifiers
function getTimeOfDayModifier(hour) {
  // Night: 21:00 - 05:00
  if (hour >= 21 || hour <= 5) return 0.3;
  // Dawn/Dusk: 05:00-07:00, 17:00-21:00
  if ((hour >= 5 && hour <= 7) || (hour >= 17 && hour < 21)) return 0.7;
  // Day
  return 1.0;
}

/**
 * Calculate detection probability for a single check
 *
 * @param {Object} params Detection parameters
 * @param {number} params.distance - Distance in miles
 * @param {string} params.petState - Current pet state
 * @param {string} params.petPersonality - Pet personality (FRIENDLY, NEUTRAL, SHY)
 * @param {string} params.terrainType - URBAN, SUBURBAN, RURAL
 * @param {number} params.currentHour - Hour of day (0-23)
 * @param {number} params.searcherFatigueHours - How long searcher has been searching
 * @returns {number} Probability of detection (0-1)
 */
export function calculateDetectionProbability({
  distance,
  petState,
  petPersonality,
  terrainType,
  currentHour,
  searcherFatigueHours,
}) {
  // Get base rate from distance
  let baseRate = 0;
  for (const { maxDistance, rate } of BASE_RATES) {
    if (distance <= maxDistance) {
      baseRate = rate;
      break;
    }
  }

  // Apply modifiers
  const stateModifier = STATE_MODIFIERS[petState] || 1.0;
  const terrain = TERRAIN_MODIFIERS[terrainType] || TERRAIN_MODIFIERS.SUBURBAN;
  const terrainModifier = petState === 'HIDING' ? terrain.hiding : terrain.base;
  const personalityModifier = PERSONALITY_MODIFIERS[petPersonality] || 1.0;
  const fatigueModifier = getFatigueModifier(searcherFatigueHours);
  const timeModifier = getTimeOfDayModifier(currentHour);

  // Calculate final probability
  let probability = baseRate
    * stateModifier
    * terrainModifier
    * personalityModifier
    * fatigueModifier
    * timeModifier;

  // Clamp to valid range
  return Math.max(0, Math.min(1, probability));
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
