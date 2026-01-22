/**
 * Emergent Simulation Configuration Schema
 *
 * This module defines all input parameters for the emergent Monte Carlo simulation.
 * Parameters are organized into categories with validation and defaults.
 *
 * DESIGN PRINCIPLE: No outcome probabilities are encoded here.
 * All outcomes emerge from behavioral mechanics.
 */

// =============================================================================
// ENUMERATIONS
// =============================================================================

export const SPECIES = {
  DOG: 'DOG',
  CAT: 'CAT',
};

export const SIZE = {
  TINY: 'TINY',       // < 5 lbs
  SMALL: 'SMALL',     // 5-20 lbs
  MEDIUM: 'MEDIUM',   // 20-50 lbs
  LARGE: 'LARGE',     // 50-90 lbs
  GIANT: 'GIANT',     // > 90 lbs
};

export const AGE_CATEGORY = {
  PUPPY_KITTEN: 'PUPPY_KITTEN',   // < 6 months
  JUVENILE: 'JUVENILE',           // 6 months - 1 year
  ADULT: 'ADULT',                 // 1-7 years
  SENIOR: 'SENIOR',               // 7-10 years
  GERIATRIC: 'GERIATRIC',         // > 10 years
};

export const TEMPERAMENT = {
  GREGARIOUS: 'GREGARIOUS',   // Actively approaches humans
  ALOOF: 'ALOOF',             // Avoids but doesn't flee
  XENOPHOBIC: 'XENOPHOBIC',   // Flees from all humans
};

export const ESCAPE_TYPE = {
  DOOR_DASH: 'DOOR_DASH',                   // Bolted out open door
  GATE_LEFT_OPEN: 'GATE_LEFT_OPEN',         // Wandered out of yard
  CHASED_BY_ANIMAL: 'CHASED_BY_ANIMAL',     // Fled from another animal
  CHASED_BY_HUMAN: 'CHASED_BY_HUMAN',       // Fled from person
  LOUD_NOISE_STARTLE: 'LOUD_NOISE_STARTLE', // Fireworks, thunder, etc.
  DISASTER: 'DISASTER',                     // Fire, earthquake, etc.
  FELL_FROM_VEHICLE: 'FELL_FROM_VEHICLE',   // Jumped/fell from car
  WANDERED: 'WANDERED',                     // Gradual wandering, not fleeing
};

export const BEHAVIOR_STATE = {
  FLEEING: 'FLEEING',       // Panic movement away from threat
  HIDING: 'HIDING',         // Concealed, stationary, waiting
  FORAGING: 'FORAGING',     // Seeking food/water, cautious movement
  TRAVELING: 'TRAVELING',   // Directed movement toward destination
  SHELTERING: 'SHELTERING', // Found den/structure, semi-permanent stay
};

export const TERRAIN_TYPE = {
  URBAN: 'URBAN',
  SUBURBAN: 'SUBURBAN',
  RURAL: 'RURAL',
  WOODED: 'WOODED',
};

// =============================================================================
// DEFAULT VALUES BY SPECIES
// =============================================================================

export const SPECIES_DEFAULTS = {
  DOG: {
    territory_familiarity_indoor: 0.2,
    territory_familiarity_outdoor: 0.8,
    recall_training: 0.5,
    food_motivation: 0.7,
    base_fear_threshold: 0.4,      // Lower = emerges from hiding sooner
    homing_instinct: 0.6,          // Higher = stronger pull toward home
    flee_duration_base_minutes: 60, // How long before transitioning out of FLEEING
    energy_decay_rate: 0.008,       // Per tick while active
    hunger_rate: 0.0003,           // Per minute
    thirst_rate: 0.0005,           // Per minute (faster than hunger)
  },
  CAT: {
    territory_familiarity_indoor: 0.1,
    territory_familiarity_outdoor: 0.7,
    recall_training: 0.2,
    food_motivation: 0.5,
    base_fear_threshold: 0.7,      // Higher = hides longer
    homing_instinct: 0.3,          // Lower = less likely to travel home
    flee_duration_base_minutes: 3,  // Cats tire very quickly (calibrated to Huang 2018)
    energy_decay_rate: 0.03,        // Cats exhaust faster during flee (calibrated)
    hunger_rate: 0.0003,           // Per minute
    thirst_rate: 0.0005,           // Per minute (faster than hunger)
  },
};

// =============================================================================
// TEMPERAMENT MODIFIERS
// =============================================================================

