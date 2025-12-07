/**
 * Task Definitions
 *
 * Canonical task definitions for the Mission Control system.
 * See docs/Actions_Guide.md for full specification.
 *
 * @version 2.5
 */

import {
  TaskDefinition,
  TaskCategory,
  BasePoints,
  VerifiedActionType,
} from '@/types/actions';

// =============================================================================
// TASK DEFINITIONS
// =============================================================================

/**
 * Full list of all possible tasks with metadata.
 *
 * NOTE: `verificationMethod` here is a UI/points hint, not the DB enum.
 * Values:
 *   'GPS'            → can create VerifiedAction with verificationMethod = 'GPS'
 *   'PLATFORM_EMAIL' → can create VerifiedAction with verificationMethod = 'PLATFORM_EMAIL'
 *   'PHOTO'          → can create VerifiedAction with verificationMethod = 'PHOTO'
 *   'SELF_REPORT'    → self-reported only, no VerifiedAction
 *   null             → self-reported only, no VerifiedAction
 *
 * Only actions with GPS/PLATFORM_EMAIL/PHOTO actually create VerifiedAction rows.
 * Self-reported actions affect DailyPointsLog.selfReportedPoints only.
 */
export const TASK_DEFINITIONS: Record<string, TaskDefinition> = {
  // ==========================================================================
  // SEARCH
  // ==========================================================================
  search_area: {
    id: 'search_area',
    category: 'SEARCH',
    displayName: 'Search Area',
    description: 'Walk through the neighborhood looking for your pet',
    icon: '🔍',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 75,
    basePoints: 10, // per 0.1 mile (100 pts/mile)
    verificationMethod: 'GPS',
    tips: [
      'Bring treats and a favorite toy',
      'Call their name in a calm voice',
      'Check under porches, decks, and bushes',
    ],
  },

  check_hiding: {
    id: 'check_hiding',
    category: 'SEARCH',
    displayName: 'Check Hiding Spots',
    description: 'Look in common hiding places like under decks, in sheds, and behind bushes',
    icon: '👀',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 70,
    basePoints: 8,
    verificationMethod: 'GPS',
    tips: [
      'Use a flashlight even during the day',
      'Check high places for cats',
      'Look inside garages and sheds',
      'Take photos of hiding spots you check',
    ],
  },

  // ==========================================================================
  // OUTREACH
  // ==========================================================================
  // NOTE: For shelter/vet/animal-control tasks with both call + email:
  //   - Calls are SELF-REPORTED (8 pts, counts toward daily cap, no VerifiedAction)
  //   - Platform emails are VERIFIED (15 pts, uncapped, creates VerifiedAction)
  // The verificationMethod below refers to email only.

  contact_shelters: {
    id: 'contact_shelters',
    category: 'OUTREACH',
    displayName: 'Contact Shelters',
    description: 'Call or email local animal shelters',
    icon: '🏥',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 85,
    basePoints: { default: 8, call: 8, email: 15 },
    verificationMethod: 'PLATFORM_EMAIL',
    hasSubtasks: true,
    tips: [
      'Call during business hours for best results',
      'Ask if you can email a photo',
      'Request to be notified if a matching pet comes in',
    ],
  },

  contact_vets: {
    id: 'contact_vets',
    category: 'OUTREACH',
    displayName: 'Contact Vet Clinics',
    description: 'Call or email local veterinarians',
    icon: '🩺',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 80,
    basePoints: { default: 8, call: 8, email: 15 },
    verificationMethod: 'PLATFORM_EMAIL',
    hasSubtasks: true,
    tips: [
      'Vets often see found pets brought in for checkups',
      'Ask to post a flyer in their office',
    ],
  },

  contact_animal_control: {
    id: 'contact_animal_control',
    category: 'OUTREACH',
    displayName: 'Contact Animal Control',
    description: 'Reach out to local animal control offices',
    icon: '🚔',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 82,
    basePoints: { default: 8, call: 8, email: 15 },
    verificationMethod: 'PLATFORM_EMAIL',
    hasSubtasks: true,
    tips: [
      'Animal control handles strays and found pets',
      'Ask about their hold period before adoption',
    ],
  },

  notify_microchip: {
    id: 'notify_microchip',
    category: 'OUTREACH',
    displayName: 'Notify Microchip Company',
    description: 'Report your pet as lost with the microchip registry',
    icon: '📡',
    role: 'OWNER',
    petType: 'BOTH',
    basePriority: 90,
    basePoints: 10,
    verificationMethod: 'SELF_REPORT', // Confirmation screenshot is context only
    tips: [
      'Have your microchip number ready',
      'Update your contact information if needed',
      'Some registries offer free lost pet alerts',
    ],
  },

  post_flyers: {
    id: 'post_flyers',
    category: 'OUTREACH',
    displayName: 'Post Flyers',
    description: 'Put up physical flyers in the neighborhood',
    icon: '📄',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 65,
    basePoints: 8, // GPS-verified flyer posting
    verificationMethod: 'GPS',
    tips: [
      'Post at eye level on telephone poles',
      'Ask local businesses to display in windows',
      'Include a clear photo and contact number',
      'Use weatherproof sleeves if possible',
    ],
  },

  knock_doors: {
    id: 'knock_doors',
    category: 'OUTREACH',
    displayName: 'Talk to Neighbors',
    description: 'Go door-to-door in the neighborhood',
    icon: '🚪',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 70,
    basePoints: 5, // per door/cluster
    verificationMethod: 'GPS',
    tips: [
      'Bring a flyer to leave if no one is home',
      'Ask if they have outdoor cameras',
      'Leave your contact information',
    ],
  },

  alert_delivery: {
    id: 'alert_delivery',
    category: 'OUTREACH',
    displayName: 'Alert Delivery Workers',
    description: 'Tell mail carriers, Amazon drivers, and other delivery workers',
    icon: '📦',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 55,
    basePoints: 5,
    verificationMethod: 'SELF_REPORT',
    tips: [
      'Delivery workers cover lots of ground every day',
      'Give them a flyer to keep in their truck',
    ],
  },

  share_online: {
    id: 'share_online',
    category: 'OUTREACH',
    displayName: 'Share Online',
    description: 'Post on social media, Nextdoor, and lost pet sites',
    icon: '📱',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 60,
    basePoints: 5,
    verificationMethod: null, // Self-reported only
    // NOTE: Users can optionally submit a link to their post. For v1, we store
    // this in the activity log (no VerifiedAction). If we later want to treat
    // links as semi-verified for analytics, we can add metadata.linkUrl.
    tips: [
      'Post in local community groups',
      'Use relevant hashtags',
      'Ask friends to share',
    ],
  },

  // ==========================================================================
  // AT_HOME (Cat-focused, require photo for verification)
  // ==========================================================================
  litter_outside: {
    id: 'litter_outside',
    category: 'AT_HOME',
    displayName: 'Put Litter Outside',
    description: 'Place used litter box outside to help your cat find home',
    icon: '🧹',
    role: 'OWNER',
    petType: 'CAT',
    basePriority: 78,
    basePoints: 8,
    verificationMethod: 'PHOTO',
    tips: [
      'Cats can smell their litter from far away',
      'Place near an entry point to your home',
      'Protect from rain if possible',
    ],
  },

  scent_items: {
    id: 'scent_items',
    category: 'AT_HOME',
    displayName: 'Leave Scent Items',
    description: 'Put out items with familiar scents like bedding or clothing',
    icon: '👕',
    role: 'OWNER',
    petType: 'BOTH',
    basePriority: 75,
    basePoints: 8,
    verificationMethod: 'PHOTO',
    tips: [
      'Unwashed items have the strongest scent',
      'Your worn clothing works well',
      'Place in a sheltered spot',
    ],
  },

  food_station: {
    id: 'food_station',
    category: 'AT_HOME',
    displayName: 'Set Up Food Station',
    description: 'Leave food and water outside to attract your pet',
    icon: '🍽️',
    role: 'OWNER',
    petType: 'BOTH',
    basePriority: 72,
    basePoints: 8,
    verificationMethod: 'PHOTO',
    tips: [
      'Use their regular food',
      'Check and refresh daily',
      'Note: may attract other animals',
    ],
  },

  camera_setup: {
    id: 'camera_setup',
    category: 'AT_HOME',
    displayName: 'Set Up Camera',
    description: 'Point a camera at the food station or entry points',
    icon: '📹',
    role: 'OWNER',
    petType: 'BOTH',
    basePriority: 68,
    basePoints: 10,
    verificationMethod: 'PHOTO',
    tips: [
      'Wildlife cameras work great',
      'Or use an old phone with a security app',
      'Check footage regularly',
    ],
  },

  humane_trap: {
    id: 'humane_trap',
    category: 'AT_HOME',
    displayName: 'Set Humane Trap',
    description: 'Set up a humane trap for skittish pets',
    icon: '🪤',
    role: 'OWNER',
    petType: 'BOTH',
    basePriority: 65,
    basePoints: 10,
    verificationMethod: 'PHOTO',
    tips: [
      'Best for cats or skittish dogs',
      'Check trap frequently (every few hours)',
      'Bait with smelly food like tuna or sardines',
    ],
  },

  garage_open: {
    id: 'garage_open',
    category: 'AT_HOME',
    displayName: 'Leave Garage Open',
    description: 'Leave garage door slightly open as a safe entry point',
    icon: '🏠',
    role: 'OWNER',
    petType: 'BOTH',
    basePriority: 60,
    basePoints: 5,
    verificationMethod: 'SELF_REPORT',
    tips: [
      'Open just enough for your pet to enter',
      'Leave bedding and food inside',
      'Check regularly',
    ],
  },

  // ==========================================================================
  // OTHER
  // ==========================================================================
  other: {
    id: 'other',
    category: 'OTHER',
    displayName: 'Other Activity',
    description: 'Log any other helpful activity',
    icon: '📝',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 30,
    basePoints: 3,
    verificationMethod: null, // Never verified, even with photo
    tips: [
      'Use this for activities not covered by other tasks',
      'Be descriptive in your notes',
    ],
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a task definition by ID
 */
export function getTaskById(id: string): TaskDefinition | undefined {
  return TASK_DEFINITIONS[id];
}

/**
 * Get all tasks in a category
 */
export function getTasksByCategory(category: TaskCategory): TaskDefinition[] {
  return Object.values(TASK_DEFINITIONS).filter(
    (task) => task.category === category
  );
}

/**
 * Get all task IDs
 */
export function getAllTaskIds(): string[] {
  return Object.keys(TASK_DEFINITIONS);
}

/**
 * Get tasks sorted by priority (highest first)
 */
export function getTasksByPriority(): TaskDefinition[] {
  return Object.values(TASK_DEFINITIONS).sort(
    (a, b) => b.basePriority - a.basePriority
  );
}

/**
 * Get tasks for a specific pet type
 */
export function getTasksForPetType(
  petType: 'CAT' | 'DOG'
): TaskDefinition[] {
  return Object.values(TASK_DEFINITIONS).filter(
    (task) => task.petType === 'BOTH' || task.petType === petType
  );
}

/**
 * Get tasks that a specific role can perform
 */
export function getTasksForRole(
  role: 'OWNER' | 'VOLUNTEER'
): TaskDefinition[] {
  return Object.values(TASK_DEFINITIONS).filter(
    (task) => task.role === 'BOTH' || task.role === role
  );
}

/**
 * Check if a task can be verified (creates VerifiedAction)
 */
export function canTaskBeVerified(taskId: string): boolean {
  const task = TASK_DEFINITIONS[taskId];
  if (!task) return false;

  const method = task.verificationMethod;
  return method === 'GPS' || method === 'PLATFORM_EMAIL' || method === 'PHOTO';
}

/**
 * Get the base points for a task (handling BasePoints type)
 */
export function getTaskBasePoints(
  taskId: string,
  subtype?: 'call' | 'email'
): number {
  const task = TASK_DEFINITIONS[taskId];
  if (!task) return 0;

  const bp = task.basePoints;
  if (typeof bp === 'number') {
    return bp;
  }

  if (subtype && bp[subtype] !== undefined) {
    return bp[subtype]!;
  }

  return bp.default;
}

// =============================================================================
// BASE PRIORITIES (for dynamic priority system)
// =============================================================================

/**
 * Base priority overrides.
 *
 * NOTE: This object is intentionally partial (just showing high-priority overrides).
 * Any actionType not listed falls back to basePriority from TASK_DEFINITIONS[id].
 */
export const BASE_PRIORITIES: Partial<Record<string, number>> = {
  contact_shelters: 85,
  contact_animal_control: 82,
  contact_vets: 80,
  notify_microchip: 90,
  search_area: 75,
  check_hiding: 70,
  knock_doors: 70,
  post_flyers: 65,
};

/**
 * Get priority for a task (with overrides)
 */
export function getTaskPriority(taskId: string): number {
  if (BASE_PRIORITIES[taskId] !== undefined) {
    return BASE_PRIORITIES[taskId]!;
  }
  const task = TASK_DEFINITIONS[taskId];
  return task?.basePriority ?? 50;
}

// =============================================================================
// CATEGORY METADATA
// =============================================================================

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  SEARCH: 'Search',
  OUTREACH: 'Outreach',
  AT_HOME: 'At Home',
  OTHER: 'Other',
};

export const CATEGORY_ICONS: Record<TaskCategory, string> = {
  SEARCH: '🔍',
  OUTREACH: '📢',
  AT_HOME: '🏠',
  OTHER: '📝',
};

export const CATEGORY_DESCRIPTIONS: Record<TaskCategory, string> = {
  SEARCH: 'Physical search activities in the neighborhood',
  OUTREACH: 'Contacting shelters, neighbors, and spreading the word',
  AT_HOME: 'Things to do at home to attract your pet back',
  OTHER: 'Other helpful activities',
};
