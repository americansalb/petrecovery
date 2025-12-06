/**
 * Task Priority Algorithm
 *
 * Calculates priority scores for rescue tasks based on:
 * - Time urgency (first 24hrs most critical)
 * - Time of day (shelters open, dawn/dusk search windows)
 * - Task status (not done yet, in progress, recently completed)
 * - User proximity (nearby tasks ranked higher)
 * - Pet type and phase-specific bonuses
 * - SIGHTING BOOST: Recent sightings massively boost nearby tasks
 * - PET-SPECIFIC: Indoor/outdoor, size, health urgency
 * - DIMINISHING RETURNS: Repeat tasks penalized
 */

// =============================================================================
// PET BEHAVIOR PROFILES
// =============================================================================

export const PET_PROFILES = {
  CAT: {
    INDOOR: {
      typicalRange: 0.25, // miles - indoor cats usually within 3-5 houses
      searchRadius: 0.5,
      hideBehavior: 'HIDE_CLOSE', // Hides very close, scared
      returnLikelihood: 0.7, // 70% return on their own if given time
    },
    OUTDOOR: {
      typicalRange: 1.0, // miles
      searchRadius: 2.0,
      hideBehavior: 'TERRITORIAL', // Has a territory, may be displaced
      returnLikelihood: 0.5,
    },
  },
  DOG: {
    SMALL: {
      typicalRange: 1.0, // miles
      searchRadius: 3.0,
      behavior: 'STAY_CLOSE', // Usually doesn't go far
      dangerLevel: 'HIGH', // More vulnerable
    },
    MEDIUM: {
      typicalRange: 3.0,
      searchRadius: 5.0,
      behavior: 'ROAM',
      dangerLevel: 'MEDIUM',
    },
    LARGE: {
      typicalRange: 5.0,
      searchRadius: 10.0,
      behavior: 'RUN_FAR',
      dangerLevel: 'LOW',
    },
  },
};

// Health urgency multipliers
export const HEALTH_URGENCY = {
  NONE: 1.0,
  MEDICATION_DAILY: 1.5,    // Needs daily meds
  MEDICATION_CRITICAL: 2.5, // Needs meds multiple times/day (insulin, etc)
  SENIOR: 1.3,              // Old pet, less resilient
  PUPPY_KITTEN: 1.4,        // Young, vulnerable
  MEDICAL_CONDITION: 1.8,   // Heart condition, epilepsy, etc.
};

// =============================================================================
// SIGHTING BOOST CONFIGURATION
// =============================================================================

export const SIGHTING_BOOST = {
  // Time decay - how much sightings lose value over time
  WITHIN_1_HOUR: 150,    // Super hot lead
  WITHIN_6_HOURS: 100,   // Fresh lead
  WITHIN_24_HOURS: 60,   // Good lead
  WITHIN_72_HOURS: 30,   // Stale but useful
  OLDER: 10,             // Minimal boost

  // Distance bonus - how close task is to sighting
  WITHIN_QUARTER_MILE: 50,  // Task right where pet was seen
  WITHIN_HALF_MILE: 30,
  WITHIN_1_MILE: 15,
  WITHIN_2_MILES: 5,
};

// =============================================================================
// DIMINISHING RETURNS CONFIGURATION
// =============================================================================

export const DIMINISHING_RETURNS = {
  // How much to penalize repeat tasks
  SAME_TASK_COMPLETED_ONCE: -20,
  SAME_TASK_COMPLETED_TWICE: -50,
  SAME_TASK_COMPLETED_3PLUS: -100,

  // Time window for counting repetitions (in hours)
  REPEAT_WINDOW_HOURS: 48,

  // Similar task categories - completing one reduces value of others
  SEARCH_TASKS: ['search_area', 'dawn_search', 'dusk_search', 'night_flashlight', 'check_hiding'],
  OUTREACH_TASKS: ['post_flyers', 'knock_doors', 'alert_delivery'],
  SHELTER_TASKS: ['call_shelter', 'call_vet'],
};

// =============================================================================
// WEATHER CONFIGURATION
// =============================================================================

export const WEATHER_EFFECTS = {
  // Weather conditions and their impact on tasks
  CLEAR: {
    searchBonus: 20,      // Good visibility, boost searches
    outdoorBonus: 10,
    description: 'Clear weather - ideal for searching',
  },
  CLOUDY: {
    searchBonus: 10,
    outdoorBonus: 5,
    description: 'Cloudy - good for searching',
  },
  RAIN: {
    searchBonus: -30,     // Poor visibility, wet conditions
    outdoorBonus: -40,
    indoorBonus: 20,      // Push indoor/phone tasks
    shelterBonus: 30,     // Pets seek shelter in rain
    description: 'Rain - focus on indoor tasks, pets may seek shelter',
  },
  HEAVY_RAIN: {
    searchBonus: -60,
    outdoorBonus: -80,
    indoorBonus: 40,
    shelterBonus: 50,
    description: 'Heavy rain - stay inside, call shelters',
  },
  SNOW: {
    searchBonus: -40,
    outdoorBonus: -50,
    trackingBonus: 40,    // Can see tracks in snow!
    urgencyMultiplier: 1.3, // More dangerous for pets
    description: 'Snow - tracking possible, increased urgency',
  },
  EXTREME_COLD: {
    searchBonus: -20,
    outdoorBonus: -30,
    urgencyMultiplier: 1.5, // Very dangerous
    shelterBonus: 40,
    description: 'Extreme cold - high urgency, check warm spots',
  },
  EXTREME_HEAT: {
    searchBonus: -20,
    outdoorBonus: -30,
    urgencyMultiplier: 1.4,
    earlyMorningBonus: 30, // Search early before heat
    description: 'Extreme heat - search early morning/evening',
  },
  WINDY: {
    searchBonus: -10,
    scentBonus: -20,       // Wind disperses scent trails
    description: 'Windy - scent-based methods less effective',
  },
};

// Tasks affected by weather
export const WEATHER_TASK_CATEGORIES = {
  OUTDOOR_SEARCH: ['search_area', 'dawn_search', 'dusk_search', 'knock_doors', 'post_flyers'],
  INDOOR_TASKS: ['search_inside', 'call_shelter', 'call_vet', 'notify_microchip', 'share_case'],
  NIGHT_TASKS: ['night_flashlight', 'setup_camera'],
  SCENT_BASED: ['litter_outside', 'scent_clothes'],
  SHELTER_RELATED: ['call_shelter', 'call_vet', 'check_hiding', 'humane_trap'],
};

// =============================================================================
// TASK DEPENDENCIES
// =============================================================================

export const TASK_DEPENDENCIES = {
  // Task ID -> array of tasks that should be done first
  humane_trap: ['search_inside', 'check_hiding'], // Try finding first before trapping
  post_flyers: ['search_area'],                   // Search before posting flyers
  call_shelter: ['notify_microchip'],             // Register microchip first
  knock_doors: ['search_area'],                   // Search yourself first
  share_case: ['scent_clothes', 'litter_outside'], // Set up scent items before going wide
};

// Bonus for completing prerequisite tasks
export const DEPENDENCY_BONUS = {
  ALL_COMPLETE: 30,    // All prerequisites done
  SOME_COMPLETE: 15,   // Some prerequisites done
  NONE_COMPLETE: -20,  // Should do prerequisites first
};

