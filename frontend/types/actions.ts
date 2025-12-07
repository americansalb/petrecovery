/**
 * Actions System Types
 *
 * Shared types for the Mission Control task/action system.
 * See docs/Actions_Guide.md for full specification.
 *
 * @version 2.5
 */

// =============================================================================
// CORE ENUMS & TYPES
// =============================================================================

/**
 * Task categories - used for UI grouping and filtering
 */
export type TaskCategory = 'SEARCH' | 'OUTREACH' | 'AT_HOME' | 'OTHER';

/**
 * Verification methods for VerifiedAction records
 * - GPS: Location-tracked actions (search, flyer posting)
 * - PLATFORM_EMAIL: Emails sent through our platform via Resend
 * - PHOTO: Photo proof attached to action
 * - CALL_DETECT: Future - technical call detection
 */
export type VerificationMethod = 'GPS' | 'PLATFORM_EMAIL' | 'PHOTO' | 'CALL_DETECT';

/**
 * Valid action types for VerifiedAction.actionType
 *
 * ⚠️ IMPORTANT: Use ONLY these values when creating VerifiedAction records.
 * Typos will silently corrupt analytics data.
 */
export type VerifiedActionType =
  | 'search_area'
  | 'check_hiding'
  | 'contact_shelters'
  | 'contact_vets'
  | 'contact_animal_control'
  | 'post_flyers'
  | 'knock_doors'
  | 'litter_outside'
  | 'scent_items'
  | 'food_station'
  | 'camera_setup'
  | 'humane_trap'
  | 'garage_open';

/**
 * All valid action type values as an array (for runtime validation)
 */
export const VERIFIED_ACTION_TYPES: VerifiedActionType[] = [
  'search_area',
  'check_hiding',
  'contact_shelters',
  'contact_vets',
  'contact_animal_control',
  'post_flyers',
  'knock_doors',
  'litter_outside',
  'scent_items',
  'food_station',
  'camera_setup',
  'humane_trap',
  'garage_open',
];

/**
 * Validate that a string is a valid VerifiedActionType
 */
export function isValidActionType(value: string): value is VerifiedActionType {
  return VERIFIED_ACTION_TYPES.includes(value as VerifiedActionType);
}

// =============================================================================
// POINTS SYSTEM
// =============================================================================

/**
 * Base points can be either a single number or an object with subtypes
 * For tasks with multiple actions (e.g., shelter contact: call vs email)
 */
export type BasePoints = number | {
  default: number;
  call?: number;
  email?: number;
};

/**
 * Get the point value from a BasePoints type
 */
export function getBasePointsValue(
  basePoints: BasePoints,
  subtype?: 'call' | 'email'
): number {
  if (typeof basePoints === 'number') {
    return basePoints;
  }
  if (subtype && basePoints[subtype] !== undefined) {
    return basePoints[subtype]!;
  }
  return basePoints.default;
}

/**
 * Points multiplier for time/context bonuses
 */
export type PointsMultiplier = {
  type: 'DAWN' | 'DUSK' | 'BUSINESS_HOURS' | 'NEAR_SIGHTING' | 'FIRST_6H' | 'FIRST_24H' | 'OWNER_REQUESTED' | 'PHOTO_BONUS';
  value: number; // e.g., 1.10 for +10%, 1.25 for +25% (PHOTO_BONUS uses 1.0 since it's flat +3pts)
  label: string; // For UI display
};

/**
 * Points award result from the points service
 */
export type PointsAwardResult = {
  awardedPoints: number;
  basePoints: number;
  bonusPoints: number;
  multipliers: PointsMultiplier[];
  verifiedActionId?: string;
  dailyTotals: {
    verified: number;
    selfReported: number;
    remaining: number; // How many self-reported points left today
  };
};

// =============================================================================
// TASK DEFINITIONS
// =============================================================================

