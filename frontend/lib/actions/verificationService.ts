/**
 * Verification Service
 *
 * Handles verification logic for GPS, photo, and email-based actions.
 * See docs/Actions_Guide.md for full specification.
 *
 * @version 1.0
 */

import { PrismaClient, ActionType, VerificationMethod } from '@prisma/client';
import { GeoPoint } from '@/types/actions';
import {
  getTaskBasePoints,
  canTaskBeVerified,
  TASK_DEFINITIONS,
} from '@/lib/taskDefinitions';
import {
  PointsService,
  getPointsService,
  calculateSearchPoints,
  MIN_SEARCH_DISTANCE,
} from './pointsService';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Earth radius in miles for distance calculations */
const EARTH_RADIUS_MILES = 3959;

/** Maximum allowed GPS accuracy for verification (meters) */
export const MAX_GPS_ACCURACY_METERS = 50;

/** Minimum path points for GPS search verification */
export const MIN_PATH_POINTS = 3;

/** Maximum time between GPS points before session is considered invalid (ms) */
export const MAX_GPS_GAP_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// GPS HELPERS
// =============================================================================

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate total distance of a path
 */
export function calculatePathDistance(path: GeoPoint[]): number {
  if (path.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < path.length; i++) {
    totalDistance += calculateDistance(
      path[i - 1].lat,
      path[i - 1].lng,
      path[i].lat,
      path[i].lng
    );
  }
  return totalDistance;
}

/**
 * Validate GPS path for search session
 */
