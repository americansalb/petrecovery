import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// GET /api/analytics/dashboard - Get analytics dashboard data
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
    const range = searchParams.get('range') || '30d';
    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Parallel queries for performance
    const [
      userStats,
      caseStats,
      squadStats,
      recentActivity,
      dailyStats,
      topForces,
      caseResolutions,
    ] = await Promise.all([
      // User stats
      prisma.user.aggregate({
        _count: true,
        where: { createdAt: { gte: startDate } },
      }).then(async (newUsers) => {
        const totalUsers = await prisma.user.count();
        const activeUsers = await prisma.user.count({
          where: { lastActive: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        });
        return {
          total: totalUsers,
          new: newUsers._count,
          active: activeUsers,
        };
      }),

      // Case stats
      prisma.case.groupBy({
        by: ['status'],
        _count: true,
      }).then(async (byStatus) => {
        const newCases = await prisma.case.count({
          where: { createdAt: { gte: startDate } },
        });
        const reunited = await prisma.case.count({
          where: {
            status: 'REUNITED',
            resolvedAt: { gte: startDate },
          },
        });
        return {
          byStatus: byStatus.reduce((acc, { status, _count }) => {
            acc[status] = _count;
            return acc;
          }, {}),
          new: newCases,
          reunited,
        };
      }),

      // Force stats
      prisma.rescueForce.aggregate({
        _count: true,
        _avg: {
          totalCasesCompleted: true,
          successfulReunions: true,
        },
      }).then(async (agg) => {
        const activeForces = await prisma.rescueForce.count({
          where: { isActive: true, isAcceptingCases: true },
        });
        const totalMembers = await prisma.rescueForceMember.count({
          where: { isActive: true },
        });
        return {
          total: agg._count,
          active: activeForces,
          members: totalMembers,
          avgCasesCompleted: Math.round(agg._avg.totalCasesCompleted || 0),
          avgReunions: Math.round(agg._avg.successfulReunions || 0),
        };
      }),

      // Recent activity
      prisma.eventLog.findMany({
        where: {
          timestamp: { gte: startDate },
          event_type: {
            in: ['case.created', 'case.resolved', 'force.created', 'user.registered'],
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 20,
      }),

      // Daily stats for charts
      prisma.dailyStats.findMany({
        where: { date: { gte: startDate } },
        orderBy: { date: 'asc' },
      }),

      // Top performing forces
      prisma.rescueForce.findMany({
        where: { isActive: true },
        orderBy: { successfulReunions: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          successfulReunions: true,
          totalCasesCompleted: true,
          _count: {
            select: { members: { where: { isActive: true } } },
          },
        },
      }),

      // Case resolution breakdown
      prisma.case.groupBy({
        by: ['resolution'],
        _count: true,
        where: {
          resolvedAt: { gte: startDate },
          resolution: { not: null },
        },
      }),
    ]);

    return NextResponse.json({
      range,
      users: userStats,
      cases: caseStats,
      forces: squadStats,
      recentActivity,
      dailyStats,
      topForces: topForces.map((s) => ({
        ...s,
        memberCount: s._count.members,
      })),
      resolutions: caseResolutions.reduce((acc, { resolution, _count }) => {
        acc[resolution] = _count;
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