// =============================================================================
// GEOGRAPHIC CLUSTERING
// =============================================================================

export const CLUSTERING_CONFIG = {
  // If user is within this distance of multiple tasks, boost them together
  CLUSTER_RADIUS_MILES: 0.5,
  CLUSTER_BONUS_PER_NEARBY: 10,  // +10 for each nearby task
  MAX_CLUSTER_BONUS: 40,
};

// =============================================================================
// TASK CATEGORIES - For UI organization
// =============================================================================

export const TASK_CATEGORIES = {
  SEARCH: {
    id: 'SEARCH',
    label: 'Search',
    icon: '🔍',
    description: 'Actively look for your pet',
    tasks: ['search_inside', 'search_area', 'dawn_search', 'dusk_search', 'night_flashlight', 'check_hiding'],
  },
  SPREAD_THE_WORD: {
    id: 'SPREAD_THE_WORD',
    label: 'Spread the Word',
    icon: '📢',
    description: 'Get others to help look',
    tasks: ['call_shelter', 'call_vet', 'notify_microchip', 'post_flyers', 'knock_doors', 'alert_delivery', 'share_case'],
  },
  ATTRACT_HOME: {
    id: 'ATTRACT_HOME',
    label: 'Attract Home',
    icon: '🏠',
    description: 'Lure your pet back',
    tasks: ['litter_outside', 'scent_clothes', 'setup_camera', 'humane_trap'],
  },
};

/**
 * Get category for a task
 * @param {string} actionId - The action ID
 * @returns {Object|null} - Category object or null
 */
export function getTaskCategory(actionId) {
  for (const category of Object.values(TASK_CATEGORIES)) {
    if (category.tasks.includes(actionId)) {
      return category;
    }
  }
  return null;
}

/**
 * Group tasks by category
 * @param {Array} tasks - Array of task objects
 * @returns {Object} - Tasks grouped by category ID
 */
export function groupTasksByCategory(tasks) {
  const groups = {
    SEARCH: [],
    SPREAD_THE_WORD: [],
    ATTRACT_HOME: [],
  };

  for (const task of tasks) {
    const category = getTaskCategory(task.actionId);
    if (category) {
      groups[category.id].push(task);
    }
  }

  return groups;
}

/**
 * Get top priority task from each category
 * @param {Array} tasks - Already sorted tasks (highest priority first)
 * @returns {Object} - Top task for each category
 */
export function getTopTaskPerCategory(tasks) {
  const top = {
    SEARCH: null,
    SPREAD_THE_WORD: null,
    ATTRACT_HOME: null,
  };

  for (const task of tasks) {
    const category = getTaskCategory(task.actionId);
    if (category && !top[category.id] && task.status !== 'COMPLETED') {
      top[category.id] = task;
    }
    // Stop when all categories have a top task
    if (top.SEARCH && top.SPREAD_THE_WORD && top.ATTRACT_HOME) break;
  }

  return top;
}

// =============================================================================
// ACTION DEFINITIONS
// =============================================================================

export const ACTION_TYPES = {
  // OWNER-ONLY ACTIONS
  search_inside: {
    id: 'search_inside',
    title: 'Search inside home thoroughly',
    description: 'Check closets, under beds, in boxes, behind appliances, inside walls',
    role: 'OWNER',
    petType: 'CAT',
    phase: 1,
    basePriority: 100,
    whyImportant: 'Cats often hide in unexpected places inside the home',
  },
  litter_outside: {
    id: 'litter_outside',
    title: 'Put litter box outside',
    description: 'Place used litter box near entry points - cats can smell it from far away',
    role: 'OWNER',
    petType: 'CAT',
    phase: 1,
    basePriority: 95,
    whyImportant: 'Cats can smell their litter from up to a mile away',
  },
  scent_clothes: {
    id: 'scent_clothes',
    title: 'Leave worn clothes outside',
    description: 'Place your worn (unwashed) clothing near entry points',
    role: 'OWNER',
    petType: 'BOTH',
    phase: 1,
    basePriority: 90,
    whyImportant: 'Your scent helps them find their way home',
  },
  setup_camera: {
    id: 'setup_camera',
    title: 'Set up camera at food station',
    description: 'Place food outside with a camera to catch nighttime visits',
    role: 'OWNER',
    petType: 'BOTH',
    phase: 2,
    basePriority: 75,
    whyImportant: 'Pets often return at night when it\'s quiet',
  },
  notify_microchip: {
    id: 'notify_microchip',
    title: 'Notify microchip company',
    description: 'Mark your pet as lost in their system',
    role: 'OWNER',
    petType: 'BOTH',
    phase: 2,
    basePriority: 85,
    requiresMicrochip: true,
    whyImportant: 'If found, the chip company contacts you immediately',
  },
  humane_trap: {
    id: 'humane_trap',
    title: 'Set up humane trap',
    description: 'For skittish cats that won\'t approach - use smelly food as bait',
    role: 'OWNER',
    petType: 'CAT',
    phase: 3,
    basePriority: 60,
    requiresSkittish: true,
    whyImportant: 'Scared cats often won\'t come to you, but will enter a trap for food',
  },

  // BOTH OWNER AND SQUAD
  call_shelter: {
    id: 'call_shelter',
    title: 'Call shelter',
    description: 'Ask about new intakes matching your pet',
    role: 'BOTH',
    petType: 'BOTH',
    phase: 2,
    basePriority: 80,
    requiresShelter: true,
    whatToSay: true,
    whyImportant: 'Shelters receive new animals daily',
  },
  call_vet: {
    id: 'call_vet',
    title: 'Call vet clinic',
    description: 'People often bring found pets to vets',
    role: 'BOTH',
    petType: 'BOTH',
    phase: 2,
    basePriority: 70,
    whyImportant: 'Good samaritans often bring found pets to the nearest vet',
  },
  search_area: {
    id: 'search_area',
    title: 'Search area',
    description: 'Physical search of assigned zone',
    role: 'BOTH',
    petType: 'BOTH',
    phase: 1,
    basePriority: 85,
    requiresLocation: true,
    whyImportant: 'Physical searching is the most effective recovery method',
  },
  dawn_search: {
    id: 'dawn_search',
    title: 'Dawn search',
    description: 'Pets are most active at dawn (5-7am)',
    role: 'BOTH',
    petType: 'BOTH',
    phase: 2,
    basePriority: 90,
    timeWindow: { start: 5, end: 7 },
    whyImportant: 'Pets are most active during dawn and dusk',
  },
  dusk_search: {
    id: 'dusk_search',
    title: 'Dusk search',
    description: 'Pets are most active at dusk (5-8pm)',
    role: 'BOTH',
    petType: 'BOTH',
    phase: 2,
    basePriority: 90,
    timeWindow: { start: 17, end: 20 },
    whyImportant: 'Pets are most active during dawn and dusk',
  },
  night_flashlight: {
    id: 'night_flashlight',
    title: 'Flashlight search at night',
    description: 'Cat eyes reflect green/yellow in flashlight beam',
    role: 'BOTH',
    petType: 'CAT',
    phase: 2,
    basePriority: 75,
    timeWindow: { start: 20, end: 5 },
    whyImportant: 'Cat eyes reflect light making them easier to spot at night',
  },
  post_flyers: {
    id: 'post_flyers',
    title: 'Post flyers in area',
    description: 'High-traffic spots: stores, gas stations, vet offices',
    role: 'BOTH',
    petType: 'BOTH',
    phase: 2,
    basePriority: 65,
    requiresLocation: true,
    whyImportant: 'Increases community awareness',
  },
  knock_doors: {
    id: 'knock_doors',
    title: 'Knock on doors',
    description: 'Ask neighbors if they\'ve seen your pet',
    role: 'BOTH',
    petType: 'BOTH',
    phase: 2,
    basePriority: 70,
    requiresLocation: true,
    whyImportant: 'Neighbors may have seen something without realizing it',
  },
  check_hiding: {
    id: 'check_hiding',
    title: 'Check hiding spots',
    description: 'Sheds, garages, under decks, in bushes',
    role: 'BOTH',
    petType: 'CAT',
    phase: 2,
    basePriority: 80,
    whyImportant: 'Cats hide in dark, enclosed spaces when scared',
  },
  alert_delivery: {
    id: 'alert_delivery',
    title: 'Alert delivery people',
    description: 'Mail carriers, Amazon drivers, dog walkers',
    role: 'BOTH',
    petType: 'BOTH',
    phase: 2,
    basePriority: 55,
    whyImportant: 'They cover a lot of ground and notice things',
  },
  share_case: {
    id: 'share_case',
    title: 'Share on social media',
    description: 'Share the case to reach more people',
    role: 'BOTH',
    petType: 'BOTH',
    phase: 1,
    basePriority: 50,
    whyImportant: 'Every share increases the chance someone recognizes your pet',
  },
};

