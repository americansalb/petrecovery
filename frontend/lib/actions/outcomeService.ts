/**
 * Case Outcome Service
 *
 * Handles case closure with outcome recording for ML training.
 * Aggregates verified actions and computes analytics metrics.
 *
 * Per Actions_Guide.md Phase 6 specification.
 */

import { PrismaClient, OutcomeType, FoundMethod, Prisma, CaseResolution } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export interface CloseCase {
  caseId: string;
  outcome: OutcomeType;
  foundMethod?: FoundMethod;
  foundMethodDetails?: string;
  petBehavior?: 'INDOOR' | 'OUTDOOR' | 'SKITTISH' | 'FRIENDLY';
  locationType?: 'URBAN' | 'SUBURBAN' | 'RURAL';
  ownerFeedback?: string;
  helpfulActions?: string[];
  closedBy: string;
}

export interface ActionSummary {
  actionType: string;
  count: number;
  avgHoursAfterLost: number;
}

export interface CaseMetrics {
  verifiedActionsCount: number;
  verifiedActionsSummary: ActionSummary[];
  totalSearchHours: number;
  totalFlyersPosted: number;
  totalSheltersContacted: number;
  sightingsCount: number;
  teamMembersCount: number;
  timeToReunionHours: number | null;
}

export interface AnalyticsInsight {
  actionType: string;
  avgHoursToReunion: number;
  caseCount: number;
  successRate: number;
}

// =============================================================================
// OUTCOME SERVICE CLASS
// =============================================================================

