/**
 * Phase 9: Engagement System
 *
 * Streaks, leaderboards, and retention mechanics.
 * Keep volunteers coming back and feeling valued.
 */

import prisma from '@/app/lib/prisma';

/**
 * Get user's engagement stats including streaks
 */
export async function getEngagementStats(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      rescueLevel: true,
      currentStreak: true,
      longestStreak: true,
      lastActiveDate: true,
      totalSearchDays: true,
    }
  });

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Check and update streak
  const streakInfo = await updateStreak(userId);

  // Get badges
  const badges = await getUserBadges(userId);

  // Get weekly activity
  const weeklyActivity = await getWeeklyActivity(userId);

  return {
    success: true,
    streak: {
      current: streakInfo.currentStreak,
      longest: streakInfo.longestStreak,
      isActive: streakInfo.isActiveToday,
      willExpire: streakInfo.willExpire,
    },
    badges,
    weeklyActivity,
    rescueLevel: user.rescueLevel,
    totalSearchDays: user.totalSearchDays,
  };
}

/**
 * Update user's streak
 */
async function updateStreak(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate) : null;
  if (lastActive) {
    lastActive.setHours(0, 0, 0, 0);
  }

  let currentStreak = user.currentStreak || 0;
  let longestStreak = user.longestStreak || 0;
  let isActiveToday = false;
  let willExpire = false;

  // Check if user was active today
  const todayActivity = await prisma.searchSession.findFirst({
    where: {
      participant: { userId },
      createdAt: { gte: today },
    }
  });

  if (todayActivity) {
    isActiveToday = true;

    // Check if this extends the streak
    if (!lastActive || lastActive.getTime() < yesterday.getTime()) {
      // Streak was broken or this is first activity
      currentStreak = 1;
    } else if (lastActive.getTime() === yesterday.getTime()) {
      // Continuing streak from yesterday
      currentStreak++;
    }
    // If lastActive is today, streak stays the same

    // Update longest streak
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    // Update user
    await prisma.user.update({
      where: { id: userId },
      data: {
        currentStreak,
        longestStreak,
        lastActiveDate: today,
        totalSearchDays: { increment: lastActive?.getTime() === today.getTime() ? 0 : 1 },
      }
    });
  } else {
    // Not active today
    if (lastActive && lastActive.getTime() === yesterday.getTime()) {
      // Streak will expire if no activity today
      willExpire = true;
    } else if (!lastActive || lastActive.getTime() < yesterday.getTime()) {
      // Streak already expired
      currentStreak = 0;
      await prisma.user.update({
        where: { id: userId },
        data: { currentStreak: 0 }
      });
    }
  }

  return {
    currentStreak,
    longestStreak,
    isActiveToday,
    willExpire,
  };
}

/**
 * Get user's badges
 */
async function getUserBadges(userId) {
  const achievements = await prisma.userAchievement.findMany({
    where: { userId },
    orderBy: { earnedAt: 'desc' },
  });

  // Get progress towards unearned badges
  const stats = await getVolunteerStats(userId);
  const allBadges = getBadgeDefinitions();

  return allBadges.map(badge => {
    const earned = achievements.find(a => a.achievementType === badge.id);
    const progress = calculateBadgeProgress(badge, stats);

    return {
      id: badge.id,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      earned: !!earned,
      earnedAt: earned?.earnedAt,
      progress: earned ? 100 : progress,
      requirement: badge.requirement,
    };
  });
}

/**
 * Get all badge definitions
 */