// =============================================================================
// PRIORITY CALCULATION
// =============================================================================

/**
 * Calculate priority score for a task
 *
 * @param {Object} task - The task object
 * @param {Object} caseData - The case data (pet info, time missing, etc.)
 * @param {Object} context - Context (current time, user location, user role, sightings, completedTasks)
 * @returns {number} - Priority score (higher = more urgent)
 */
export function calculatePriorityScore(task, caseData, context = {}) {
  const actionDef = ACTION_TYPES[task.actionId] || {};
  let score = actionDef.basePriority || 50;

  const now = context.currentTime || new Date();
  const hoursMissing = getHoursMissing(caseData.missingAt, now);
  const currentHour = now.getHours();

  // ==========================================================================
  // TIME URGENCY BONUS (first 24 hours are critical)
  // ==========================================================================
  if (hoursMissing <= 2) {
    score += 100; // First 2 hours - highest urgency
  } else if (hoursMissing <= 6) {
    score += 80;
  } else if (hoursMissing <= 12) {
    score += 60;
  } else if (hoursMissing <= 24) {
    score += 40;
  } else if (hoursMissing <= 72) {
    score += 20;
  }
  // After 72 hours, no bonus

  // ==========================================================================
  // TIME OF DAY BONUS
  // ==========================================================================
  if (actionDef.timeWindow) {
    const { start, end } = actionDef.timeWindow;
    if (isInTimeWindow(currentHour, start, end)) {
      score += 50; // Perfect time for this action
    } else if (isWithinHours(currentHour, start, 2) || isWithinHours(currentHour, end, 2)) {
      score += 25; // Close to the window
    }
  }

  // Shelter call bonus if shelter is open now
  if (task.actionId === 'call_shelter' && task.shelter?.hours) {
    if (isShelterOpenNow(task.shelter.hours, now)) {
      score += 50;
    } else {
      score -= 100; // Penalty if closed
    }
  }

  // ==========================================================================
  // STATUS PENALTIES
  // ==========================================================================
  if (task.status === 'IN_PROGRESS') {
    score -= 1000; // Someone's already on it
  }

  if (task.status === 'COMPLETED') {
    const hoursSinceCompletion = getHoursSince(task.completedAt, now);
    if (hoursSinceCompletion < 4) {
      score -= 500; // Recently completed
    } else if (hoursSinceCompletion < 24) {
      score -= 200; // Completed today
    }
  }

  if (task.status === 'BLOCKED') {
    score -= 800; // Can't do this right now
  }

  // ==========================================================================
  // PROXIMITY BONUS
  // ==========================================================================
  if (context.userLocation && task.latitude && task.longitude) {
    const distance = calculateDistance(
      context.userLocation.latitude,
      context.userLocation.longitude,
      task.latitude,
      task.longitude
    );

    if (distance < 0.5) {
      score += 30; // Very close
    } else if (distance < 2) {
      score += 20;
    } else if (distance < 5) {
      score += 10;
    }
  }

  // ==========================================================================
  // PHASE MATCHING
  // ==========================================================================
  const currentPhase = getPhase(hoursMissing);
  if (actionDef.phase === currentPhase) {
    score += 20; // Matches current phase
  } else if (actionDef.phase < currentPhase) {
    score -= 10; // Should have been done earlier
  }

  // ==========================================================================
  // PET TYPE MATCHING
  // ==========================================================================
  if (actionDef.petType !== 'BOTH' && actionDef.petType !== caseData.petType) {
    score -= 1000; // Wrong pet type - hide this task
  }

  // ==========================================================================
  // NEEDS HELP BONUS
  // ==========================================================================
  if (task.needsHelp) {
    score += 40; // Someone requested backup
  }

  // ==========================================================================
  // SIGHTING BOOST - Recent sightings massively boost nearby tasks
  // ==========================================================================
  if (context.sightings?.length > 0 && task.latitude && task.longitude) {
    score += calculateSightingBoost(task, context.sightings, now);
  }

  // ==========================================================================
  // PET-SPECIFIC MODIFIERS - Indoor/outdoor cats, dog sizes
  // ==========================================================================
  score += calculatePetSpecificBonus(task, caseData, actionDef);

  // ==========================================================================
  // HEALTH URGENCY MULTIPLIER - Critical health needs increase all scores
  // ==========================================================================
  const healthMultiplier = getHealthMultiplier(caseData);
  if (healthMultiplier > 1.0) {
    // Apply multiplier to positive scores only (don't make penalties worse)
    if (score > 0) {
      score = Math.round(score * healthMultiplier);
    }
  }

  // ==========================================================================
  // DIMINISHING RETURNS - Repeat tasks get penalized
  // ==========================================================================
  if (context.completedTasks?.length > 0) {
    score += calculateDiminishingReturns(task, context.completedTasks, now);
  }

  // ==========================================================================
  // WEATHER AWARENESS - Adjust based on current conditions
  // ==========================================================================
  if (context.weather) {
    score += calculateWeatherBonus(task, context.weather, currentHour);
  }

  // ==========================================================================
  // TASK DEPENDENCIES - Boost tasks whose prerequisites are complete
  // ==========================================================================
  if (context.completedTasks?.length > 0) {
    score += calculateDependencyBonus(task, context.completedTasks);
  }

  // ==========================================================================
  // GEOGRAPHIC CLUSTERING - Boost tasks near other pending tasks
  // ==========================================================================
  if (context.allTasks?.length > 0 && task.latitude && task.longitude) {
    score += calculateClusterBonus(task, context.allTasks);
  }

  return Math.max(0, score);
}