export class OutcomeService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Close a case and record the outcome for ML training
   */
  async closeCase(input: CloseCase): Promise<{ success: boolean; outcomeId?: string; error?: string }> {
    try {
      const caseData = await this.prisma.case.findUnique({
        where: { id: input.caseId },
        select: {
          id: true,
          createdAt: true,
          petSpecies: true,
          petSize: true,
          status: true,
          caseOutcome: { select: { id: true } },
        },
      });

      if (!caseData) {
        return { success: false, error: 'Case not found' };
      }

      if (caseData.caseOutcome) {
        return { success: false, error: 'Case already has an outcome recorded' };
      }

      // Compute metrics
      const metrics = await this.computeCaseMetrics(input.caseId, caseData.createdAt);

      // Fetch current weather if available (for context)
      let weatherConditions: string | undefined;
      const caseWithLocation = await this.prisma.case.findUnique({
        where: { id: input.caseId },
        select: { lastSeenLatitude: true, lastSeenLongitude: true },
      });
      if (caseWithLocation?.lastSeenLatitude && caseWithLocation?.lastSeenLongitude) {
        weatherConditions = await this.fetchWeatherSnapshot(
          caseWithLocation.lastSeenLatitude,
          caseWithLocation.lastSeenLongitude
        );
      }

      // Create outcome record
      const outcome = await this.prisma.$transaction(async (tx) => {
        // Create CaseOutcome
        const outcomeRecord = await tx.caseOutcome.create({
          data: {
            caseId: input.caseId,
            outcome: input.outcome,
            foundMethod: input.foundMethod,
            foundMethodDetails: input.foundMethodDetails,
            timeToReunionHours: metrics.timeToReunionHours,
            petType: caseData.petSpecies,
            petBehavior: input.petBehavior,
            petSize: caseData.petSize,
            locationType: input.locationType,
            weatherConditions,
            verifiedActionsCount: metrics.verifiedActionsCount,
            verifiedActionsSummary: metrics.verifiedActionsSummary as unknown as Prisma.InputJsonValue,
            totalSearchHours: metrics.totalSearchHours,
            totalFlyersPosted: metrics.totalFlyersPosted,
            totalSheltersContacted: metrics.totalSheltersContacted,
            sightingsCount: metrics.sightingsCount,
            teamMembersCount: metrics.teamMembersCount,
            ownerFeedback: input.ownerFeedback,
            helpfulActions: input.helpfulActions || [],
            createdBy: input.closedBy,
          },
        });

        // Update case status
        const newStatus = input.outcome === 'REUNITED' ? 'REUNITED' : 'CLOSED_OTHER';
        await tx.case.update({
          where: { id: input.caseId },
          data: {
            status: newStatus,
            resolvedAt: new Date(),
            resolution: this.mapOutcomeToResolution(input.outcome, input.foundMethod),
          },
        });

        return outcomeRecord;
      });

      return { success: true, outcomeId: outcome.id };
    } catch (error) {
      console.error('Error closing case:', error);
      return { success: false, error: 'Failed to close case' };
    }
  }

  /**
   * Compute all metrics for a case
   */
  async computeCaseMetrics(caseId: string, caseCreatedAt: Date): Promise<CaseMetrics> {
    // Get verified actions with aggregation
    const verifiedActions = await this.prisma.verifiedAction.findMany({
      where: { caseId },
      select: {
        actionType: true,
        createdAt: true,
        hoursAfterLost: true,
      },
    });

    // Aggregate by action type
    const actionGroups = new Map<string, { count: number; totalHours: number }>();
    for (const action of verifiedActions) {
      const existing = actionGroups.get(action.actionType) || { count: 0, totalHours: 0 };
      actionGroups.set(action.actionType, {
        count: existing.count + 1,
        totalHours: existing.totalHours + (action.hoursAfterLost || 0),
      });
    }

    const verifiedActionsSummary: ActionSummary[] = Array.from(actionGroups.entries()).map(
      ([actionType, data]) => ({
        actionType,
        count: data.count,
        avgHoursAfterLost: data.count > 0 ? data.totalHours / data.count : 0,
      })
    );

    // Get search sessions for total hours
    const searchSessions = await this.prisma.searchSession.findMany({
      where: { caseId },
      select: { startedAt: true, endedAt: true },
    });
    const totalSearchHours = searchSessions.reduce((sum, s) => {
      if (s.startedAt && s.endedAt) {
        const durationMs = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
        return sum + durationMs / (1000 * 60 * 60);
      }
      return sum;
    }, 0);

    // Get flyer count
    const totalFlyersPosted = await this.prisma.flyerPosting.count({ where: { caseId } });

    // Get shelter contacts
    const totalSheltersContacted = await this.prisma.shelterContact.count({ where: { caseId } });

    // Get sightings count
    const sightingsCount = await this.prisma.caseSighting.count({ where: { caseId } });

    // Get unique team members (from case participants via assignments)
    const participants = await this.prisma.caseParticipant.findMany({
      where: {
        assignment: { caseId }
      },
      select: { userId: true },
    });
    const teamMembersCount = new Set(participants.map((p) => p.userId)).size;

    // Calculate time to reunion
    const timeToReunionHours = (Date.now() - caseCreatedAt.getTime()) / (1000 * 60 * 60);

    return {
      verifiedActionsCount: verifiedActions.length,
      verifiedActionsSummary,
      totalSearchHours: Math.round(totalSearchHours * 100) / 100,
      totalFlyersPosted,
      totalSheltersContacted,
      sightingsCount,
      teamMembersCount,
      timeToReunionHours: Math.round(timeToReunionHours * 100) / 100,
    };
  }

  /**
   * Get analytics insights for algorithm training
   */
  async getAnalyticsInsights(): Promise<{
    actionEffectiveness: AnalyticsInsight[];
    reunionStats: {
      totalCases: number;
      reunited: number;
      avgTimeToReunion: number;
      byPetType: { petType: string; count: number; avgHours: number }[];
      byFoundMethod: { method: string; count: number }[];
    };
    actionCorrelations: {
      earlyActions: { actionType: string; avgReunionHours: number; count: number }[];
    };
  }> {
    // Get all outcomes
    const outcomes = await this.prisma.caseOutcome.findMany({
      where: { outcome: 'REUNITED' },
      select: {
        timeToReunionHours: true,
        petType: true,
        foundMethod: true,
        verifiedActionsSummary: true,
        verifiedActionsCount: true,
      },
    });

    // Action effectiveness: which actions correlate with faster reunions
    const actionStats = new Map<string, { totalHours: number; count: number }>();
    for (const o of outcomes) {
      const summary = o.verifiedActionsSummary as unknown as ActionSummary[];
      if (Array.isArray(summary)) {
        for (const action of summary) {
          const existing = actionStats.get(action.actionType) || { totalHours: 0, count: 0 };
          actionStats.set(action.actionType, {
            totalHours: existing.totalHours + (o.timeToReunionHours || 0),
            count: existing.count + 1,
          });
        }
      }
    }

    const actionEffectiveness: AnalyticsInsight[] = Array.from(actionStats.entries())
      .map(([actionType, data]) => ({
        actionType,
        avgHoursToReunion: data.count > 0 ? data.totalHours / data.count : 0,
        caseCount: data.count,
        successRate: (data.count / outcomes.length) * 100,
      }))
      .sort((a, b) => a.avgHoursToReunion - b.avgHoursToReunion);

    // Reunion stats by pet type
    const petTypeStats = new Map<string, { count: number; totalHours: number }>();
    for (const o of outcomes) {
      const existing = petTypeStats.get(o.petType) || { count: 0, totalHours: 0 };
      petTypeStats.set(o.petType, {
        count: existing.count + 1,
        totalHours: existing.totalHours + (o.timeToReunionHours || 0),
      });
    }

    // Found method distribution
    const foundMethodStats = new Map<string, number>();
    for (const o of outcomes) {
      if (o.foundMethod) {
        foundMethodStats.set(o.foundMethod, (foundMethodStats.get(o.foundMethod) || 0) + 1);
      }
    }

    // Total case counts
    const totalCases = await this.prisma.caseOutcome.count();
    const reunitedCount = outcomes.length;
    const avgTimeToReunion =
      outcomes.length > 0
        ? outcomes.reduce((sum, o) => sum + (o.timeToReunionHours || 0), 0) / outcomes.length
        : 0;

    // Early action correlation (actions done within first 6 hours)
    const earlyActionStats = new Map<string, { totalReunionHours: number; count: number }>();
    for (const o of outcomes) {
      const summary = o.verifiedActionsSummary as unknown as ActionSummary[];
      if (Array.isArray(summary)) {
        for (const action of summary) {
          if (action.avgHoursAfterLost < 6) {
            const existing = earlyActionStats.get(action.actionType) || {
              totalReunionHours: 0,
              count: 0,
            };
            earlyActionStats.set(action.actionType, {
              totalReunionHours: existing.totalReunionHours + (o.timeToReunionHours || 0),
              count: existing.count + action.count,
            });
          }
        }
      }
    }

    return {
      actionEffectiveness,
      reunionStats: {
        totalCases,
        reunited: reunitedCount,
        avgTimeToReunion: Math.round(avgTimeToReunion * 100) / 100,
        byPetType: Array.from(petTypeStats.entries()).map(([petType, data]) => ({
          petType,
          count: data.count,
          avgHours: Math.round((data.totalHours / data.count) * 100) / 100,
        })),
        byFoundMethod: Array.from(foundMethodStats.entries()).map(([method, count]) => ({
          method,
          count,
        })),
      },
      actionCorrelations: {
        earlyActions: Array.from(earlyActionStats.entries())
          .map(([actionType, data]) => ({
            actionType,
            avgReunionHours:
              data.count > 0 ? Math.round((data.totalReunionHours / data.count) * 100) / 100 : 0,
            count: data.count,
          }))
          .sort((a, b) => a.avgReunionHours - b.avgReunionHours),
      },
    };
  }

  /**
   * Get case-specific analytics for display
   */
  async getCaseAnalytics(caseId: string): Promise<CaseMetrics | null> {
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: { createdAt: true },
    });

    if (!caseData) return null;

    return this.computeCaseMetrics(caseId, caseData.createdAt);
  }

  /**
   * Fetch weather snapshot for context
   */
  private async fetchWeatherSnapshot(lat: number, lng: number): Promise<string | undefined> {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return undefined;

      const data = await response.json();
      const current = data.current;

      if (!current) return undefined;

      return JSON.stringify({
        temperature: current.temperature_2m,
        weatherCode: current.weather_code,
        windSpeed: current.wind_speed_10m,
      });
    } catch {
      return undefined;
    }
  }

  /**
   * Map OutcomeType to CaseResolution enum
   */
  private mapOutcomeToResolution(
    outcome: OutcomeType,
    foundMethod?: FoundMethod
  ): CaseResolution {
    if (outcome === 'REUNITED') {
      if (foundMethod === 'CAME_HOME') return CaseResolution.CAME_HOME;
      if (foundMethod === 'SHELTER_INTAKE') return CaseResolution.FOUND_AT_SHELTER;
      return CaseResolution.REUNITED;
    }
    if (outcome === 'DECEASED') return CaseResolution.DECEASED;
    return CaseResolution.SEARCH_CEASED;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

let outcomeServiceInstance: OutcomeService | null = null;

export function getOutcomeService(prisma: PrismaClient): OutcomeService {
  if (!outcomeServiceInstance) {
    outcomeServiceInstance = new OutcomeService(prisma);
  }
  return outcomeServiceInstance;
}
