/**
 * Phase 22: Gamification 2.0
 * Seasonal challenges, team competitions, achievements with rewards
 */

// Achievement definitions
export const ACHIEVEMENTS = {
  // Search achievements
  FIRST_SEARCH: {
    id: 'first_search',
    name: 'First Steps',
    description: 'Complete your first search session',
    icon: '🔍',
    points: 50,
    tier: 'bronze',
  },
  SEARCH_MASTER: {
    id: 'search_master',
    name: 'Search Master',
    description: 'Complete 100 search sessions',
    icon: '🎯',
    points: 500,
    tier: 'gold',
  },
  NIGHT_OWL: {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Complete 10 searches after 10 PM',
    icon: '🦉',
    points: 200,
    tier: 'silver',
  },
  EARLY_BIRD: {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Complete 10 searches before 7 AM',
    icon: '🐦',
    points: 200,
    tier: 'silver',
  },

  // Reunion achievements
  FIRST_REUNION: {
    id: 'first_reunion',
    name: 'Miracle Worker',
    description: 'Help reunite your first pet with their family',
    icon: '💖',
    points: 1000,
    tier: 'gold',
  },
  REUNION_HERO: {
    id: 'reunion_hero',
    name: 'Reunion Hero',
    description: 'Help with 10 successful reunions',
    icon: '🏆',
    points: 5000,
    tier: 'platinum',
  },

  // Community achievements
  SQUAD_FOUNDER: {
    id: 'squad_founder',
    name: 'Squad Founder',
    description: 'Create a rescue squad',
    icon: '👑',
    points: 300,
    tier: 'silver',
  },
  TEAM_PLAYER: {
    id: 'team_player',
    name: 'Team Player',
    description: 'Participate in 50 squad activities',
    icon: '🤝',
    points: 400,
    tier: 'silver',
  },
  MENTOR: {
    id: 'mentor',
    name: 'Mentor',
    description: 'Help train 5 new volunteers',
    icon: '📚',
    points: 600,
    tier: 'gold',
  },

  // Special achievements
  SPEED_DEMON: {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Help find a pet within 24 hours of report',
    icon: '⚡',
    points: 750,
    tier: 'gold',
  },
  MARATHON_SEARCHER: {
    id: 'marathon_searcher',
    name: 'Marathon Searcher',
    description: 'Search for 8+ hours in a single day',
    icon: '🏃',
    points: 400,
    tier: 'silver',
  },
  MULTI_SPECIES: {
    id: 'multi_species',
    name: 'Animal Whisperer',
    description: 'Help find dogs, cats, and other animals',
    icon: '🐾',
    points: 500,
    tier: 'gold',
  },
};

// Seasonal challenge templates
export const SEASONAL_CHALLENGES = {
  SPRING_SEARCH: {
    id: 'spring_search_2024',
    name: 'Spring Search Sprint',
    description: 'Help reunite as many pets as possible this spring!',
    startDate: '2024-03-20',
    endDate: '2024-06-20',
    goals: [
      { type: 'searches', target: 10, reward: 100 },
      { type: 'sightings', target: 5, reward: 150 },
      { type: 'reunions', target: 1, reward: 500 },
    ],
    grandPrize: {
      description: 'Top 10 searchers get exclusive Spring Hero badge',
      type: 'badge',
      value: 'spring_hero_2024',
    },
  },
  SUMMER_RESCUE: {
    id: 'summer_rescue_2024',
    name: 'Summer Rescue Rally',
    description: 'Summer is prime time for lost pets - join the rally!',
    startDate: '2024-06-21',
    endDate: '2024-09-22',
    goals: [
      { type: 'searches', target: 20, reward: 200 },
      { type: 'squad_activities', target: 10, reward: 250 },
      { type: 'reunions', target: 2, reward: 1000 },
    ],
    grandPrize: {
      description: '$100 donation to local shelter in your name',
      type: 'donation',
      value: 10000, // cents
    },
  },
};

/**
 * Check if user earned an achievement
 */
export function checkAchievements(userStats, existingAchievements = []) {
  const newAchievements = [];
  const earnedIds = new Set(existingAchievements.map(a => a.id));

  // Check each achievement
  if (!earnedIds.has('first_search') && userStats.searchCount >= 1) {
    newAchievements.push(ACHIEVEMENTS.FIRST_SEARCH);
  }

  if (!earnedIds.has('search_master') && userStats.searchCount >= 100) {
    newAchievements.push(ACHIEVEMENTS.SEARCH_MASTER);
  }

  if (!earnedIds.has('first_reunion') && userStats.reunionCount >= 1) {
    newAchievements.push(ACHIEVEMENTS.FIRST_REUNION);
  }

  if (!earnedIds.has('reunion_hero') && userStats.reunionCount >= 10) {
    newAchievements.push(ACHIEVEMENTS.REUNION_HERO);
  }

  if (!earnedIds.has('night_owl') && userStats.nightSearchCount >= 10) {
    newAchievements.push(ACHIEVEMENTS.NIGHT_OWL);
  }

  if (!earnedIds.has('early_bird') && userStats.earlySearchCount >= 10) {
    newAchievements.push(ACHIEVEMENTS.EARLY_BIRD);
  }

  if (!earnedIds.has('squad_founder') && userStats.squadsCreated >= 1) {
    newAchievements.push(ACHIEVEMENTS.SQUAD_FOUNDER);
  }

  if (!earnedIds.has('team_player') && userStats.squadActivities >= 50) {
    newAchievements.push(ACHIEVEMENTS.TEAM_PLAYER);
  }

  return newAchievements;
}

