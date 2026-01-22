/**
 * Phase 10: Analytics Service
 *
 * Server-side analytics aggregation and reporting.
 */

import prisma from './prisma';

/**
 * Get dashboard overview stats
 */
export async function getDashboardStats(dateRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);

  const [
    totalCases,
    activeMissions,
    resolvedCases,
    totalUsers,
    activeUsers,
    totalForces,
    recentMissions,
    recentReunions,
  ] = await Promise.all([
    // Total cases all time
    prisma.case.count(),

    // Active cases (LOST status)
    prisma.case.count({
      where: { status: 'LOST' },
    }),

    // Resolved cases (FOUND or REUNITED)
    prisma.case.count({
      where: { status: { in: ['FOUND', 'REUNITED'] } },
    }),

    // Total users
    prisma.user.count(),

    // Active users (logged in within dateRange)
    prisma.user.count({
      where: {
        lastLoginAt: { gte: startDate },
      },
    }),

    // Total forces
    prisma.rescueForce.count({
      where: { isActive: true },
    }),

    // Cases created in date range
    prisma.case.count({
      where: { createdAt: { gte: startDate } },
    }),

    // Reunions in date range
    prisma.case.count({
      where: {
        status: 'REUNITED',
        updatedAt: { gte: startDate },
      },
    }),
  ]);

  return {
    totalCases,
    activeMissions,
    resolvedCases,
    resolutionRate: totalCases > 0 ? (resolvedCases / totalCases * 100).toFixed(1) : 0,
    totalUsers,
    activeUsers,
    totalForces,
    recentMissions,
    recentReunions,
    dateRange,
  };
}

/**
 * Get cases by status over time
 */