function getBadgeDefinitions() {
  return [
    {
      id: 'FIRST_SEARCH',
      name: 'First Steps',
      description: 'Complete your first search session',
      icon: '🐾',
      requirement: { type: 'sessions', count: 1 },
    },
    {
      id: 'EARLY_BIRD',
      name: 'Early Bird',
      description: 'Start a search before 7 AM',
      icon: '🌅',
      requirement: { type: 'earlySearch', count: 1 },
    },
    {
      id: 'NIGHT_OWL',
      name: 'Night Owl',
      description: 'Search after 10 PM',
      icon: '🦉',
      requirement: { type: 'lateSearch', count: 1 },
    },
    {
      id: 'STREAK_7',
      name: 'Week Warrior',
      description: 'Maintain a 7-day streak',
      icon: '🔥',
      requirement: { type: 'streak', count: 7 },
    },
    {
      id: 'STREAK_30',
      name: 'Monthly Hero',
      description: 'Maintain a 30-day streak',
      icon: '💪',
      requirement: { type: 'streak', count: 30 },
    },
    {
      id: 'AREAS_10',
      name: 'Explorer',
      description: 'Search 10 areas',
      icon: '🗺️',
      requirement: { type: 'areasSearched', count: 10 },
    },
    {
      id: 'AREAS_100',
      name: 'Pathfinder',
      description: 'Search 100 areas',
      icon: '🧭',
      requirement: { type: 'areasSearched', count: 100 },
    },
    {
      id: 'HOURS_10',
      name: 'Dedicated',
      description: 'Log 10 hours of searching',
      icon: '⏰',
      requirement: { type: 'searchHours', count: 10 },
    },
    {
      id: 'HOURS_50',
      name: 'Committed',
      description: 'Log 50 hours of searching',
      icon: '🏅',
      requirement: { type: 'searchHours', count: 50 },
    },
    {
      id: 'SIGHTING_REPORTER',
      name: 'Sharp Eyes',
      description: 'Report 5 sightings',
      icon: '👀',
      requirement: { type: 'sightings', count: 5 },
    },
    {
      id: 'PET_FINDER',
      name: 'Pet Finder',
      description: 'Find a lost pet',
      icon: '🏆',
      requirement: { type: 'petsFound', count: 1 },
    },
    {
      id: 'MULTI_FINDER',
      name: 'Rescue Hero',
      description: 'Find 5 lost pets',
      icon: '🦸',
      requirement: { type: 'petsFound', count: 5 },
    },
    {
      id: 'TEAM_PLAYER',
      name: 'Team Player',
      description: 'Help with 10 different cases',
      icon: '🤝',
      requirement: { type: 'casesHelped', count: 10 },
    },
  ];
}

/**
 * Calculate badge progress
 */
function calculateBadgeProgress(badge, stats) {
  const { type, count } = badge.requirement;

  switch (type) {
    case 'sessions':
      return Math.min(100, Math.round((stats.totalSessions / count) * 100));
    case 'streak':
      return Math.min(100, Math.round((stats.longestStreak / count) * 100));
    case 'areasSearched':
      return Math.min(100, Math.round((stats.totalAreasSearched / count) * 100));
    case 'searchHours':
      return Math.min(100, Math.round((stats.totalSearchHours / count) * 100));
    case 'sightings':
      return Math.min(100, Math.round((stats.totalSightings / count) * 100));
    case 'petsFound':
      return Math.min(100, Math.round((stats.petsFound / count) * 100));
    case 'casesHelped':
      return Math.min(100, Math.round((stats.casesHelped / count) * 100));
    default:
      return 0;
  }
}

/**
 * Get volunteer stats for badge calculation
 */
async function getVolunteerStats(userId) {
  const participations = await prisma.caseParticipant.findMany({
    where: { userId },
    include: {
      assignment: {
        include: {
          case: { select: { foundById: true } }
        }
      }
    }
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { longestStreak: true }
  });

  const sessions = await prisma.searchSession.count({
    where: { participant: { userId } }
  });

  let totalSearchHours = 0;
  let totalAreasSearched = 0;
  let totalSightings = 0;
  let petsFound = 0;

  for (const p of participations) {
    totalSearchHours += p.searchHours;
    totalAreasSearched += p.areasMarked;
    totalSightings += p.sightingsReported;

    if (p.assignment.case.foundById === userId) {
      petsFound++;
    }
  }

  return {
    totalSessions: sessions,
    longestStreak: user?.longestStreak || 0,
    totalAreasSearched,
    totalSearchHours,
    totalSightings,
    petsFound,
    casesHelped: participations.length,
  };
}

/**
 * Get weekly activity heatmap
 */