/**
 * Calculate user's level from points
 */
export function calculateLevel(totalPoints) {
  const levels = [
    { level: 1, name: 'Newcomer', minPoints: 0 },
    { level: 2, name: 'Helper', minPoints: 100 },
    { level: 3, name: 'Scout', minPoints: 300 },
    { level: 4, name: 'Tracker', minPoints: 600 },
    { level: 5, name: 'Searcher', minPoints: 1000 },
    { level: 6, name: 'Finder', minPoints: 1500 },
    { level: 7, name: 'Expert', minPoints: 2500 },
    { level: 8, name: 'Master', minPoints: 4000 },
    { level: 9, name: 'Champion', minPoints: 6000 },
    { level: 10, name: 'Legend', minPoints: 10000 },
  ];

  let currentLevel = levels[0];
  let nextLevel = levels[1];

  for (let i = levels.length - 1; i >= 0; i--) {
    if (totalPoints >= levels[i].minPoints) {
      currentLevel = levels[i];
      nextLevel = levels[i + 1] || null;
      break;
    }
  }

  const progress = nextLevel
    ? ((totalPoints - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints)) * 100
    : 100;

  return {
    ...currentLevel,
    totalPoints,
    nextLevel,
    progress: Math.min(100, Math.round(progress)),
    pointsToNextLevel: nextLevel ? nextLevel.minPoints - totalPoints : 0,
  };
}

/**
 * Get leaderboard for a time period
 */
export async function getLeaderboard(prisma, options = {}) {
  const { period = 'weekly', limit = 50, squadId = null } = options;

  // Calculate date range
  const now = new Date();
  let startDate;

  switch (period) {
    case 'daily':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'weekly':
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'allTime':
      startDate = new Date(0);
      break;
    default:
      startDate = new Date(now.setDate(now.getDate() - 7));
  }

  // Query for top users by points
  const users = await prisma.user.findMany({
    where: squadId ? {
      rescueSquadMemberships: {
        some: { rescueSquadId: squadId },
      },
    } : undefined,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profileImage: true,
      rescueLevel: true,
      successfulReunions: true,
      areasMarkedCount: true,
      squadsJoinedCount: true,
    },
    orderBy: { successfulReunions: 'desc' },
    take: limit,
  });

  // Calculate points and ranking
  return users.map((user, index) => ({
    rank: index + 1,
    userId: user.id,
    name: `${user.firstName} ${user.lastName || ''}`.trim(),
    profileImage: user.profileImage,
    level: user.rescueLevel,
    points: calculateUserPoints(user),
    stats: {
      reunions: user.successfulReunions,
      areasSearched: user.areasMarkedCount,
      squadsJoined: user.squadsJoinedCount,
    },
  }));
}

/**
 * Calculate user points from stats
 */
function calculateUserPoints(user) {
  return (
    (user.successfulReunions || 0) * 1000 +
    (user.areasMarkedCount || 0) * 10 +
    (user.squadsJoinedCount || 0) * 50
  );
}

/**
 * Get squad competition standings
 */
export async function getSquadCompetition(prisma, competitionId) {
  const competition = await prisma.squadCompetition.findUnique({
    where: { id: competitionId },
    include: {
      entries: {
        include: {
          squad: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              successfulReunions: true,
              totalCasesCompleted: true,
            },
          },
        },
        orderBy: { score: 'desc' },
      },
    },
  });

  if (!competition) return null;

  return {
    ...competition,
    standings: competition.entries.map((entry, index) => ({
      rank: index + 1,
      squadId: entry.squad.id,
      squadName: entry.squad.name,
      logoUrl: entry.squad.logoUrl,
      score: entry.score,
      metrics: entry.metrics ? JSON.parse(entry.metrics) : {},
    })),
  };
}

/**
 * Award points to user
 */
export async function awardPoints(prisma, userId, points, reason) {
  // Update user points
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      // Points would be tracked in a separate table in production
    },
  });

  // Log the award
  await prisma.pointsLog.create({
    data: {
      userId,
      points,
      reason,
      awardedAt: new Date(),
    },
  });

  // Check for new achievements
  const userStats = await getUserStats(prisma, userId);
  const existingAchievements = await prisma.userAchievement.findMany({
    where: { userId },
  });

  const newAchievements = checkAchievements(userStats, existingAchievements);

  // Award new achievements
  for (const achievement of newAchievements) {
    await prisma.userAchievement.create({
      data: {
        userId,
        achievementId: achievement.id,
        earnedAt: new Date(),
      },
    });
  }

  return { pointsAwarded: points, newAchievements };
}

async function getUserStats(prisma, userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          searchAreas: true,
          rescueSquadMemberships: true,
        },
      },
    },
  });

  return {
    searchCount: user._count.searchAreas,
    reunionCount: user.successfulReunions,
    squadActivities: user._count.rescueSquadMemberships,
    squadsCreated: 0, // Would query separately
    nightSearchCount: 0, // Would need time-based query
    earlySearchCount: 0,
  };
}

export default {
  ACHIEVEMENTS,
  SEASONAL_CHALLENGES,
  checkAchievements,
  calculateLevel,
  getLeaderboard,
  getSquadCompetition,
  awardPoints,
};