/**
 * UI hint for how a task can be verified
 * - GPS, PLATFORM_EMAIL, PHOTO: Creates VerifiedAction with that method
 * - SELF_REPORT: Self-reported only, no VerifiedAction
 * - null: Same as SELF_REPORT
 */
export type TaskVerificationHint = 'GPS' | 'PLATFORM_EMAIL' | 'PHOTO' | 'SELF_REPORT' | null;

/**
 * Who can perform this task
 */
export type TaskRole = 'OWNER' | 'VOLUNTEER' | 'BOTH';

/**
 * Which pet types this task applies to
 */
export type TaskPetType = 'CAT' | 'DOG' | 'BOTH';

/**
 * Full task definition from TASK_DEFINITIONS
 */
export type TaskDefinition = {
  id: string;
  category: TaskCategory;
  displayName: string;
  description: string;
  icon: string;
  role: TaskRole;
  petType: TaskPetType;
  basePriority: number;
  basePoints: BasePoints;
  verificationMethod: TaskVerificationHint;
  hasSubtasks?: boolean;
  tips: string[];
};

// =============================================================================
// SEARCH SESSION
// =============================================================================

/**
 * GPS point with timestamp
 */
export type GeoPoint = {
  lat: number;
  lng: number;
  timestamp?: string; // ISO timestamp
};

/**
 * Search session data (matches SearchSession model)
 */
export type SearchSession = {
  id: string;
  caseId: string;
  userId: string;
  startedAt: string;
  endedAt?: string;
  path: GeoPoint[];
  distanceMiles: number;
  pointsEarned: number;
  isVerified: boolean;
};

/**
 * Search session start response
 */
export type SearchStartResponse = {
  sessionId: string;
  startedAt: string;
};

/**
 * Search session end response
 */
export type SearchEndResponse = {
  sessionId: string;
  distanceMiles: number;
  pointsEarned: number;
  bonuses: PointsMultiplier[];
  dailyTotals: {
    verified: number;
    selfReported: number;
  };
};

// =============================================================================
// SHELTER CONTACTS
// =============================================================================

/**
 * Shelter contact status
 */
export type ShelterContactStatus =
  | 'NOT_CONTACTED'
  | 'CONTACTED'
  | 'AWAITING_RESPONSE'
  | 'NO_MATCH'
  | 'POSSIBLE_MATCH'
  | 'MATCH_FOUND';

/**
 * Call outcome options
 */
export type CallOutcome =
  | 'NO_ANSWER'
  | 'LEFT_VOICEMAIL'
  | 'SPOKE_WITH_STAFF'
  | 'WRONG_NUMBER'
  | 'BUSY';

/**
 * Staff response options
 */
export type StaffResponse =
  | 'NO_MATCHING_ANIMALS'
  | 'POSSIBLE_MATCH'
  | 'CONFIRMED_MATCH'
  | 'WILL_CHECK_AND_CALL_BACK'
  | 'OTHER';

/**
 * Contact method
 */
export type ContactMethod = 'CALL' | 'EMAIL' | 'IN_PERSON';

/**
 * Shelter from lookup (Google Maps or Apple Maps)
 */
export type ShelterLookupResult = {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  location: GeoPoint;
  distanceMiles: number;
  types: string[]; // e.g., ['animal_shelter', 'veterinary_care']
  openNow?: boolean;
  rating?: number;
};

/**
 * Shelter contact record (our database)
 */
export type ShelterContact = {
  id: string;
  caseId: string;
  shelterId: string; // External place ID
  shelterName: string;
  shelterAddress: string;
  shelterPhone?: string;
  shelterEmail?: string;
  latitude: number;
  longitude: number;
  status: ShelterContactStatus;
  lastContactedAt?: string;
  lastContactMethod?: ContactMethod;
  notes?: string;
  attempts: ShelterContactAttempt[];
};

/**
 * Individual contact attempt
 */