export const TEMPERAMENT_MODIFIERS = {
  GREGARIOUS: {
    fear_threshold_multiplier: 0.6,    // Lower threshold = overcomes fear easier
    stranger_approach_prob: 0.8,       // High chance of approaching stranger
    stranger_capture_success: 0.9,     // Easy to catch if approached
    flee_from_searcher_prob: 0.1,      // Unlikely to flee from searcher
    time_appropriateness_override: 1.0, // Less restricted by time of day
  },
  ALOOF: {
    fear_threshold_multiplier: 1.0,    // Baseline
    stranger_approach_prob: 0.2,       // Low approach probability
    stranger_capture_success: 0.5,     // Moderate capture difficulty
    flee_from_searcher_prob: 0.4,      // May flee from searcher
    time_appropriateness_override: 1.0,
  },
  XENOPHOBIC: {
    fear_threshold_multiplier: 1.5,    // Higher threshold = hides much longer
    stranger_approach_prob: 0.02,      // Almost never approaches
    stranger_capture_success: 0.1,     // Very hard to catch
    flee_from_searcher_prob: 0.9,      // Almost always flees
    time_appropriateness_override: 0.5, // More nocturnal behavior
  },
};

// =============================================================================
// ESCAPE TYPE -> INITIAL FEAR MAPPING
// =============================================================================

export const ESCAPE_INITIAL_FEAR = {
  DOOR_DASH: { base: 0.6, variance: 0.2 },
  GATE_LEFT_OPEN: { base: 0.3, variance: 0.2 },
  CHASED_BY_ANIMAL: { base: 0.9, variance: 0.1 },
  CHASED_BY_HUMAN: { base: 0.85, variance: 0.1 },
  LOUD_NOISE_STARTLE: { base: 0.8, variance: 0.2 },
  DISASTER: { base: 1.0, variance: 0.0 },
  FELL_FROM_VEHICLE: { base: 0.95, variance: 0.05 },
  WANDERED: { base: 0.2, variance: 0.1 },
};

// =============================================================================
// SIZE MODIFIERS
// =============================================================================

export const SIZE_MODIFIERS = {
  TINY: {
    speed_multiplier: 0.5,
    predator_vulnerability: 0.9,
    visibility_multiplier: 0.7,
  },
  SMALL: {
    speed_multiplier: 0.7,
    predator_vulnerability: 0.6,
    visibility_multiplier: 0.8,
  },
  MEDIUM: {
    speed_multiplier: 1.0,
    predator_vulnerability: 0.3,
    visibility_multiplier: 1.0,
  },
  LARGE: {
    speed_multiplier: 1.1,
    predator_vulnerability: 0.1,
    visibility_multiplier: 1.2,
  },
  GIANT: {
    speed_multiplier: 0.9,  // Mass limits sustained speed
    predator_vulnerability: 0.02,
    visibility_multiplier: 1.4,
  },
};

// =============================================================================
// AGE MODIFIERS
// =============================================================================

export const AGE_MODIFIERS = {
  PUPPY_KITTEN: {
    speed_multiplier: 0.7,
    energy_decay_multiplier: 1.3,    // Tires faster
    fear_decay_multiplier: 1.5,      // Calms down faster
    survival_multiplier: 0.7,        // More vulnerable
  },
  JUVENILE: {
    speed_multiplier: 1.1,
    energy_decay_multiplier: 0.9,
    fear_decay_multiplier: 1.2,
    survival_multiplier: 0.9,
  },
  ADULT: {
    speed_multiplier: 1.0,
    energy_decay_multiplier: 1.0,
    fear_decay_multiplier: 1.0,
    survival_multiplier: 1.0,
  },
  SENIOR: {
    speed_multiplier: 0.6,
    energy_decay_multiplier: 1.4,
    fear_decay_multiplier: 0.8,      // Slower to calm
    survival_multiplier: 0.7,
  },
  GERIATRIC: {
    speed_multiplier: 0.3,
    energy_decay_multiplier: 1.8,
    fear_decay_multiplier: 0.6,
    survival_multiplier: 0.4,
  },
};

// =============================================================================
// CONFIGURABLE BEHAVIORAL PARAMETERS
// These are the "knobs" we can tune during calibration
// =============================================================================