async function getWeeklyActivity(userId) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const sessions = await prisma.searchSession.findMany({
    where: {
      participant: { userId },
      createdAt: { gte: sevenDaysAgo },
    },
    select: {
      createdAt: true,
      totalMinutes: true,
    }
  });

  // Group by day
  const activity = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    activity[dateKey] = { sessions: 0, minutes: 0 };
  }

  for (const session of sessions) {
    const dateKey = session.createdAt.toISOString().split('T')[0];
    if (activity[dateKey]) {
      activity[dateKey].sessions++;
      activity[dateKey].minutes += session.totalMinutes || 0;
    }
  }

  return Object.entries(activity)
    .map(([date, data]) => ({ date, ...data }))
    .reverse();
}

/**
 * Get division leaderboard
 */
export async function getDivisionLeaderboard(divisionId, period = 'week') {
  const startDate = new Date();
  if (period === 'week') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === 'month') {
    startDate.setMonth(startDate.getMonth() - 1);
  }

  const members = await prisma.squadMembership.findMany({
    where: {
      divisionId,
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          rescueLevel: true,
        }
      }
    }
  });

  const leaderboard = [];

  for (const member of members) {
    // Get activity in period
    const participations = await prisma.caseParticipant.findMany({
      where: {
        userId: member.userId,
        optedInAt: { gte: startDate },
      }
    });

    let searchHours = 0;
    let areasSearched = 0;
    let sightings = 0;

    for (const p of participations) {
      searchHours += p.searchHours;
      areasSearched += p.areasMarked;
      sightings += p.sightingsReported;
    }

    // Calculate score
    const score = Math.round(
      searchHours * 10 +
      areasSearched * 5 +
      sightings * 25
    );

    leaderboard.push({
      userId: member.userId,
      name: `${member.user.firstName} ${member.user.lastName?.[0] || ''}`.trim(),
      rescueLevel: member.user.rescueLevel,
      score,
      searchHours: Math.round(searchHours * 10) / 10,
      areasSearched,
      sightings,
    });
  }

  // Sort by score
  leaderboard.sort((a, b) => b.score - a.score);

  // Add ranks
  return leaderboard.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

/**
 * Get squad leaderboard (divisions ranked)
 */
export async function getSquadLeaderboard(squadId, period = 'week') {
  const startDate = new Date();
  if (period === 'week') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === 'month') {
    startDate.setMonth(startDate.getMonth() - 1);
  }

  const divisions = await prisma.division.findMany({
    where: {
      rescueSquadId: squadId,
      isActive: true,
    },
    include: {
      members: {
        where: { isActive: true },
        select: { userId: true },
      }
    }
  });

  const leaderboard = [];

  for (const division of divisions) {
    const memberIds = division.members.map(m => m.userId);

    // Get combined activity
    const participations = await prisma.caseParticipant.findMany({
      where: {
        userId: { in: memberIds },
        optedInAt: { gte: startDate },
      }
    });

    let searchHours = 0;
    let areasSearched = 0;

    for (const p of participations) {
      searchHours += p.searchHours;
      areasSearched += p.areasMarked;
    }

    leaderboard.push({
      divisionId: division.id,
      divisionName: division.name,
      memberCount: division.members.length,
      searchHours: Math.round(searchHours * 10) / 10,
      areasSearched,
      score: Math.round(searchHours * 10 + areasSearched * 5),
    });
  }

  leaderboard.sort((a, b) => b.score - a.score);

  return leaderboard.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

/**
 * Award badge to user
 */
export async function awardBadge(userId, badgeId) {
  const existing = await prisma.userAchievement.findFirst({
    where: { userId, achievementType: badgeId },
  });

  if (existing) {
    return { success: false, error: 'Badge already earned' };
  }

  const achievement = await prisma.userAchievement.create({
    data: {
      userId,
      achievementType: badgeId,
      earnedAt: new Date(),
    }
  });

  return {
    success: true,
    achievement,
  };
}

/**
 * Check and award new badges
 */
export async function checkAndAwardBadges(userId) {
  const stats = await getVolunteerStats(userId);
  const badges = getBadgeDefinitions();
  const awarded = [];

  for (const badge of badges) {
    const progress = calculateBadgeProgress(badge, stats);

    if (progress >= 100) {
      const result = await awardBadge(userId, badge.id);
      if (result.success) {
        awarded.push(badge);
      }
    }
  }

  return awarded;
}

export default {
  getEngagementStats,
  getDivisionLeaderboard,
  getSquadLeaderboard,
  checkAndAwardBadges,
};
