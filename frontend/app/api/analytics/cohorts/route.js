import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// GET /api/analytics/cohorts - Get cohort analysis data
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'retention';
    const months = parseInt(searchParams.get('months') || '6', 10);

    switch (type) {
      case 'retention':
        return NextResponse.json(await getRetentionCohorts(months));

      case 'conversion':
        return NextResponse.json(await getConversionCohorts(months));

      case 'engagement':
        return NextResponse.json(await getEngagementCohorts(months));

      default:
        return NextResponse.json({ error: 'Invalid cohort type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Cohort analysis error:', error);
    return NextResponse.json({ error: 'Failed to fetch cohort data' }, { status: 500 });
  }
}

async function getRetentionCohorts(months) {
  const cohorts = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const cohortStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const cohortEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    // Users who joined in this month
    const cohortUsers = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: cohortStart,
          lte: cohortEnd,
        },
      },
      select: { id: true, createdAt: true, lastActive: true },
    });

    const retention = [];
    const cohortSize = cohortUsers.length;

    // Calculate retention for each subsequent month
    for (let j = 0; j <= i; j++) {
      const retentionStart = new Date(now.getFullYear(), now.getMonth() - i + j, 1);
      const retentionEnd = new Date(now.getFullYear(), now.getMonth() - i + j + 1, 0);

      const activeCount = cohortUsers.filter((u) => {
        const lastActive = new Date(u.lastActive);
        return lastActive >= retentionStart && lastActive <= retentionEnd;
      }).length;

      retention.push({
        month: j,
        count: activeCount,
        rate: cohortSize > 0 ? Math.round((activeCount / cohortSize) * 100) : 0,
      });
    }

    cohorts.push({
      cohort: cohortStart.toISOString().slice(0, 7), // YYYY-MM
      size: cohortSize,
      retention,
    });
  }

  return { type: 'retention', cohorts };
}

async function getConversionCohorts(months) {
  const cohorts = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const cohortStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const cohortEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    // Users who joined in this month
    const cohortUsers = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: cohortStart,
          lte: cohortEnd,
        },
      },
      select: {
        id: true,
        rescueSquadMemberships: { select: { id: true } },
        cases: { select: { id: true } },
        caseParticipations: { select: { id: true } },
      },
    });

    const cohortSize = cohortUsers.length;

    // Calculate conversion metrics
    const joinedSquad = cohortUsers.filter((u) => u.rescueSquadMemberships.length > 0).length;
    const reportedCase = cohortUsers.filter((u) => u.cases.length > 0).length;
    const participatedInCase = cohortUsers.filter((u) => u.caseParticipations.length > 0).length;

    cohorts.push({
      cohort: cohortStart.toISOString().slice(0, 7),
      size: cohortSize,
      conversions: {
        joinedSquad: {
          count: joinedSquad,
          rate: cohortSize > 0 ? Math.round((joinedSquad / cohortSize) * 100) : 0,
        },
        reportedCase: {
          count: reportedCase,
          rate: cohortSize > 0 ? Math.round((reportedCase / cohortSize) * 100) : 0,
        },
        participatedInCase: {
          count: participatedInCase,
          rate: cohortSize > 0 ? Math.round((participatedInCase / cohortSize) * 100) : 0,
        },
      },
    });
  }

  return { type: 'conversion', cohorts };
}

async function getEngagementCohorts(months) {
  const cohorts = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const cohortStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const cohortEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    // Users who joined in this month
    const cohortUsers = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: cohortStart,
          lte: cohortEnd,
        },
      },
      select: {
        id: true,
        rescueLevel: true,
        squadsJoinedCount: true,
        areasMarkedCount: true,
        successfulReunions: true,
      },
    });

    const cohortSize = cohortUsers.length;

    // Calculate engagement levels
    const levelDistribution = cohortUsers.reduce((acc, u) => {
      acc[u.rescueLevel] = (acc[u.rescueLevel] || 0) + 1;
      return acc;
    }, {});

    const avgMetrics = {
      squadsJoined: cohortSize > 0
        ? Math.round(cohortUsers.reduce((sum, u) => sum + u.squadsJoinedCount, 0) / cohortSize * 10) / 10
        : 0,
      areasMarked: cohortSize > 0
        ? Math.round(cohortUsers.reduce((sum, u) => sum + u.areasMarkedCount, 0) / cohortSize * 10) / 10
        : 0,
      reunions: cohortSize > 0
        ? Math.round(cohortUsers.reduce((sum, u) => sum + u.successfulReunions, 0) / cohortSize * 100) / 100
        : 0,
    };

    cohorts.push({
      cohort: cohortStart.toISOString().slice(0, 7),
      size: cohortSize,
      levelDistribution,
      avgMetrics,
    });
  }

  return { type: 'engagement', cohorts };
}
