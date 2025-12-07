/**
 * Actions v1 - Core Services
 *
 * Re-exports all action-related services and utilities.
 *
 * @version 1.0
 */

// Points Service
export {
  PointsService,
  getPointsService,
  DAILY_SELF_REPORTED_CAP,
  POINTS_PER_TENTH_MILE,
  MIN_SEARCH_DISTANCE,
  TIME_BONUSES,
  URGENCY_BONUSES,
  PHOTO_BONUS_POINTS,
  NEAR_SIGHTING_BONUS,
  OWNER_REQUESTED_BONUS,
  getUTCDateString,
  getCurrentHour,
  getTimeMultipliers,
  getUrgencyMultipliers,
  calculateTotalMultiplier,
  calculateSearchPoints,
} from './pointsService';

// Verification Service
export {
  VerificationService,
  getVerificationService,
  calculateDistance,
  calculatePathDistance,
  validateGPSPath,
  getCellId,
  MAX_GPS_ACCURACY_METERS,
  MIN_PATH_POINTS,
  MAX_GPS_GAP_MS,
} from './verificationService';

// Email Service
export {
  EmailService,
  getEmailService,
  type ShelterEmailParams,
  type EmailResult,
} from './emailService';

// Tip Service (Phase 5: Scout Intelligence)
export {
  TipService,
  getTipService,
  type TipContext,
  type GeneratedTip,
} from './tipService';

// Task Definitions (re-export from parent)
export {
  TASK_DEFINITIONS,
  getTaskById,
  getTasksByCategory,
  getAllTaskIds,
  getTasksByPriority,
  getTasksForPetType,
  getTasksForRole,
  canTaskBeVerified,
  getTaskBasePoints,
  getTaskPriority,
  BASE_PRIORITIES,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  CATEGORY_DESCRIPTIONS,
} from '../taskDefinitions';
