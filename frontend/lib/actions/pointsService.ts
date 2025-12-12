/**
 * Points Service
 *
 * Handles points calculation, awarding, and daily tracking for the Actions v1 system.
 * See docs/Actions_Guide.md for full specification.
 *
 * SOURCE OF TRUTH: DailyPointsLog is the authoritative record for daily points.
 *
 * @version 1.0
 */

import { PrismaClient, ActionType, VerificationMethod } from '@prisma/client';
import {
  PointsMultiplier,
  PointsAwardResult,
  PointsSummary,
} from '@/types/actions';
import { getTaskBasePoints, TASK_DEFINITIONS } from '@/lib/taskDefinitions';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum self-reported points per day */
export const DAILY_SELF_REPORTED_CAP = 100;

/** Points per 0.1 mile for GPS search */
export const POINTS_PER_TENTH_MILE = 10;

/** Minimum distance for GPS search to count (miles) */
export const MIN_SEARCH_DISTANCE = 0.05;

/** Time bonus windows */
export const TIME_BONUSES = {
  DAWN: { startHour: 5, endHour: 7, multiplier: 1.1, label: 'Dawn bonus (+10%)' },
  DUSK: { startHour: 17, endHour: 20, multiplier: 1.1, label: 'Dusk bonus (+10%)' },
  BUSINESS_HOURS: { startHour: 9, endHour: 17, multiplier: 1.1, label: 'Business hours (+10%)' },
} as const;

/** Urgency bonuses based on case age */
export const URGENCY_BONUSES = {
  FIRST_6H: { maxHours: 6, multiplier: 1.2, label: 'Critical window (+20%)' },
  FIRST_24H: { maxHours: 24, multiplier: 1.1, label: 'First 24h (+10%)' },
} as const;

/** Photo bonus (added on top of base points for any verified action with photo) */
export const PHOTO_BONUS_POINTS = 3;

/** Near sighting bonus */
export const NEAR_SIGHTING_BONUS = {
  distanceMiles: 0.5,
  multiplier: 1.15,
  label: 'Near sighting (+15%)',
} as const;

/** Owner requested task bonus */
export const OWNER_REQUESTED_BONUS = {
  multiplier: 1.25,
  label: 'Owner requested (+25%)',
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get current UTC date as YYYY-MM-DD string
 */
export function getUTCDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get current hour in user's timezone (or UTC if not specified)
 */
export function getCurrentHour(timezone?: string): number {
  const now = new Date();
  if (timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      });
      return parseInt(formatter.format(now), 10);
    } catch {
      // Fall back to UTC
    }
  }
  return now.getUTCHours();
}

/**
 * Calculate time-based multipliers
 */
export function getTimeMultipliers(
  actionType: string,
  timezone?: string
): PointsMultiplier[] {
  const multipliers: PointsMultiplier[] = [];
  const hour = getCurrentHour(timezone);

  // Dawn/Dusk bonuses for search activities
  const searchActions = ['search_area', 'check_hiding', 'knock_doors', 'post_flyers'];
  if (searchActions.includes(actionType)) {
    if (hour >= TIME_BONUSES.DAWN.startHour && hour < TIME_BONUSES.DAWN.endHour) {
      multipliers.push({
        type: 'DAWN',
        value: TIME_BONUSES.DAWN.multiplier,
        label: TIME_BONUSES.DAWN.label,
      });
    } else if (hour >= TIME_BONUSES.DUSK.startHour && hour < TIME_BONUSES.DUSK.endHour) {
      multipliers.push({
        type: 'DUSK',
        value: TIME_BONUSES.DUSK.multiplier,
        label: TIME_BONUSES.DUSK.label,
      });
    }
  }

  // Business hours bonus for shelter/vet contacts
  const contactActions = ['contact_shelters', 'contact_vets', 'contact_animal_control'];
  if (contactActions.includes(actionType)) {
    if (hour >= TIME_BONUSES.BUSINESS_HOURS.startHour && hour < TIME_BONUSES.BUSINESS_HOURS.endHour) {
      multipliers.push({
        type: 'BUSINESS_HOURS',
        value: TIME_BONUSES.BUSINESS_HOURS.multiplier,
        label: TIME_BONUSES.BUSINESS_HOURS.label,
      });
    }
  }

  return multipliers;
}