export const BEHAVIORAL_PARAMS = {
  // Fear dynamics
  fear_decay_rate: 0.0003,           // Per minute, half-life ~40 hours
  fear_spike_on_threat: 0.3,         // How much fear increases on threat

  // State transition thresholds
  energy_exhaustion_threshold: 0.15, // Below this, forced to stop fleeing
  hunger_foraging_threshold: 0.5,    // Above this, hunger drives foraging
  thirst_foraging_threshold: 0.4,    // Above this, thirst drives foraging (lower = more urgent)
  thirst_urgency_multiplier: 1.5,    // Thirst weighted higher than hunger in drive calculation

  // Flee-to-hide transition (calibrated to Huang 2018 displacement data)
  flee_transition_rate: 0.4,         // Per-tick probability scaling after min flee time

  // Movement (calibrated to produce realistic displacements)
  // Indoor-only cats: target median ~39m (Huang 2018)
  // Indoor-outdoor cats: target median ~300m (Huang 2018)
  base_speed_miles_per_tick: 0.002,  // ~0.024 mph baseline (5-min tick) - much slower
  flee_speed_multiplier: 3.0,        // ~0.07 mph when fleeing
  forage_speed_multiplier: 0.5,      // Very slow, cautious
  travel_speed_multiplier: 2.0,      // ~0.05 mph purposeful walk

  // Direction calculation weights
  direction_inertia_weight: 0.3,
  direction_threat_avoidance_weight: 0.8,
  direction_home_attraction_weight: 0.4,
  direction_terrain_preference_weight: 0.2,
  direction_noise_stddev_degrees: 20,

  // Home recognition
  home_recognition_radius_miles: 0.02,  // ~100 feet

  // Time-of-day preferences (for cats)
  crepuscular_hours: [5, 6, 7, 17, 18, 19, 20],  // Dawn and dusk
  cat_crepuscular_activity_bonus: 3.0,
  cat_daylight_activity_penalty: 0.2,

  // Incidental resource finding while hiding
  incidental_water_find_prob_per_day: 0.1,
  incidental_water_relief: 0.3,

  // Stranger encounter
  base_human_density_suburban: 0.001,  // Probability modifier per tick

  // Shelter mechanics
  shelter_scan_delay_hours: 24,        // Hours before shelter scans microchip
};

// =============================================================================
// CONFIGURATION BUILDER
// =============================================================================

/**
 * Build a complete pet configuration from user inputs
 *
 * @param {Object} userInputs - Raw user inputs
 * @returns {Object} Complete configuration with all derived values
 */
export function buildPetConfig(userInputs) {
  const {
    // Required
    species,
    escapeLatitude,
    escapeLongitude,
    escapeDatetime,

    // Optional with smart defaults
    size = species === SPECIES.CAT ? SIZE.SMALL : SIZE.MEDIUM,
    ageCategory = AGE_CATEGORY.ADULT,
    temperament = TEMPERAMENT.ALOOF,
    isIndoorOnly = species === SPECIES.CAT,
    escapeType = ESCAPE_TYPE.DOOR_DASH,
    escapeDirection = null,  // null = unknown

    // Derived from questions or defaults
    recallTraining = null,
    foodMotivation = null,
    territoryFamiliarity = null,

    // Identification
    hasCollar = false,
    hasVisibleTags = false,
    hasMicrochip = false,
    microchipRegistered = false,
  } = userInputs;

  // Get species defaults
  const speciesDefaults = SPECIES_DEFAULTS[species];

  // Calculate territory familiarity
  let calculatedTerritoryFamiliarity;
  if (territoryFamiliarity !== null) {
    calculatedTerritoryFamiliarity = territoryFamiliarity;
  } else if (isIndoorOnly) {
    calculatedTerritoryFamiliarity = speciesDefaults.territory_familiarity_indoor;
  } else {
    calculatedTerritoryFamiliarity = speciesDefaults.territory_familiarity_outdoor;
  }

  // Calculate initial fear from escape type
  const fearConfig = ESCAPE_INITIAL_FEAR[escapeType];
  const initialFear = Math.min(1.0, Math.max(0,
    fearConfig.base + (Math.random() - 0.5) * 2 * fearConfig.variance
  ));

  // Determine initial behavior state
  const initialBehaviorState = escapeType === ESCAPE_TYPE.WANDERED
    ? BEHAVIOR_STATE.TRAVELING
    : BEHAVIOR_STATE.FLEEING;

  return {
    // Identity
    species,
    size,
    ageCategory,
    temperament,

    // Behavioral traits
    recallTraining: recallTraining ?? speciesDefaults.recall_training,
    foodMotivation: foodMotivation ?? speciesDefaults.food_motivation,
    territoryFamiliarity: calculatedTerritoryFamiliarity,
    isIndoorOnly,

    // Identification
    hasCollar,
    hasVisibleTags,
    hasMicrochip,
    microchipRegistered: hasMicrochip && microchipRegistered,

    // Escape details
    escapeType,
    escapeLatitude,
    escapeLongitude,
    escapeDatetime,
    escapeDirection,

    // Initial state (calculated)
    initialFear,
    initialBehaviorState,

    // Pre-computed modifiers
    sizeModifiers: SIZE_MODIFIERS[size],
    ageModifiers: AGE_MODIFIERS[ageCategory],
    temperamentModifiers: TEMPERAMENT_MODIFIERS[temperament],
    speciesDefaults,
  };
}