/**
 * Calculate priority score WITH detailed breakdown for debugging
 *
 * @param {Object} task - The task object
 * @param {Object} caseData - The case data (pet info, time missing, etc.)
 * @param {Object} context - Context (current time, user location, user role)
 * @returns {Object} - { score: number, breakdown: Array<{label, value, description}> }
 */
export function calculatePriorityScoreWithBreakdown(task, caseData, context = {}) {
  const actionDef = ACTION_TYPES[task.actionId] || {};
  const breakdown = [];

  const now = context.currentTime || new Date();
  const hoursMissing = getHoursMissing(caseData.missingAt, now);
  const currentHour = now.getHours();

  // Base priority
  const basePriority = actionDef.basePriority || 50;
  breakdown.push({
    label: 'Base priority',
    value: basePriority,
    description: `Action type: ${task.actionId}`,
  });

  // Time urgency bonus
  let timeUrgencyBonus = 0;
  let timeUrgencyDesc = '';
  if (hoursMissing <= 2) {
    timeUrgencyBonus = 100;
    timeUrgencyDesc = `${hoursMissing.toFixed(1)}h (0-2h: critical)`;
  } else if (hoursMissing <= 6) {
    timeUrgencyBonus = 80;
    timeUrgencyDesc = `${hoursMissing.toFixed(1)}h (2-6h: urgent)`;
  } else if (hoursMissing <= 12) {
    timeUrgencyBonus = 60;
    timeUrgencyDesc = `${hoursMissing.toFixed(1)}h (6-12h)`;
  } else if (hoursMissing <= 24) {
    timeUrgencyBonus = 40;
    timeUrgencyDesc = `${hoursMissing.toFixed(1)}h (12-24h)`;
  } else if (hoursMissing <= 72) {
    timeUrgencyBonus = 20;
    timeUrgencyDesc = `${hoursMissing.toFixed(1)}h (24-72h)`;
  } else {
    timeUrgencyDesc = `${hoursMissing.toFixed(1)}h (>72h: no bonus)`;
  }
  breakdown.push({
    label: 'Time urgency',
    value: timeUrgencyBonus,
    description: timeUrgencyDesc,
  });

  // Time of day bonus
  let timeOfDayBonus = 0;
  let timeOfDayDesc = `Current: ${currentHour}:00`;
  if (actionDef.timeWindow) {
    const { start, end } = actionDef.timeWindow;
    if (isInTimeWindow(currentHour, start, end)) {
      timeOfDayBonus = 50;
      timeOfDayDesc = `In window ${start}-${end} (perfect!)`;
    } else if (isWithinHours(currentHour, start, 2) || isWithinHours(currentHour, end, 2)) {
      timeOfDayBonus = 25;
      timeOfDayDesc = `Near window ${start}-${end}`;
    } else {
      timeOfDayDesc = `Outside window ${start}-${end}`;
    }
  }
  breakdown.push({
    label: 'Time of day',
    value: timeOfDayBonus,
    description: timeOfDayDesc,
  });

  // Shelter open/closed
  let shelterBonus = 0;
  if (task.actionId === 'call_shelter' && task.shelter?.hours) {
    if (isShelterOpenNow(task.shelter.hours, now)) {
      shelterBonus = 50;
      breakdown.push({
        label: 'Shelter open',
        value: shelterBonus,
        description: 'Open now!',
      });
    } else {
      shelterBonus = -100;
      breakdown.push({
        label: 'Shelter closed',
        value: shelterBonus,
        description: 'Currently closed',
      });
    }
  }

  // Status penalties
  let statusPenalty = 0;
  if (task.status === 'IN_PROGRESS') {
    statusPenalty = -1000;
    breakdown.push({
      label: 'In progress',
      value: statusPenalty,
      description: 'Someone working on it',
    });
  } else if (task.status === 'COMPLETED') {
    const hoursSinceCompletion = getHoursSince(task.completedAt, now);
    if (hoursSinceCompletion < 4) {
      statusPenalty = -500;
      breakdown.push({
        label: 'Recently done',
        value: statusPenalty,
        description: `${hoursSinceCompletion.toFixed(1)}h ago`,
      });
    } else if (hoursSinceCompletion < 24) {
      statusPenalty = -200;
      breakdown.push({
        label: 'Done today',
        value: statusPenalty,
        description: `${hoursSinceCompletion.toFixed(1)}h ago`,
      });
    }
  } else if (task.status === 'BLOCKED') {
    statusPenalty = -800;
    breakdown.push({
      label: 'Blocked',
      value: statusPenalty,
      description: task.blockedReason || 'Cannot proceed',
    });
  }

  // Proximity bonus
  let proximityBonus = 0;
  let proximityDesc = 'No location data';
  if (context.userLocation && task.latitude && task.longitude) {
    const distance = calculateDistance(
      context.userLocation.latitude,
      context.userLocation.longitude,
      task.latitude,
      task.longitude
    );
    proximityDesc = `${distance.toFixed(1)} mi away`;

    if (distance < 0.5) {
      proximityBonus = 30;
      proximityDesc += ' (very close!)';
    } else if (distance < 2) {
      proximityBonus = 20;
      proximityDesc += ' (nearby)';
    } else if (distance < 5) {
      proximityBonus = 10;
      proximityDesc += ' (in area)';
    }
  } else if (context.simulatedProximity !== undefined) {
    // Debug mode with simulated proximity
    const distance = context.simulatedProximity;
    proximityDesc = `${distance.toFixed(1)} mi (simulated)`;
    if (distance < 0.5) {
      proximityBonus = 30;
    } else if (distance < 2) {
      proximityBonus = 20;
    } else if (distance < 5) {
      proximityBonus = 10;
    }
  }
  breakdown.push({
    label: 'Proximity',
    value: proximityBonus,
    description: proximityDesc,
  });

  // Phase matching
  const currentPhase = getPhase(hoursMissing);
  let phaseBonus = 0;
  let phaseDesc = `Action: P${actionDef.phase}, Current: P${currentPhase}`;
  if (actionDef.phase === currentPhase) {
    phaseBonus = 20;
    phaseDesc += ' (match!)';
  } else if (actionDef.phase < currentPhase) {
    phaseBonus = -10;
    phaseDesc += ' (overdue)';
  }
  breakdown.push({
    label: 'Phase match',
    value: phaseBonus,
    description: phaseDesc,
  });

  // Pet type penalty
  let petTypePenalty = 0;
  if (actionDef.petType !== 'BOTH' && actionDef.petType !== caseData.petType) {
    petTypePenalty = -1000;
    breakdown.push({
      label: 'Wrong pet type',
      value: petTypePenalty,
      description: `Action for ${actionDef.petType}, pet is ${caseData.petType}`,
    });
  }

  // Needs help bonus
  let needsHelpBonus = 0;
  if (task.needsHelp) {
    needsHelpBonus = 40;
    breakdown.push({
      label: 'Needs help',
      value: needsHelpBonus,
      description: 'Someone requested backup',
    });
  }

  // ==========================================================================
  // SIGHTING BOOST
  // ==========================================================================
  let sightingBoost = 0;
  if (context.sightings?.length > 0 && task.latitude && task.longitude) {
    const sightingResult = calculateSightingBoostWithDetails(task, context.sightings, now);
    sightingBoost = sightingResult.boost;
    if (sightingBoost > 0) {
      breakdown.push({
        label: 'Sighting boost',
        value: sightingBoost,
        description: sightingResult.description,
      });
    }
  }

  // ==========================================================================
  // PET-SPECIFIC MODIFIERS
  // ==========================================================================
  const petSpecificResult = calculatePetSpecificBonusWithDetails(task, caseData, actionDef);
  let petSpecificBonus = petSpecificResult.bonus;
  if (petSpecificBonus !== 0) {
    breakdown.push({
      label: 'Pet behavior',
      value: petSpecificBonus,
      description: petSpecificResult.description,
    });
  }

  // ==========================================================================
  // HEALTH URGENCY
  // ==========================================================================
  const healthMultiplier = getHealthMultiplier(caseData);
  let healthBonus = 0;
  if (healthMultiplier > 1.0) {
    // Calculate what the multiplier adds
    const baseTotal = basePriority + timeUrgencyBonus + timeOfDayBonus + shelterBonus +
      statusPenalty + proximityBonus + phaseBonus + petTypePenalty + needsHelpBonus +
      sightingBoost + petSpecificBonus;
    if (baseTotal > 0) {
      healthBonus = Math.round(baseTotal * (healthMultiplier - 1));
      breakdown.push({
        label: 'Health urgency',
        value: healthBonus,
        description: `${healthMultiplier}x multiplier (${caseData.healthCondition || 'medical need'})`,
      });
    }
  }

  // ==========================================================================
  // DIMINISHING RETURNS
  // ==========================================================================
  let diminishingPenalty = 0;
  if (context.completedTasks?.length > 0) {
    const diminishingResult = calculateDiminishingReturnsWithDetails(task, context.completedTasks, now);
    diminishingPenalty = diminishingResult.penalty;
    if (diminishingPenalty !== 0) {
      breakdown.push({
        label: 'Repeat penalty',
        value: diminishingPenalty,
        description: diminishingResult.description,
      });
    }
  }

  // ==========================================================================
  // WEATHER AWARENESS
  // ==========================================================================
  let weatherBonus = 0;
  if (context.weather) {
    const weatherResult = calculateWeatherBonusWithDetails(task, context.weather, currentHour);
    weatherBonus = weatherResult.bonus;
    if (weatherBonus !== 0) {
      breakdown.push({
        label: 'Weather',
        value: weatherBonus,
        description: weatherResult.description,
      });
    }
  }

  // ==========================================================================
  // TASK DEPENDENCIES
  // ==========================================================================
  let dependencyBonus = 0;
  if (context.completedTasks?.length > 0) {
    const depResult = calculateDependencyBonusWithDetails(task, context.completedTasks);
    dependencyBonus = depResult.bonus;
    if (dependencyBonus !== 0) {
      breakdown.push({
        label: 'Prerequisites',
        value: dependencyBonus,
        description: depResult.description,
      });
    }
  }

  // ==========================================================================
  // GEOGRAPHIC CLUSTERING
  // ==========================================================================
  let clusterBonus = 0;
  if (context.allTasks?.length > 0 && task.latitude && task.longitude) {
    const clusterResult = calculateClusterBonusWithDetails(task, context.allTasks);
    clusterBonus = clusterResult.bonus;
    if (clusterBonus > 0) {
      breakdown.push({
        label: 'Nearby tasks',
        value: clusterBonus,
        description: clusterResult.description,
      });
    }
  }

  // Calculate total
  const total = basePriority + timeUrgencyBonus + timeOfDayBonus + shelterBonus +
    statusPenalty + proximityBonus + phaseBonus + petTypePenalty + needsHelpBonus +
    sightingBoost + petSpecificBonus + healthBonus + diminishingPenalty +
    weatherBonus + dependencyBonus + clusterBonus;

  return {
    score: Math.max(0, total),
    breakdown,
  };
}