export type ShelterContactAttempt = {
  id: string;
  shelterContactId: string;
  userId: string;
  method: ContactMethod;
  callOutcome?: CallOutcome;
  staffResponse?: StaffResponse;
  emailId?: string;
  emailOpened: boolean;
  emailOpenedAt?: string;
  emailReplied: boolean;
  emailRepliedAt?: string;
  notes?: string;
  pointsEarned: number;
  isVerified: boolean;
  createdAt: string;
};

// =============================================================================
// FLYER POSTING
// =============================================================================

/**
 * Flyer posting record
 */
export type FlyerPosting = {
  id: string;
  caseId: string;
  userId: string;
  latitude: number;
  longitude: number;
  photoUrl?: string;
  notes?: string;
  pointsEarned: number;
  isVerified: boolean;
  createdAt: string;
};

/**
 * Cold spot (area needing flyers)
 */
export type ColdSpot = {
  center: GeoPoint;
  cellId: string; // e.g., "B4"
  distanceFromLastSeen: number; // miles
};

/**
 * Flyers API response
 */
export type FlyersResponse = {
  flyers: FlyerPosting[];
  coldSpots: ColdSpot[];
};

// =============================================================================
// DAILY POINTS LOG
// =============================================================================

/**
 * Daily points summary for a user
 */
export type DailyPointsLog = {
  id: string;
  userId: string;
  date: string; // ISO date (UTC)
  verifiedPoints: number;
  selfReportedPoints: number;
};

/**
 * Points summary for UI display
 */
export type PointsSummary = {
  today: {
    verified: number;
    selfReported: number;
    total: number;
    remaining: number; // 100 - selfReported
  };
  allTime: {
    verified: number;
    selfReported: number;
    total: number;
  };
  caseTotal?: number; // Points for current case
};

// =============================================================================
// LEADERBOARD
// =============================================================================

/**
 * Leaderboard entry
 */
export type LeaderboardEntry = {
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  points: number;
  verifiedPoints?: number;
  selfReportedPoints?: number;
  rank: number;
};

/**
 * Leaderboard response (per-case)
 */
export type LeaderboardResponse = {
  caseId: string;
  entries: LeaderboardEntry[];
  userRank?: number; // Current user's rank
  userPoints?: number; // Current user's points for this case
};

// =============================================================================
// TASK UI STATE
// =============================================================================

/**
 * Task state for UI
 */
export type TaskUIState =
  | 'AVAILABLE'
  | 'IN_PROGRESS'
  | 'NEEDS_HELP'
  | 'OWNER_REQUESTED'
  | 'COMPLETED'
  | 'BLOCKED';

/**
 * Task with UI state (for task list)
 */
export type TaskWithState = TaskDefinition & {
  state: TaskUIState;
  ownerRequested: boolean;
  ownerRequestMessage?: string;
  participants: {
    id: string;
    name: string;
    avatarUrl?: string;
  }[];
  progress?: {
    completed: number;
    total: number;
  };
  completedAt?: string;
  completedBy?: string;
};

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Award points request body
 */
export type AwardPointsRequest = {
  userId: string;
  caseId: string;
  actionType: VerifiedActionType;
  basePoints: number;
  isVerified: boolean;
  verificationMethod?: VerificationMethod;
  metadata?: Record<string, unknown>;
  multipliers?: { type: string; value: number }[];
};

/**
 * Complete task request body
 */
export type CompleteTaskRequest = {
  taskId: string;
  photoUrl?: string;
  notes?: string;
};

/**
 * Log call request body
 */
export type LogCallRequest = {
  outcome: CallOutcome;
  staffResponse?: StaffResponse;
  notes?: string;
};

/**
 * Send email request body
 */
export type SendEmailRequest = {
  shelterEmail: string;
};

/**
 * Post flyer request body
 */
export type PostFlyerRequest = {
  lat: number;
  lng: number;
  photoUrl?: string;
  notes?: string;
};

/**
 * Manual search log request body
 */
export type LogSearchRequest = {
  note?: string;
  approximateLocation?: GeoPoint;
};