/**
 * Calculate urgency multipliers based on case creation time
 */
export function getUrgencyMultipliers(caseCreatedAt: Date): PointsMultiplier[] {
  const multipliers: PointsMultiplier[] = [];
  const hoursElapsed = (Date.now() - caseCreatedAt.getTime()) / (1000 * 60 * 60);

  if (hoursElapsed <= URGENCY_BONUSES.FIRST_6H.maxHours) {
    multipliers.push({
      type: 'FIRST_6H',
      value: URGENCY_BONUSES.FIRST_6H.multiplier,
      label: URGENCY_BONUSES.FIRST_6H.label,
    });
  } else if (hoursElapsed <= URGENCY_BONUSES.FIRST_24H.maxHours) {
    multipliers.push({
      type: 'FIRST_24H',
      value: URGENCY_BONUSES.FIRST_24H.multiplier,
      label: URGENCY_BONUSES.FIRST_24H.label,
    });
  }

  return multipliers;
}

/**
 * Calculate total multiplier from array of multipliers
 */
export function calculateTotalMultiplier(multipliers: PointsMultiplier[]): number {
  if (multipliers.length === 0) return 1.0;

  // Multipliers stack additively: 1.1 + 1.25 = 1.35 (not 1.375)
  const totalBonus = multipliers.reduce((sum, m) => sum + (m.value - 1), 0);
  return 1 + totalBonus;
}

/**
 * Calculate points for GPS search based on distance
 */
export function calculateSearchPoints(distanceMiles: number): number {
  if (distanceMiles < MIN_SEARCH_DISTANCE) return 0;

  // 10 points per 0.1 mile = 100 points per mile
  const tenthMiles = Math.floor(distanceMiles * 10);
  return tenthMiles * POINTS_PER_TENTH_MILE;
}

// =============================================================================
// POINTS SERVICE CLASS
// =============================================================================

