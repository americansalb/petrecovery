/**
 * Task Priority Algorithm
 *
 * Calculates priority scores for rescue tasks based on:
 * - Time urgency (first 24hrs most critical)
 * - Time of day (shelters open, dawn/dusk search windows)
 * - Task status (not done yet, in progress, recently completed)
 * - User proximity (nearby tasks ranked higher)
 * - Pet type and phase-specific bonuses
 */

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
 * @param {Object} context - Context (current time, user location, user role)
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

  return Math.max(0, score);
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
  calculatePriorityScore,
  generateTasksForCase,
  sortTasksByPriority,
  filterTasksByRole,
  generateWhyExplanation,
  generateCallScript,
};