// =============================================================================
// TASK GENERATION
// =============================================================================

/**
 * Generate tasks for a case based on pet type, phase, and available resources
 *
 * @param {Object} caseData - The case data
 * @param {Array} shelters - Nearby shelters
 * @param {Object} existingTasks - Map of existing tasks by actionId
 * @returns {Array} - Array of task objects to create
 */
export function generateTasksForCase(caseData, shelters = [], existingTasks = {}) {
  const tasks = [];
  const hoursMissing = getHoursMissing(caseData.missingAt);
  const currentPhase = getPhase(hoursMissing);

  // Generate tasks from action definitions
  for (const [actionId, actionDef] of Object.entries(ACTION_TYPES)) {
    // Skip if wrong pet type
    if (actionDef.petType !== 'BOTH' && actionDef.petType !== caseData.petType) {
      continue;
    }

    // Skip if action phase is too far in future
    if (actionDef.phase > currentPhase + 1) {
      continue;
    }

    // Skip if requires microchip but pet isn't chipped
    if (actionDef.requiresMicrochip && !caseData.isMicrochipped) {
      continue;
    }

    // Skip if requires skittish but pet isn't skittish
    if (actionDef.requiresSkittish && caseData.temperament !== 'SKITTISH') {
      continue;
    }

    // Handle shelter-specific tasks
    if (actionDef.requiresShelter) {
      for (const shelter of shelters) {
        const taskId = `${actionId}_${shelter.id}`;
        if (!existingTasks[taskId]) {
          tasks.push({
            actionId,
            title: `Call ${shelter.name}`,
            description: actionDef.description,
            role: actionDef.role,
            petType: actionDef.petType,
            phase: actionDef.phase,
            shelterId: shelter.id,
            latitude: shelter.latitude,
            longitude: shelter.longitude,
            address: `${shelter.address}, ${shelter.city}, ${shelter.state}`,
          });
        }
      }
      continue;
    }

    // Regular task
    if (!existingTasks[actionId]) {
      tasks.push({
        actionId,
        title: actionDef.title,
        description: actionDef.description,
        role: actionDef.role,
        petType: actionDef.petType,
        phase: actionDef.phase,
        latitude: caseData.lastSeenLatitude,
        longitude: caseData.lastSeenLongitude,
      });
    }
  }

  return tasks;
}

/**
 * Sort tasks by priority score
 *
 * @param {Array} tasks - Array of tasks
 * @param {Object} caseData - Case data
 * @param {Object} context - Context (user location, current time, etc.)
 * @returns {Array} - Sorted tasks with priority scores
 */