/**
 * Build searcher configuration
 */
export function buildSearcherConfig(userInputs) {
  const {
    searcherCount = 1,
    searchStartDelayHours = 2,
    searchHoursStart = 7,
    searchHoursEnd = 21,
    hasTraps = false,
    numTraps = 0,
    hasSearchDog = false,
    searchDogType = null,
    searchStrategy = 'PROBABILITY',
  } = userInputs;

  // Outreach/visibility factors - affects stranger return probability
  const {
    postedOnSocialMedia = false,      // Facebook, Nextdoor, etc.
    postedFlyers = false,             // Physical flyers in neighborhood
    contactedShelters = false,        // Called local shelters
    listedOnReunitePetsPlatform = false,  // PetFBI, Pawboost, etc.
  } = userInputs;

  // Calculate visibility score (0-1) based on outreach efforts
  // Higher visibility = strangers more likely to return pet directly
  let visibilityScore = 0.1;  // Base: 10% chance stranger knows to contact owner
  if (postedOnSocialMedia) visibilityScore += 0.25;
  if (postedFlyers) visibilityScore += 0.20;
  if (contactedShelters) visibilityScore += 0.15;
  if (listedOnReunitePetsPlatform) visibilityScore += 0.15;
  visibilityScore = Math.min(1, visibilityScore);

  return {
    searcherCount,
    searchStartDelayHours,
    searchHoursStart,
    searchHoursEnd,
    hasTraps,
    numTraps,
    hasSearchDog,
    searchDogType,
    searchStrategy,
    // Outreach factors
    postedOnSocialMedia,
    postedFlyers,
    contactedShelters,
    listedOnReunitePetsPlatform,
    visibilityScore,  // Combined visibility metric
  };
}

/**
 * Build environment configuration
 */
export function buildEnvironmentConfig(userInputs) {
  const {
    terrainType = TERRAIN_TYPE.SUBURBAN,
    searchRadiusMiles = 2.0,
    maxSimulationHours = 168,  // 7 days default
    timeStepMinutes = 5,
  } = userInputs;

  return {
    terrainType,
    searchRadiusMiles,
    maxSimulationHours,
    timeStepMinutes,
  };
}

// =============================================================================
// USER INPUT QUESTION MAPPINGS
// =============================================================================

/**
 * Maps user-friendly question answers to parameter values
 */
export const QUESTION_MAPPINGS = {
  recallTraining: {
    question: "If your pet is outside and you call their name, what usually happens?",
    options: [
      { label: "Comes running immediately", value: 0.9 },
      { label: "Usually comes after a moment", value: 0.7 },
      { label: "Sometimes comes, sometimes ignores", value: 0.5 },
      { label: "Rarely comes when called", value: 0.3 },
      { label: "Never trained / doesn't respond", value: 0.1 },
    ],
  },

  temperament: {
    question: "When a stranger approaches your pet, what does your pet typically do?",
    options: [
      { label: "Approaches the stranger excitedly", value: TEMPERAMENT.GREGARIOUS },
      { label: "Watches cautiously, may warm up", value: TEMPERAMENT.ALOOF },
      { label: "Runs away or hides", value: TEMPERAMENT.XENOPHOBIC },
    ],
  },

  foodMotivation: {
    question: "How does your pet respond to treats or food?",
    options: [
      { label: "Will do anything for food", value: 0.9 },
      { label: "Very interested in food", value: 0.7 },
      { label: "Moderate interest", value: 0.5 },
      { label: "Picky eater, not very food-driven", value: 0.3 },
    ],
  },

  escapeType: {
    question: "How did your pet get lost?",
    options: [
      { label: "Bolted out an open door", value: ESCAPE_TYPE.DOOR_DASH },
      { label: "Gate/door was left open, wandered out", value: ESCAPE_TYPE.GATE_LEFT_OPEN },
      { label: "Chased by another animal", value: ESCAPE_TYPE.CHASED_BY_ANIMAL },
      { label: "Scared by a person", value: ESCAPE_TYPE.CHASED_BY_HUMAN },
      { label: "Startled by loud noise (fireworks, thunder)", value: ESCAPE_TYPE.LOUD_NOISE_STARTLE },
      { label: "Natural disaster or emergency", value: ESCAPE_TYPE.DISASTER },
      { label: "Jumped/fell from vehicle", value: ESCAPE_TYPE.FELL_FROM_VEHICLE },
      { label: "Gradually wandered off", value: ESCAPE_TYPE.WANDERED },
    ],
  },
};