export function validateGPSPath(path: GeoPoint[]): {
  isValid: boolean;
  error?: string;
} {
  if (path.length < MIN_PATH_POINTS) {
    return {
      isValid: false,
      error: `Path requires at least ${MIN_PATH_POINTS} GPS points`,
    };
  }

  // Check for timestamp gaps
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];

    if (prev.timestamp && curr.timestamp) {
      const gap = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
      if (gap > MAX_GPS_GAP_MS) {
        return {
          isValid: false,
          error: `GPS gap too large between points (${Math.round(gap / 1000)}s)`,
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Get cell ID for cold spot grid (100m x 100m cells)
 * Based on spec formula: `${Math.floor((lat - originLat) / 0.0009)}_${Math.floor((lng - originLng) / 0.0012)}`
 */
export function getCellId(lat: number, lng: number, originLat: number, originLng: number): string {
  // 0.0009 degrees ≈ 100m latitude
  // 0.0012 degrees ≈ 100m longitude (at ~40° latitude)
  const row = Math.floor((lat - originLat) / 0.0009);
  const col = Math.floor((lng - originLng) / 0.0012);
  return `${row}_${col}`;
}

// =============================================================================
// VERIFICATION SERVICE CLASS
// =============================================================================

export class VerificationService {
  private pointsService: PointsService;

  constructor(private prisma: PrismaClient) {
    this.pointsService = getPointsService(prisma);
  }

  // ===========================================================================
  // GPS VERIFICATION (Search, Flyers, Knocking)
  // ===========================================================================

  /**
   * Complete a GPS-tracked search session
   */
  async completeSearchSession(params: {
    sessionId: string;
    userId: string;
    caseId: string;
    path: GeoPoint[];
    caseCreatedAt?: Date;
    timezone?: string;
  }): Promise<{
    sessionId: string;
    distanceMiles: number;
    pointsEarned: number;
    isVerified: boolean;
    error?: string;
  }> {
    const { sessionId, userId, caseId, path, caseCreatedAt, timezone } = params;

    // Validate path
    const validation = validateGPSPath(path);
    if (!validation.isValid) {
      return {
        sessionId,
        distanceMiles: 0,
        pointsEarned: 0,
        isVerified: false,
        error: validation.error,
      };
    }

    // Calculate distance
    const distanceMiles = calculatePathDistance(path);
    if (distanceMiles < MIN_SEARCH_DISTANCE) {
      return {
        sessionId,
        distanceMiles,
        pointsEarned: 0,
        isVerified: false,
        error: `Distance too short (${distanceMiles.toFixed(2)} miles, minimum ${MIN_SEARCH_DISTANCE})`,
      };
    }

    // Calculate base points (10 pts per 0.1 mile)
    const basePoints = calculateSearchPoints(distanceMiles);

    // Award verified points
    const result = await this.pointsService.awardVerifiedPoints({
      userId,
      caseId,
      actionType: 'search_area' as ActionType,
      verificationMethod: 'GPS' as VerificationMethod,
      basePoints,
      metadata: {
        distanceMiles,
        pathPointCount: path.length,
        sessionId,
      },
      caseCreatedAt,
      timezone,
    });

    // Update search session in database
    await this.prisma.searchSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
        distanceMiles,
        pointsEarned: result.awardedPoints,
        isVerified: true,
        userId,
        verifiedActionId: result.verifiedActionId,
      },
    });

    return {
      sessionId,
      distanceMiles,
      pointsEarned: result.awardedPoints,
      isVerified: true,
    };
  }

  /**
   * Verify GPS flyer posting
   */
  async verifyFlyerPosting(params: {
    userId: string;
    caseId: string;
    latitude: number;
    longitude: number;
    photoUrl?: string;
    notes?: string;
    caseCreatedAt?: Date;
    timezone?: string;
  }): Promise<{
    flyerId: string;
    pointsEarned: number;
    isVerified: boolean;
  }> {
    const { userId, caseId, latitude, longitude, photoUrl, notes, caseCreatedAt, timezone } = params;

    const basePoints = getTaskBasePoints('post_flyers');

    // Award verified points
    const result = await this.pointsService.awardVerifiedPoints({
      userId,
      caseId,
      actionType: 'post_flyers' as ActionType,
      verificationMethod: 'GPS' as VerificationMethod,
      basePoints,
      latitude,
      longitude,
      photoUrl,
      metadata: { notes },
      caseCreatedAt,
      timezone,
    });

    // Create flyer posting record
    const flyer = await this.prisma.flyerPosting.create({
      data: {
        caseId,
        userId,
        latitude,
        longitude,
        photoUrl,
        notes,
        pointsEarned: result.awardedPoints,
        isVerified: true,
        verifiedActionId: result.verifiedActionId,
      },
    });

    return {
      flyerId: flyer.id,
      pointsEarned: result.awardedPoints,
      isVerified: true,
    };
  }

  /**
   * Verify GPS door knocking
   */
  async verifyDoorKnocking(params: {
    userId: string;
    caseId: string;
    latitude: number;
    longitude: number;
    notes?: string;
    caseCreatedAt?: Date;
    timezone?: string;
  }): Promise<{
    pointsEarned: number;
    isVerified: boolean;
  }> {
    const { userId, caseId, latitude, longitude, notes, caseCreatedAt, timezone } = params;

    const basePoints = getTaskBasePoints('knock_doors');

    const result = await this.pointsService.awardVerifiedPoints({
      userId,
      caseId,
      actionType: 'knock_doors' as ActionType,
      verificationMethod: 'GPS' as VerificationMethod,
      basePoints,
      latitude,
      longitude,
      metadata: { notes },
      caseCreatedAt,
      timezone,
    });

    return {
      pointsEarned: result.awardedPoints,
      isVerified: true,
    };
  }

  // ===========================================================================
  // PHOTO VERIFICATION (At-Home Tasks)
  // ===========================================================================

  /**
   * Verify photo-based action (litter, scent items, food station, etc.)
   */
  async verifyPhotoAction(params: {
    userId: string;
    caseId: string;
    actionType: ActionType;
    photoUrl: string;
    notes?: string;
    caseCreatedAt?: Date;
    timezone?: string;
    ownerRequested?: boolean;  // +25% bonus if owner requested this task
  }): Promise<{
    pointsEarned: number;
    isVerified: boolean;
    verifiedActionId: string;
  }> {
    const { userId, caseId, actionType, photoUrl, notes, caseCreatedAt, timezone, ownerRequested } = params;

    // Verify this action type supports photo verification
    const taskDef = TASK_DEFINITIONS[actionType];
    if (!taskDef || taskDef.verificationMethod !== 'PHOTO') {
      throw new Error(`Action type ${actionType} does not support photo verification`);
    }

    const basePoints = getTaskBasePoints(actionType);

    const result = await this.pointsService.awardVerifiedPoints({
      userId,
      caseId,
      actionType,
      verificationMethod: 'PHOTO' as VerificationMethod,
      basePoints,
      photoUrl,
      metadata: { notes },
      caseCreatedAt,
      timezone,
      ownerRequested,
    });

    return {
      pointsEarned: result.awardedPoints,
      isVerified: true,
      verifiedActionId: result.verifiedActionId!,
    };
  }

  // ===========================================================================
  // PLATFORM EMAIL VERIFICATION
  // ===========================================================================

  /**
   * Record a platform email send (creates verified action)
   * Called after Resend API successfully sends the email
   */
  async recordPlatformEmail(params: {
    userId: string;
    caseId: string;
    shelterContactId: string;
    actionType: ActionType;
    emailId: string;
    recipientEmail: string;
    recipientName: string;
    caseCreatedAt?: Date;
    timezone?: string;
  }): Promise<{
    attemptId: string;
    pointsEarned: number;
    verifiedActionId: string;
  }> {
    const {
      userId,
      caseId,
      shelterContactId,
      actionType,
      emailId,
      recipientEmail,
      recipientName,
      caseCreatedAt,
      timezone,
    } = params;

    // Get email points (15 for platform emails)
    const basePoints = getTaskBasePoints(actionType, 'email');

    const result = await this.pointsService.awardVerifiedPoints({
      userId,
      caseId,
      actionType,
      verificationMethod: 'PLATFORM_EMAIL' as VerificationMethod,
      basePoints,
      emailId,
      metadata: {
        shelterContactId,
        recipientEmail,
        recipientName,
      },
      caseCreatedAt,
      timezone,
    });

    // Create shelter contact attempt record
    const attempt = await this.prisma.shelterContactAttempt.create({
      data: {
        shelterContactId,
        userId,
        method: 'EMAIL',
        emailId,
        pointsEarned: result.awardedPoints,
        isVerified: true,
        verifiedActionId: result.verifiedActionId,
      },
    });

    // Update shelter contact status
    await this.prisma.shelterContact.update({
      where: { id: shelterContactId },
      data: {
        status: 'AWAITING_RESPONSE',
        lastContactedAt: new Date(),
        lastContactMethod: 'EMAIL',
      },
    });

    return {
      attemptId: attempt.id,
      pointsEarned: result.awardedPoints,
      verifiedActionId: result.verifiedActionId!,
    };
  }

  /**
   * Handle email open event (from Resend webhook)
   */
  async handleEmailOpened(emailId: string): Promise<void> {
    const now = new Date();

    // Update VerifiedAction
    await this.prisma.verifiedAction.updateMany({
      where: { emailId },
      data: {
        emailOpened: true,
        emailOpenedAt: now,
      },
    });

    // Update ShelterContactAttempt
    await this.prisma.shelterContactAttempt.updateMany({
      where: { emailId },
      data: {
        emailOpened: true,
        emailOpenedAt: now,
      },
    });
  }

  /**
   * Handle email reply event (from Resend webhook)
   */
  async handleEmailReplied(emailId: string): Promise<void> {
    const now = new Date();

    // Update VerifiedAction
    await this.prisma.verifiedAction.updateMany({
      where: { emailId },
      data: {
        emailReplied: true,
        emailRepliedAt: now,
      },
    });

    // Update ShelterContactAttempt
    await this.prisma.shelterContactAttempt.updateMany({
      where: { emailId },
      data: {
        emailReplied: true,
        emailRepliedAt: now,
      },
    });
  }

  // ===========================================================================
  // SELF-REPORTED ACTIONS (Calls, Other)
  // ===========================================================================

  /**
   * Log a self-reported call to shelter/vet
   */
  async logShelterCall(params: {
    userId: string;
    caseId: string;
    shelterContactId: string;
    actionType: ActionType;
    callOutcome: 'NO_ANSWER' | 'LEFT_VOICEMAIL' | 'SPOKE_WITH_STAFF' | 'WRONG_NUMBER' | 'BUSY';
    staffResponse?: 'NO_MATCHING_ANIMALS' | 'POSSIBLE_MATCH' | 'CONFIRMED_MATCH' | 'WILL_CHECK_AND_CALL_BACK' | 'OTHER';
    notes?: string;
  }): Promise<{
    attemptId: string;
    pointsEarned: number;
    remainingDaily: number;
  }> {
    const { userId, caseId, shelterContactId, actionType, callOutcome, staffResponse, notes } = params;

    // Get call points (8 for self-reported calls)
    const basePoints = getTaskBasePoints(actionType, 'call');

    // Award self-reported points (subject to cap)
    const result = await this.pointsService.awardSelfReportedPoints({
      userId,
      points: basePoints,
    });

    // Create shelter contact attempt
    const attempt = await this.prisma.shelterContactAttempt.create({
      data: {
        shelterContactId,
        userId,
        method: 'CALL',
        callOutcome,
        staffResponse,
        notes,
        pointsEarned: result.awardedPoints,
        isVerified: false,
      },
    });

    // Update shelter contact status based on outcome
    let newStatus: 'CONTACTED' | 'AWAITING_RESPONSE' | 'NO_MATCH' | 'POSSIBLE_MATCH' | 'MATCH_FOUND' = 'CONTACTED';
    if (staffResponse === 'NO_MATCHING_ANIMALS') {
      newStatus = 'NO_MATCH';
    } else if (staffResponse === 'POSSIBLE_MATCH') {
      newStatus = 'POSSIBLE_MATCH';
    } else if (staffResponse === 'CONFIRMED_MATCH') {
      newStatus = 'MATCH_FOUND';
    } else if (staffResponse === 'WILL_CHECK_AND_CALL_BACK') {
      newStatus = 'AWAITING_RESPONSE';
    }

    await this.prisma.shelterContact.update({
      where: { id: shelterContactId },
      data: {
        status: newStatus,
        lastContactedAt: new Date(),
        lastContactMethod: 'CALL',
      },
    });

    return {
      attemptId: attempt.id,
      pointsEarned: result.awardedPoints,
      remainingDaily: result.dailyTotals.remaining,
    };
  }

  /**
   * Log a generic self-reported action
   */
  async logSelfReportedAction(params: {
    userId: string;
    actionType: string;
    notes?: string;
  }): Promise<{
    pointsEarned: number;
    remainingDaily: number;
  }> {
    const { userId, actionType, notes } = params;

    const basePoints = getTaskBasePoints(actionType);

    const result = await this.pointsService.awardSelfReportedPoints({
      userId,
      points: basePoints,
    });

    return {
      pointsEarned: result.awardedPoints,
      remainingDaily: result.dailyTotals.remaining,
    };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

let verificationServiceInstance: VerificationService | null = null;

export function getVerificationService(prisma: PrismaClient): VerificationService {
  if (!verificationServiceInstance) {
    verificationServiceInstance = new VerificationService(prisma);
  }
  return verificationServiceInstance;
}