export function sortTasksByPriority(tasks, caseData, context = {}) {
  return tasks
    .map(task => ({
      ...task,
      priorityScore: calculatePriorityScore(task, caseData, context),
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Get tasks filtered by user role
 *
 * @param {Array} tasks - All tasks
 * @param {string} userRole - OWNER or SQUAD
 * @returns {Object} - { ownerTasks, squadTasks }
 */
export function filterTasksByRole(tasks, userRole) {
  const ownerTasks = tasks.filter(t =>
    t.role === 'OWNER' || t.role === 'BOTH'
  );

  const squadTasks = tasks.filter(t =>
    t.role === 'SQUAD' || t.role === 'BOTH'
  );

  return { ownerTasks, squadTasks };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getHoursMissing(missingAt, now = new Date()) {
  if (!missingAt) return 0;
  const missingTime = new Date(missingAt);
  return (now - missingTime) / (1000 * 60 * 60);
}

function getHoursSince(date, now = new Date()) {
  if (!date) return Infinity;
  return (now - new Date(date)) / (1000 * 60 * 60);
}

function getPhase(hoursMissing) {
  if (hoursMissing <= 2) return 1;
  if (hoursMissing <= 24) return 2;
  if (hoursMissing <= 72) return 3;
  if (hoursMissing <= 168) return 4;
  return 5;
}

function isInTimeWindow(currentHour, start, end) {
  if (start <= end) {
    return currentHour >= start && currentHour < end;
  }
  // Wraps around midnight (e.g., 20-5)
  return currentHour >= start || currentHour < end;
}

function isWithinHours(currentHour, targetHour, range) {
  const diff = Math.abs(currentHour - targetHour);
  return diff <= range || diff >= 24 - range;
}

function isShelterOpenNow(hoursJson, now = new Date()) {
  try {
    const hours = typeof hoursJson === 'string' ? JSON.parse(hoursJson) : hoursJson;
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const today = dayNames[now.getDay()];
    const todayHours = hours[today];

    if (!todayHours || todayHours === 'closed') return false;

    const currentTime = now.getHours() * 100 + now.getMinutes();
    const [openStr, closeStr] = todayHours.split('-');

    const openTime = parseTime(openStr);
    const closeTime = parseTime(closeStr);

    return currentTime >= openTime && currentTime < closeTime;
  } catch {
    return true; // Assume open if we can't parse
  }
}

function parseTime(timeStr) {
  const [hours, minutes] = timeStr.trim().split(':').map(Number);
  return hours * 100 + (minutes || 0);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// =============================================================================
// SIGHTING BOOST HELPERS
// =============================================================================

/**
 * Calculate boost from recent sightings
 * @param {Object} task - Task with lat/lng
 * @param {Array} sightings - Array of sighting objects with {latitude, longitude, reportedAt}
 * @param {Date} now - Current time
 * @returns {number} - Boost amount
 */
function calculateSightingBoost(task, sightings, now) {
  return calculateSightingBoostWithDetails(task, sightings, now).boost;
}

/**
 * Calculate boost from recent sightings with explanation
 */
function calculateSightingBoostWithDetails(task, sightings, now) {
  if (!sightings || sightings.length === 0) {
    return { boost: 0, description: 'No sightings' };
  }

  let maxBoost = 0;
  let bestSighting = null;
  let bestDistance = Infinity;
  let bestHoursAgo = Infinity;

  for (const sighting of sightings) {
    if (!sighting.latitude || !sighting.longitude) continue;

    const distance = calculateDistance(
      task.latitude,
      task.longitude,
      sighting.latitude,
      sighting.longitude
    );

    const hoursAgo = getHoursSince(sighting.reportedAt, now);

    // Calculate time-based boost
    let timeBoost = 0;
    if (hoursAgo <= 1) {
      timeBoost = SIGHTING_BOOST.WITHIN_1_HOUR;
    } else if (hoursAgo <= 6) {
      timeBoost = SIGHTING_BOOST.WITHIN_6_HOURS;
    } else if (hoursAgo <= 24) {
      timeBoost = SIGHTING_BOOST.WITHIN_24_HOURS;
    } else if (hoursAgo <= 72) {
      timeBoost = SIGHTING_BOOST.WITHIN_72_HOURS;
    } else {
      timeBoost = SIGHTING_BOOST.OLDER;
    }

    // Calculate distance-based boost
    let distanceBoost = 0;
    if (distance <= 0.25) {
      distanceBoost = SIGHTING_BOOST.WITHIN_QUARTER_MILE;
    } else if (distance <= 0.5) {
      distanceBoost = SIGHTING_BOOST.WITHIN_HALF_MILE;
    } else if (distance <= 1) {
      distanceBoost = SIGHTING_BOOST.WITHIN_1_MILE;
    } else if (distance <= 2) {
      distanceBoost = SIGHTING_BOOST.WITHIN_2_MILES;
    }

    const totalBoost = timeBoost + distanceBoost;

    if (totalBoost > maxBoost) {
      maxBoost = totalBoost;
      bestSighting = sighting;
      bestDistance = distance;
      bestHoursAgo = hoursAgo;
    }
  }

  if (maxBoost === 0) {
    return { boost: 0, description: 'No nearby sightings' };
  }

  const timeDesc = bestHoursAgo < 1 ? 'just now' :
    bestHoursAgo < 24 ? `${Math.round(bestHoursAgo)}h ago` :
    `${Math.round(bestHoursAgo / 24)}d ago`;

  return {
    boost: maxBoost,
    description: `Sighting ${bestDistance.toFixed(1)}mi away, ${timeDesc}`,
    sighting: bestSighting,
  };
}

// =============================================================================
// PET-SPECIFIC MODIFIER HELPERS
// =============================================================================

/**
 * Calculate bonus based on pet profile and task type
 */
function calculatePetSpecificBonus(task, caseData, actionDef) {
  return calculatePetSpecificBonusWithDetails(task, caseData, actionDef).bonus;
}

/**
 * Calculate pet-specific bonus with explanation
 */
function calculatePetSpecificBonusWithDetails(task, caseData, actionDef) {
  let bonus = 0;
  let reasons = [];

  const petType = caseData.petType || 'CAT';
  const isIndoor = caseData.isIndoor ?? true; // Default to indoor
  const petSize = caseData.petSize || 'MEDIUM';

  if (petType === 'CAT') {
    const profile = isIndoor ? PET_PROFILES.CAT.INDOOR : PET_PROFILES.CAT.OUTDOOR;

    // Indoor cats: boost close-range search tasks
    if (isIndoor) {
      if (task.actionId === 'check_hiding' || task.actionId === 'search_inside') {
        bonus += 40;
        reasons.push('Indoor cat hides close');
      }
      if (task.actionId === 'night_flashlight' || task.actionId === 'litter_outside') {
        bonus += 30;
        reasons.push('High return likelihood');
      }
      // Penalize wide-area tasks for indoor cats
      if (task.actionId === 'post_flyers' || task.actionId === 'knock_doors') {
        bonus -= 15;
        reasons.push('Indoor cat unlikely far');
      }
    } else {
      // Outdoor cats: boost wider area coverage
      if (task.actionId === 'search_area' || task.actionId === 'knock_doors') {
        bonus += 25;
        reasons.push('Outdoor cat roams');
      }
      if (task.actionId === 'call_shelter') {
        bonus += 20;
        reasons.push('May be picked up');
      }
    }

    // All cats: boost dusk/dawn searches
    if (task.actionId === 'dawn_search' || task.actionId === 'dusk_search') {
      bonus += 20;
      reasons.push('Cats active dusk/dawn');
    }

  } else if (petType === 'DOG') {
    const profile = PET_PROFILES.DOG[petSize] || PET_PROFILES.DOG.MEDIUM;

    // Small dogs: more vulnerable, urgent searches
    if (petSize === 'SMALL') {
      if (task.actionId === 'search_area' || task.actionId === 'call_shelter') {
        bonus += 35;
        reasons.push('Small dog vulnerable');
      }
      // Small dogs don't go far
      if (task.actionId === 'post_flyers') {
        bonus -= 10;
        reasons.push('Small dog stays close');
      }
    }

    // Large dogs: can travel far, widen search
    if (petSize === 'LARGE') {
      if (task.actionId === 'post_flyers' || task.actionId === 'call_shelter') {
        bonus += 25;
        reasons.push('Large dog travels far');
      }
      if (task.actionId === 'knock_doors') {
        bonus += 20;
        reasons.push('May be taken in');
      }
    }

    // All dogs: boost active search tasks
    if (task.actionId === 'dawn_search' || task.actionId === 'dusk_search') {
      bonus += 15;
      reasons.push('Dogs active search times');
    }
  }

  // Skittish pet modifier
  if (caseData.temperament === 'SKITTISH') {
    if (task.actionId === 'humane_trap' || task.actionId === 'night_flashlight') {
      bonus += 30;
      reasons.push('Skittish - indirect methods');
    }
    if (task.actionId === 'knock_doors' || task.actionId === 'search_area') {
      bonus -= 10;
      reasons.push('Skittish - avoid direct approach');
    }
  }

  return {
    bonus,
    description: reasons.length > 0 ? reasons.join(', ') : 'Standard',
  };
}

/**
 * Get health urgency multiplier from case data
 */
function getHealthMultiplier(caseData) {
  const condition = caseData.healthCondition || caseData.healthUrgency;
  if (!condition) return HEALTH_URGENCY.NONE;

  // Map condition strings to multipliers
  const conditionMap = {
    'none': HEALTH_URGENCY.NONE,
    'medication_daily': HEALTH_URGENCY.MEDICATION_DAILY,
    'medication_critical': HEALTH_URGENCY.MEDICATION_CRITICAL,
    'senior': HEALTH_URGENCY.SENIOR,
    'puppy': HEALTH_URGENCY.PUPPY_KITTEN,
    'kitten': HEALTH_URGENCY.PUPPY_KITTEN,
    'medical': HEALTH_URGENCY.MEDICAL_CONDITION,
  };

  const normalized = condition.toLowerCase().replace(/[_\s]/g, '_');

  // Check for matches
  for (const [key, value] of Object.entries(conditionMap)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  // Direct lookup
  return HEALTH_URGENCY[condition] || HEALTH_URGENCY.NONE;
}

// =============================================================================
// DIMINISHING RETURNS HELPERS
// =============================================================================

/**
 * Calculate penalty for repeat tasks
 */
function calculateDiminishingReturns(task, completedTasks, now) {
  return calculateDiminishingReturnsWithDetails(task, completedTasks, now).penalty;
}

/**
 * Calculate diminishing returns with explanation
 */
function calculateDiminishingReturnsWithDetails(task, completedTasks, now) {
  if (!completedTasks || completedTasks.length === 0) {
    return { penalty: 0, description: 'No history' };
  }

  const windowHours = DIMINISHING_RETURNS.REPEAT_WINDOW_HOURS;
  const taskActionId = task.actionId;

  // Count same-task completions within window
  const sameTaskCount = completedTasks.filter(ct => {
    if (ct.actionId !== taskActionId) return false;
    const hoursAgo = getHoursSince(ct.completedAt, now);
    return hoursAgo <= windowHours;
  }).length;

  // Count similar category completions
  let categoryCount = 0;
  const taskCategory = getDiminishingReturnsCategory(taskActionId);
  if (taskCategory) {
    categoryCount = completedTasks.filter(ct => {
      if (ct.actionId === taskActionId) return false; // Already counted above
      const ctCategory = getDiminishingReturnsCategory(ct.actionId);
      if (ctCategory !== taskCategory) return false;
      const hoursAgo = getHoursSince(ct.completedAt, now);
      return hoursAgo <= windowHours;
    }).length;
  }

  // Calculate penalty
  let penalty = 0;
  let reasons = [];

  if (sameTaskCount >= 3) {
    penalty += DIMINISHING_RETURNS.SAME_TASK_COMPLETED_3PLUS;
    reasons.push(`Done ${sameTaskCount}x`);
  } else if (sameTaskCount === 2) {
    penalty += DIMINISHING_RETURNS.SAME_TASK_COMPLETED_TWICE;
    reasons.push('Done twice');
  } else if (sameTaskCount === 1) {
    penalty += DIMINISHING_RETURNS.SAME_TASK_COMPLETED_ONCE;
    reasons.push('Done once');
  }

  // Smaller penalty for similar category tasks
  if (categoryCount > 0) {
    const categoryPenalty = Math.min(categoryCount * -5, -25);
    penalty += categoryPenalty;
    reasons.push(`${categoryCount} similar`);
  }

  return {
    penalty,
    description: reasons.length > 0 ? reasons.join(', ') : 'Fresh task',
  };
}

/**
 * Get task category for diminishing returns (internal helper)
 */
function getDiminishingReturnsCategory(actionId) {
  for (const [category, actions] of Object.entries(DIMINISHING_RETURNS)) {
    if (Array.isArray(actions) && actions.includes(actionId)) {
      return category;
    }
  }
  return null;
}

// =============================================================================
// WEATHER HELPERS
// =============================================================================

/**
 * Calculate weather-based bonus for a task
 */
function calculateWeatherBonus(task, weather, currentHour) {
  return calculateWeatherBonusWithDetails(task, weather, currentHour).bonus;
}

/**
 * Calculate weather bonus with explanation
 */
function calculateWeatherBonusWithDetails(task, weather, currentHour) {
  if (!weather) return { bonus: 0, description: 'No weather data' };

  const weatherConfig = WEATHER_EFFECTS[weather] || WEATHER_EFFECTS.CLEAR;
  let bonus = 0;
  let reasons = [];
  const taskId = task.actionId;

  // Check if task is in specific categories
  const isOutdoorSearch = WEATHER_TASK_CATEGORIES.OUTDOOR_SEARCH.includes(taskId);
  const isIndoorTask = WEATHER_TASK_CATEGORIES.INDOOR_TASKS.includes(taskId);
  const isScentBased = WEATHER_TASK_CATEGORIES.SCENT_BASED.includes(taskId);
  const isShelterRelated = WEATHER_TASK_CATEGORIES.SHELTER_RELATED.includes(taskId);
  const isNightTask = WEATHER_TASK_CATEGORIES.NIGHT_TASKS.includes(taskId);

  // Apply outdoor search bonus/penalty
  if (isOutdoorSearch && weatherConfig.searchBonus) {
    bonus += weatherConfig.searchBonus;
    if (weatherConfig.searchBonus > 0) {
      reasons.push('Good search weather');
    } else {
      reasons.push('Poor search conditions');
    }
  }

  // Apply outdoor bonus/penalty
  if (isOutdoorSearch && weatherConfig.outdoorBonus) {
    bonus += weatherConfig.outdoorBonus;
  }

  // Apply indoor bonus
  if (isIndoorTask && weatherConfig.indoorBonus) {
    bonus += weatherConfig.indoorBonus;
    reasons.push('Focus on indoor tasks');
  }

  // Apply shelter bonus (pets seek shelter in bad weather)
  if (isShelterRelated && weatherConfig.shelterBonus) {
    bonus += weatherConfig.shelterBonus;
    reasons.push('Pets seek shelter');
  }

  // Apply scent penalty in wind
  if (isScentBased && weatherConfig.scentBonus) {
    bonus += weatherConfig.scentBonus;
    reasons.push('Wind affects scent');
  }

  // Snow tracking bonus
  if (weather === 'SNOW' && (taskId === 'search_area' || taskId === 'dawn_search')) {
    bonus += weatherConfig.trackingBonus || 0;
    reasons.push('Can track in snow!');
  }

  // Early morning bonus in extreme heat
  if (weather === 'EXTREME_HEAT' && currentHour >= 5 && currentHour <= 8) {
    if (isOutdoorSearch) {
      bonus += weatherConfig.earlyMorningBonus || 0;
      reasons.push('Early - before heat');
    }
  }

  return {
    bonus,
    description: reasons.length > 0 ? reasons.join(', ') : weatherConfig.description,
  };
}

// =============================================================================
// TASK DEPENDENCY HELPERS
// =============================================================================

/**
 * Calculate dependency bonus
 */
function calculateDependencyBonus(task, completedTasks) {
  return calculateDependencyBonusWithDetails(task, completedTasks).bonus;
}

/**
 * Calculate dependency bonus with explanation
 */
function calculateDependencyBonusWithDetails(task, completedTasks) {
  const dependencies = TASK_DEPENDENCIES[task.actionId];

  // No dependencies for this task
  if (!dependencies || dependencies.length === 0) {
    return { bonus: 0, description: 'No prerequisites' };
  }

  // Check which dependencies are complete
  const completedActionIds = new Set(completedTasks.map(t => t.actionId));
  const completedDeps = dependencies.filter(dep => completedActionIds.has(dep));

  if (completedDeps.length === dependencies.length) {
    return {
      bonus: DEPENDENCY_BONUS.ALL_COMPLETE,
      description: `All ${dependencies.length} prerequisites done`,
    };
  } else if (completedDeps.length > 0) {
    return {
      bonus: DEPENDENCY_BONUS.SOME_COMPLETE,
      description: `${completedDeps.length}/${dependencies.length} prerequisites done`,
    };
  } else {
    return {
      bonus: DEPENDENCY_BONUS.NONE_COMPLETE,
      description: `Do ${dependencies.join(', ')} first`,
    };
  }
}

// =============================================================================
// GEOGRAPHIC CLUSTERING HELPERS
// =============================================================================

/**
 * Calculate cluster bonus
 */
function calculateClusterBonus(task, allTasks) {
  return calculateClusterBonusWithDetails(task, allTasks).bonus;
}

/**
 * Calculate cluster bonus with explanation
 */
function calculateClusterBonusWithDetails(task, allTasks) {
  if (!task.latitude || !task.longitude || !allTasks || allTasks.length === 0) {
    return { bonus: 0, description: 'No location data' };
  }

  // Count nearby pending tasks (not completed, not this task)
  let nearbyCount = 0;
  const nearbyTasks = [];

  for (const otherTask of allTasks) {
    // Skip self and completed tasks
    if (otherTask.id === task.id) continue;
    if (otherTask.status === 'COMPLETED' || otherTask.status === 'IN_PROGRESS') continue;
    if (!otherTask.latitude || !otherTask.longitude) continue;

    const distance = calculateDistance(
      task.latitude,
      task.longitude,
      otherTask.latitude,
      otherTask.longitude
    );

    if (distance <= CLUSTERING_CONFIG.CLUSTER_RADIUS_MILES) {
      nearbyCount++;
      nearbyTasks.push(otherTask.actionId);
    }
  }

  if (nearbyCount === 0) {
    return { bonus: 0, description: 'No nearby tasks' };
  }

  const bonus = Math.min(
    nearbyCount * CLUSTERING_CONFIG.CLUSTER_BONUS_PER_NEARBY,
    CLUSTERING_CONFIG.MAX_CLUSTER_BONUS
  );

  return {
    bonus,
    description: `${nearbyCount} task${nearbyCount > 1 ? 's' : ''} within ${CLUSTERING_CONFIG.CLUSTER_RADIUS_MILES}mi`,
  };
}

/**
 * Generate "Why this is #1" explanation for a task
 */
export function generateWhyExplanation(task, caseData, context = {}) {
  const reasons = [];
  const actionDef = ACTION_TYPES[task.actionId] || {};
  const hoursMissing = getHoursMissing(caseData.missingAt);
  const currentHour = context.currentTime?.getHours() || new Date().getHours();

  // Time urgency
  if (hoursMissing <= 2) {
    reasons.push(`It's only been ${Math.round(hoursMissing * 60)} minutes - act fast!`);
  } else if (hoursMissing <= 24) {
    reasons.push(`First 24 hours are critical`);
  }

  // Time of day
  if (actionDef.timeWindow) {
    const { start, end } = actionDef.timeWindow;
    if (isInTimeWindow(currentHour, start, end)) {
      reasons.push(`Perfect time for this action (${start}:00-${end}:00)`);
    }
  }

  // Shelter specific
  if (task.shelter) {
    if (task.distance) {
      reasons.push(`Closest shelter (${task.distance.toFixed(1)} mi away)`);
    }
    if (isShelterOpenNow(task.shelter.hours)) {
      reasons.push(`Open now`);
    }
  }

  // Status
  if (task.status === 'AVAILABLE') {
    reasons.push(`No one has done this yet`);
  }

  // Needs help
  if (task.needsHelp) {
    reasons.push(`Someone requested backup on this`);
  }

  // Base reason from action definition
  if (actionDef.whyImportant) {
    reasons.push(actionDef.whyImportant);
  }

  return reasons;
}

/**
 * Generate "What to say" script for shelter calls
 */
export function generateCallScript(task, caseData) {
  if (task.actionId !== 'call_shelter') return null;

  const petType = caseData.petType?.toLowerCase() || 'pet';
  const breed = caseData.petBreed || '';
  const color = caseData.petColor || '';
  const name = caseData.petName || '';
  const location = caseData.lastSeenAddress || caseData.lastSeenCity || 'the area';

  const timeSince = getHoursMissing(caseData.missingAt);
  let timeDesc;
  if (timeSince < 1) {
    timeDesc = 'within the last hour';
  } else if (timeSince < 24) {
    timeDesc = `about ${Math.round(timeSince)} hours ago`;
  } else {
    const days = Math.round(timeSince / 24);
    timeDesc = `about ${days} day${days > 1 ? 's' : ''} ago`;
  }

  return `"Hi, I'm looking for a lost ${petType}. ${breed ? breed + ', ' : ''}${color ? color + ', ' : ''}${name ? 'named ' + name + ', ' : ''}lost near ${location} ${timeDesc}. Have you had any ${petType}s brought in recently?"`;
}

export default {
  ACTION_TYPES,
  PET_PROFILES,
  HEALTH_URGENCY,
  SIGHTING_BOOST,
  DIMINISHING_RETURNS,
  WEATHER_EFFECTS,
  WEATHER_TASK_CATEGORIES,
  TASK_DEPENDENCIES,
  DEPENDENCY_BONUS,
  CLUSTERING_CONFIG,
  TASK_CATEGORIES,
  calculatePriorityScore,
  calculatePriorityScoreWithBreakdown,
  generateTasksForCase,
  sortTasksByPriority,
  filterTasksByRole,
  generateWhyExplanation,
  generateCallScript,
  getTaskCategory,
  groupTasksByCategory,
  getTopTaskPerCategory,
};