export class PointsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Award points for a verified action
   *
   * Creates VerifiedAction record and updates DailyPointsLog.
   * Uses row-level locking to prevent race conditions.
   */
  async awardVerifiedPoints(params: {
    userId: string;
    missionId: string;
    actionType: ActionType;
    verificationMethod: VerificationMethod;
    basePoints: number;
    metadata?: Record<string, unknown>;
    latitude?: number;
    longitude?: number;
    photoUrl?: string;
    emailId?: string;
    caseCreatedAt?: Date;
    caseLostAt?: Date;
    timezone?: string;
    ownerRequested?: boolean;
    nearSightingDistance?: number; // Miles from recent sighting
  }): Promise<PointsAwardResult> {
    const {
      userId,
      missionId,
      actionType,
      verificationMethod,
      basePoints,
      metadata,
      latitude,
      longitude,
      photoUrl,
      emailId,
      caseCreatedAt,
      caseLostAt,
      timezone,
      ownerRequested,
      nearSightingDistance,
    } = params;

    // Calculate multipliers
    const timeMultipliers = getTimeMultipliers(actionType, timezone);
    const urgencyMultipliers = caseCreatedAt
      ? getUrgencyMultipliers(caseCreatedAt)
      : [];
    const allMultipliers = [...timeMultipliers, ...urgencyMultipliers];

    // Add near sighting bonus if within range
    if (nearSightingDistance !== undefined && nearSightingDistance <= NEAR_SIGHTING_BONUS.distanceMiles) {
      allMultipliers.push({
        type: 'NEAR_SIGHTING',
        value: NEAR_SIGHTING_BONUS.multiplier,
        label: NEAR_SIGHTING_BONUS.label,
      });
    }

    // Add owner requested bonus
    if (ownerRequested) {
      allMultipliers.push({
        type: 'OWNER_REQUESTED',
        value: OWNER_REQUESTED_BONUS.multiplier,
        label: OWNER_REQUESTED_BONUS.label,
      });
    }

    // Calculate final points with multipliers
    const totalMultiplier = calculateTotalMultiplier(allMultipliers);
    let bonusPoints = Math.round(basePoints * (totalMultiplier - 1));

    // Add photo bonus if photo attached
    if (photoUrl) {
      bonusPoints += PHOTO_BONUS_POINTS;
      allMultipliers.push({
        type: 'PHOTO_BONUS' as any,
        value: 1.0, // Flat bonus, not a multiplier
        label: `Photo proof (+${PHOTO_BONUS_POINTS} pts)`,
      });
    }

    const totalPoints = basePoints + bonusPoints;

    // Calculate hoursAfterLost for analytics
    const hoursAfterLost = caseLostAt
      ? (Date.now() - caseLostAt.getTime()) / (1000 * 60 * 60)
      : null;

    const dateString = getUTCDateString();

    // Use transaction with row-level locking
    const result = await this.prisma.$transaction(async (tx) => {
      // Create VerifiedAction
      const verifiedAction = await tx.verifiedAction.create({
        data: {
          userId,
          missionId,
          actionType,
          verificationMethod,
          hoursAfterLost,
          basePoints,
          bonusPoints,
          totalPoints,
          multipliers: allMultipliers.length > 0 ? JSON.stringify(allMultipliers) : null,
          metadata: metadata ? JSON.stringify(metadata) : null,
          latitude,
          longitude,
          photoUrl,
          emailId,
        },
      });

      // Upsert DailyPointsLog with row locking
      // Using raw SQL for proper row-level locking
      const existingLog = await tx.dailyPointsLog.findUnique({
        where: { userId_date: { userId, date: dateString } },
      });

      let dailyLog;
      if (existingLog) {
        dailyLog = await tx.dailyPointsLog.update({
          where: { id: existingLog.id },
          data: {
            verifiedPoints: { increment: totalPoints },
          },
        });
      } else {
        dailyLog = await tx.dailyPointsLog.create({
          data: {
            userId,
            date: dateString,
            verifiedPoints: totalPoints,
            selfReportedPoints: 0,
          },
        });
      }

      return { verifiedAction, dailyLog };
    });

    return {
      awardedPoints: totalPoints,
      basePoints,
      bonusPoints,
      multipliers: allMultipliers,
      verifiedActionId: result.verifiedAction.id,
      dailyTotals: {
        verified: result.dailyLog.verifiedPoints,
        selfReported: result.dailyLog.selfReportedPoints,
        remaining: Math.max(0, DAILY_SELF_REPORTED_CAP - result.dailyLog.selfReportedPoints),
      },
    };
  }

  /**
   * Award self-reported points (subject to daily cap)
   *
   * Updates DailyPointsLog only. Does NOT create VerifiedAction.
   */
  async awardSelfReportedPoints(params: {
    userId: string;
    points: number;
  }): Promise<{
    awardedPoints: number;
    dailyTotals: {
      verified: number;
      selfReported: number;
      remaining: number;
    };
  }> {
    const { userId, points } = params;
    const dateString = getUTCDateString();

    const result = await this.prisma.$transaction(async (tx) => {
      // Get or create daily log
      let dailyLog = await tx.dailyPointsLog.findUnique({
        where: { userId_date: { userId, date: dateString } },
      });

      if (!dailyLog) {
        dailyLog = await tx.dailyPointsLog.create({
          data: {
            userId,
            date: dateString,
            verifiedPoints: 0,
            selfReportedPoints: 0,
          },
        });
      }

      // Calculate how many points can be awarded (respect cap)
      const remainingCap = DAILY_SELF_REPORTED_CAP - dailyLog.selfReportedPoints;
      const actualPoints = Math.min(points, remainingCap);

      if (actualPoints > 0) {
        dailyLog = await tx.dailyPointsLog.update({
          where: { id: dailyLog.id },
          data: {
            selfReportedPoints: { increment: actualPoints },
          },
        });
      }

      return { dailyLog, actualPoints };
    });

    return {
      awardedPoints: result.actualPoints,
      dailyTotals: {
        verified: result.dailyLog.verifiedPoints,
        selfReported: result.dailyLog.selfReportedPoints,
        remaining: Math.max(0, DAILY_SELF_REPORTED_CAP - result.dailyLog.selfReportedPoints),
      },
    };
  }

  /**
   * Get points summary for a user
   */
  async getPointsSummary(userId: string, missionId?: string): Promise<PointsSummary> {
    const dateString = getUTCDateString();

    // Get today's points
    const todayLog = await this.prisma.dailyPointsLog.findUnique({
      where: { userId_date: { userId, date: dateString } },
    });

    // Get all-time totals
    const allTimeAgg = await this.prisma.dailyPointsLog.aggregate({
      where: { userId },
      _sum: {
        verifiedPoints: true,
        selfReportedPoints: true,
      },
    });

    // Get case-specific total if requested
    let caseTotal: number | undefined;
    if (missionId) {
      const caseAgg = await this.prisma.verifiedAction.aggregate({
        where: { userId, missionId },
        _sum: { totalPoints: true },
      });
      caseTotal = caseAgg._sum.totalPoints ?? 0;
    }

    const todayVerified = todayLog?.verifiedPoints ?? 0;
    const todaySelfReported = todayLog?.selfReportedPoints ?? 0;
    const allTimeVerified = allTimeAgg._sum.verifiedPoints ?? 0;
    const allTimeSelfReported = allTimeAgg._sum.selfReportedPoints ?? 0;

    return {
      today: {
        verified: todayVerified,
        selfReported: todaySelfReported,
        total: todayVerified + todaySelfReported,
        remaining: Math.max(0, DAILY_SELF_REPORTED_CAP - todaySelfReported),
      },
      allTime: {
        verified: allTimeVerified,
        selfReported: allTimeSelfReported,
        total: allTimeVerified + allTimeSelfReported,
      },
      caseTotal,
    };
  }

  /**
   * Get leaderboard for a case
   */
  async getCaseLeaderboard(
    missionId: string,
    limit: number = 10
  ): Promise<{
    entries: Array<{
      userId: string;
      userName: string;
      points: number;
      rank: number;
    }>;
  }> {
    // Aggregate verified points by user for this case
    const results = await this.prisma.verifiedAction.groupBy({
      by: ['userId'],
      where: { missionId },
      _sum: { totalPoints: true },
      orderBy: { _sum: { totalPoints: 'desc' } },
      take: limit,
    });

    // Get user names
    const userIds = results.map((r) => r.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const entries = results.map((r, index) => {
      const user = userMap.get(r.userId);
      return {
        userId: r.userId,
        userName: user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Unknown',
        points: r._sum.totalPoints ?? 0,
        rank: index + 1,
      };
    });

    return { entries };
  }

  /**
   * Check if user has remaining self-reported points for today
   */
  async getRemainingDailyPoints(userId: string): Promise<number> {
    const dateString = getUTCDateString();
    const todayLog = await this.prisma.dailyPointsLog.findUnique({
      where: { userId_date: { userId, date: dateString } },
    });

    const selfReported = todayLog?.selfReportedPoints ?? 0;
    return Math.max(0, DAILY_SELF_REPORTED_CAP - selfReported);
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

let pointsServiceInstance: PointsService | null = null;

export function getPointsService(prisma: PrismaClient): PointsService {
  if (!pointsServiceInstance) {
    pointsServiceInstance = new PointsService(prisma);
  }
  return pointsServiceInstance;
}
