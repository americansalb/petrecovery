/**
 * Analytics API
 *
 * GET /api/analytics - Get platform-wide analytics insights
 *
 * Per Actions_Guide.md Phase 6 specification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { getOutcomeService } from '@/lib/actions';

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /api/analytics
 *
 * Get analytics insights for the dashboard
 *
 * Query params:
 * - type: 'overview' | 'actions' | 'full' (default: 'overview')
 * - petType: 'CAT' | 'DOG' | 'ALL' (default: 'ALL')
 * - period: 'week' | 'month' | 'year' | 'all' (default: 'all')
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const petType = searchParams.get('petType') || 'ALL';
    const period = searchParams.get('period') || 'all';

    // Calculate date filter
    let dateFilter: Date | undefined;
    const now = new Date();
    if (period === 'week') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === 'year') {
      dateFilter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    // Build where clause for outcomes
    const outcomeWhere: Record<string, unknown> = {};
    if (petType !== 'ALL') {
      outcomeWhere.petType = petType;
    }
    if (dateFilter) {
      outcomeWhere.createdAt = { gte: dateFilter };
    }

    if (type === 'overview') {
      // Basic overview stats
      const [totalCases, activeCases, reunitedCases, avgTimeToReunion] = await Promise.all([
        prisma.case.count({
          where: dateFilter ? { createdAt: { gte: dateFilter } } : undefined,
        }),
        prisma.case.count({
          where: {
            status: { in: ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'] },
            ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
          },
        }),
        prisma.caseOutcome.count({
          where: { outcome: 'REUNITED', ...outcomeWhere },
        }),
        prisma.caseOutcome.aggregate({
          where: { outcome: 'REUNITED', ...outcomeWhere },
          _avg: { timeToReunionHours: true },
        }),
      ]);

      // Recent reunions
      const recentReunions = await prisma.caseOutcome.findMany({
        where: { outcome: 'REUNITED', ...outcomeWhere },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          case: {
            select: { petName: true, petSpecies: true },
          },
        },
      });

      // Found method distribution
      const foundMethodCounts = await prisma.caseOutcome.groupBy({
        by: ['foundMethod'],
        where: { outcome: 'REUNITED', foundMethod: { not: null }, ...outcomeWhere },
        _count: true,
      });

      return NextResponse.json({
        overview: {
          totalCases,
          activeCases,
          reunitedCases,
          reunionRate: totalCases > 0 ? Math.round((reunitedCases / totalCases) * 100) : 0,
          avgTimeToReunionHours: Math.round((avgTimeToReunion._avg.timeToReunionHours || 0) * 10) / 10,
        },
        recentReunions: recentReunions.map((r) => ({
          petName: r.case.petName,
          petType: r.case.petSpecies,
          foundMethod: r.foundMethod,
          timeToReunionHours: r.timeToReunionHours,
          date: r.createdAt,
        })),
        foundMethodDistribution: foundMethodCounts.map((f) => ({
          method: f.foundMethod,
          count: f._count,
        })),
      });
    }

    if (type === 'actions') {
      // Action effectiveness analysis
      const outcomeService = getOutcomeService(prisma);
      const insights = await outcomeService.getAnalyticsInsights();

      return NextResponse.json({
        actionEffectiveness: insights.actionEffectiveness,
        earlyActionCorrelations: insights.actionCorrelations.earlyActions,
      });
    }

    if (type === 'full') {
      // Full analytics (combines overview + actions)
      const outcomeService = getOutcomeService(prisma);
      const insights = await outcomeService.getAnalyticsInsights();

      // Additional metrics
      const [
        totalVerifiedActions,
        totalSearchSessions,
        totalFlyersPosted,
        totalSheltersContacted,
      ] = await Promise.all([
        prisma.verifiedAction.count({
          where: dateFilter ? { createdAt: { gte: dateFilter } } : undefined,
        }),
        prisma.searchSession.count({
          where: dateFilter ? { createdAt: { gte: dateFilter } } : undefined,
        }),
        prisma.flyerPosting.count({
          where: dateFilter ? { createdAt: { gte: dateFilter } } : undefined,
        }),
        prisma.shelterContact.count({
          where: dateFilter ? { createdAt: { gte: dateFilter } } : undefined,
        }),
      ]);

      // Pet type breakdown
      const petTypeBreakdown = await prisma.caseOutcome.groupBy({
        by: ['petType'],
        where: outcomeWhere,
        _count: true,
        _avg: { timeToReunionHours: true },
      });

      return NextResponse.json({
        reunionStats: insights.reunionStats,
        actionEffectiveness: insights.actionEffectiveness,
        earlyActionCorrelations: insights.actionCorrelations.earlyActions,
        activityMetrics: {
          totalVerifiedActions,
          totalSearchSessions,
          totalFlyersPosted,
          totalSheltersContacted,
        },
        petTypeBreakdown: petTypeBreakdown.map((p) => ({
          petType: p.petType,
          count: p._count,
          avgTimeToReunionHours: Math.round((p._avg.timeToReunionHours || 0) * 10) / 10,
        })),
      });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