export async function getCasesByStatusOverTime(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const cases = await prisma.case.findMany({
    where: {
      createdAt: { gte: startDate },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by date
  const groupedByDate = {};

  for (let i = 0; i <= days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateKey = date.toISOString().split('T')[0];
    groupedByDate[dateKey] = { date: dateKey, created: 0, resolved: 0, total: 0 };
  }

  cases.forEach((c) => {
    const dateKey = c.createdAt.toISOString().split('T')[0];
    if (groupedByDate[dateKey]) {
      groupedByDate[dateKey].created++;
      if (['FOUND', 'REUNITED'].includes(c.status)) {
        groupedByDate[dateKey].resolved++;
      }
    }
  });

  // Calculate running totals
  let runningTotal = 0;
  Object.values(groupedByDate).forEach((day) => {
    runningTotal += day.created;
    day.total = runningTotal;
  });

  return Object.values(groupedByDate);
}

/**
 * Get cases by pet type
 */
export async function getCasesByPetType() {
  const cases = await prisma.case.groupBy({
    by: ['petType'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  return cases.map((c) => ({
    type: c.petType || 'Unknown',
    count: c._count.id,
  }));
}

/**
 * Get cases by location (state)
 */
export async function getCasesByLocation() {
  const cases = await prisma.case.groupBy({
    by: ['lastSeenState'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  return cases.map((c) => ({
    state: c.lastSeenState || 'Unknown',
    count: c._count.id,
  }));
}

/**
 * Get user registration trends
 */
export async function getUserRegistrationTrends(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const users = await prisma.user.findMany({
    where: {
      createdAt: { gte: startDate },
    },
    select: {
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by date
  const groupedByDate = {};

  for (let i = 0; i <= days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateKey = date.toISOString().split('T')[0];
    groupedByDate[dateKey] = { date: dateKey, count: 0 };
  }

  users.forEach((u) => {
    const dateKey = u.createdAt.toISOString().split('T')[0];
    if (groupedByDate[dateKey]) {
      groupedByDate[dateKey].count++;
    }
  });

  return Object.values(groupedByDate);
}

/**
 * Get force activity metrics
 */
export async function getSquadMetrics() {
  const [
    totalForces,
    totalMembers,
    topForces,
  ] = await Promise.all([
    prisma.rescueForce.count({ where: { isActive: true } }),

    prisma.rescueForceMember.count({ where: { isActive: true } }),

    prisma.rescueForce.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        _count: {
          select: {
            members: { where: { isActive: true } },
            caseAssignments: true,
          },
        },
      },
      orderBy: { members: { _count: 'desc' } },
      take: 10,
    }),
  ]);

  return {
    totalForces,
    totalMembers,
    averageMembersPerForce: totalForces > 0 ? (totalMembers / totalForces).toFixed(1) : 0,
    topForces: topForces.map((s) => ({
      id: s.id,
      name: s.name,
      location: `${s.city}, ${s.state}`,
      members: s._count.members,
      cases: s._count.caseAssignments,
    })),
  };
}

/**
 * Get engagement metrics
 */
export async function getEngagementMetrics(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [
    shareEvents,
    sightingReports,
    notifications,
  ] = await Promise.all([
    // Share events
    prisma.shareEvent.groupBy({
      by: ['platform'],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
    }),

    // Sighting reports
    prisma.sighting.count({
      where: { createdAt: { gte: startDate } },
    }),

    // Notifications sent
    prisma.notification.count({
      where: { createdAt: { gte: startDate } },
    }),
  ]);

  return {
    shares: {
      total: shareEvents.reduce((sum, e) => sum + e._count.id, 0),
      byPlatform: shareEvents.map((e) => ({
        platform: e.platform,
        count: e._count.id,
      })),
    },
    sightingReports,
    notificationsSent: notifications,
  };
}

/**
 * Get resolution time metrics
 */
export async function getResolutionTimeMetrics() {
  const resolvedCases = await prisma.case.findMany({
    where: {
      status: { in: ['FOUND', 'REUNITED'] },
    },
    select: {
      createdAt: true,
      updatedAt: true,
      status: true,
    },
  });

  if (resolvedCases.length === 0) {
    return {
      averageDays: 0,
      medianDays: 0,
      distribution: [],
    };
  }

  const resolutionTimes = resolvedCases.map((c) => {
    const created = new Date(c.createdAt);
    const resolved = new Date(c.updatedAt);
    return Math.floor((resolved - created) / (1000 * 60 * 60 * 24));
  });

  resolutionTimes.sort((a, b) => a - b);

  const average = resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length;
  const median = resolutionTimes[Math.floor(resolutionTimes.length / 2)];

  // Distribution buckets
  const distribution = {
    'Same day': resolutionTimes.filter((d) => d === 0).length,
    '1-3 days': resolutionTimes.filter((d) => d >= 1 && d <= 3).length,
    '4-7 days': resolutionTimes.filter((d) => d >= 4 && d <= 7).length,
    '1-2 weeks': resolutionTimes.filter((d) => d >= 8 && d <= 14).length,
    '2-4 weeks': resolutionTimes.filter((d) => d >= 15 && d <= 30).length,
    '1+ month': resolutionTimes.filter((d) => d > 30).length,
  };

  return {
    averageDays: average.toFixed(1),
    medianDays: median,
    totalResolved: resolvedCases.length,
    distribution: Object.entries(distribution).map(([range, count]) => ({
      range,
      count,
    })),
  };
}

/**
 * Record an analytics event
 */
export async function trackEvent(eventData) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        eventType: eventData.eventType,
        userId: eventData.userId || null,
        missionId: eventData.missionId || null,
        metadata: eventData.metadata ? JSON.stringify(eventData.metadata) : null,
        ipAddress: eventData.ipAddress || null,
        userAgent: eventData.userAgent || null,
      },
    });
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

/**
 * Update daily stats (run via cron job)
 */
export async function updateDailyStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = await getDashboardStats(1);

  await prisma.dailyStats.upsert({
    where: { date: today },
    create: {
      date: today,
      newCases: stats.recentMissions,
      resolvedCases: stats.recentReunions,
      newUsers: stats.activeUsers,
      activeUsers: stats.activeUsers,
      shares: 0, // Would need to calculate
      sightings: 0, // Would need to calculate
    },
    update: {
      newCases: stats.recentMissions,
      resolvedCases: stats.recentReunions,
      newUsers: stats.activeUsers,
      activeUsers: stats.activeUsers,
    },
  });

  return stats;
}

export default {
  getDashboardStats,
  getCasesByStatusOverTime,
  getCasesByPetType,
  getCasesByLocation,
  getUserRegistrationTrends,
  getSquadMetrics,
  getEngagementMetrics,
  getResolutionTimeMetrics,
  trackEvent,
  updateDailyStats,
};
