/**
 * Detection Model - Probabilistic detection of pets by searchers
 *
 * P(detection) = base_rate
 *              × visibility_modifier(terrain)
 *              × activity_modifier(pet_state)
 *              × fatigue_modifier(searcher_hours)
 *              × time_of_day_modifier(hour)
 *              × distance_falloff(distance)
 *
 * CALIBRATION NOTES:
 * - Original rates (0.95, 0.70, 0.40, 0.15, 0.02) were too high
 * - Over 864 ticks (72hrs), even 15% per tick = near-certain detection
 * - Reduced rates account for:
 *   - Searcher not looking in right direction (only ~30% of 360°)
 *   - Pet behind obstacles, vegetation, or structures
 *   - Real-world search inefficiency and fatigue
 *   - Pets actively avoiding detection
 * - Target outcomes: 50-70% dog, 20-40% cat (per MARN research)
 */

// Base detection rates by distance (miles)
// These represent probability per 5-minute tick
// Reduced to produce realistic outcomes over multi-day simulations
const BASE_RATES = [
  { maxDistance: 0.002, rate: 0.25 },   // < 10 ft (was 0.95) - still might miss hiding pet
  { maxDistance: 0.006, rate: 0.10 },   // 10-30 ft (was 0.70)
  { maxDistance: 0.019, rate: 0.04 },   // 30-100 ft (was 0.40)
  { maxDistance: 0.057, rate: 0.01 },   // 100-300 ft (was 0.15)
  { maxDistance: Infinity, rate: 0.001 }, // 300+ ft (was 0.02)
];

// Pet state modifiers
// CALIBRATION: Hiding increased from 0.1 to 0.25 - was causing 0% cat success
const STATE_MODIFIERS = {
  FLEEING: 1.3,      // Motion catches eye (slightly increased)
  HIDING: 0.25,      // Hard to find but not impossible (was 0.1)
  FORAGING: 1.1,     // Moving around, slightly easier to spot
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
