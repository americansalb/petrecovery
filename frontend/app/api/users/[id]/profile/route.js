import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/users/[id]/profile
 * Get public user profile
 */
export async function GET(request, { params }) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        rescueLevel: true,
        createdAt: true,

        // Stats
        squadsJoinedCount: true,
        areasMarkedCount: true,
        totalAcreageSearched: true,
        successfulReunions: true,
        honorsReceived: true,

        // Activity counts
        _count: {
          select: {
            cases: true,
            caseSightings: true,
            rescueSquadMemberships: true,
            receivedHonors: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get recent activity
    const [recentMissions, recentSightings, badges] = await Promise.all([
      prisma.case.findMany({
        where: { reporterId: params.id, status: 'REUNITED' },
        take: 5,
        orderBy: { resolvedAt: 'desc' },
        select: {
          id: true,
          missionNumber: true,
          petName: true,
          petSpecies: true,
          resolvedAt: true,
        },
      }),
      prisma.caseSighting.findMany({
        where: { reportedById: params.id, isVerified: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          case: {
            select: { petName: true, missionNumber: true },
          },
        },
      }),
      getUserBadges(params.id, user),
    ]);

    return NextResponse.json({
      profile: {
        id: user.id,
        name: `${user.firstName} ${user.lastName?.[0] || ''}.`,
        avatar: user.profileImage,
        level: user.rescueLevel,
        memberSince: user.createdAt,
        stats: {
          squadsJoined: user.squadsJoinedCount,
          areasSearched: user.areasMarkedCount,
          acreageCovered: Math.round(user.totalAcreageSearched * 10) / 10,
          reunions: user.successfulReunions,
          honors: user.honorsReceived,
          casesReported: user._count.cases,
          sightingsReported: user._count.caseSightings,
        },
        badges,
        recentReunions: recentMissions,
        recentSightings,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json({ error: 'Failed to get profile' }, { status: 500 });
  }
}

/**
 * Calculate user badges based on activity
 */
function getUserBadges(userId, user) {
  const badges = [];

  // Reunion badges
  if (user.successfulReunions >= 1) badges.push({ id: 'first_reunion', name: 'First Reunion', icon: '🏆' });
  if (user.successfulReunions >= 5) badges.push({ id: 'helper', name: 'Helpful Hero', icon: '⭐' });
  if (user.successfulReunions >= 25) badges.push({ id: 'champion', name: 'Reunion Champion', icon: '🎖️' });
  if (user.successfulReunions >= 100) badges.push({ id: 'legend', name: 'Legend', icon: '👑' });

  // Search badges
  if (user.areasMarkedCount >= 10) badges.push({ id: 'searcher', name: 'Active Searcher', icon: '🔍' });
  if (user.totalAcreageSearched >= 100) badges.push({ id: 'explorer', name: 'Explorer', icon: '🗺️' });

  // Squad badges
  if (user.squadsJoinedCount >= 3) badges.push({ id: 'team_player', name: 'Team Player', icon: '🤝' });

  // Honor badges
  if (user.honorsReceived >= 5) badges.push({ id: 'respected', name: 'Respected', icon: '🙏' });

  // Level badges
  const levelBadges = {
    SCOUT: { id: 'scout', name: 'Scout', icon: '🔰' },
    SENTRY: { id: 'sentry', name: 'Sentry', icon: '👁️' },
    SHEPHERD: { id: 'shepherd', name: 'Shepherd', icon: '🐕' },
    PATHFINDER: { id: 'pathfinder', name: 'Pathfinder', icon: '🧭' },
    PACK_GUARDIAN: { id: 'guardian', name: 'Pack Guardian', icon: '🛡️' },
    PACK_LEGEND: { id: 'pack_legend', name: 'Pack Legend', icon: '🌟' },
  };

  if (levelBadges[user.rescueLevel]) {
    badges.push(levelBadges[user.rescueLevel]);
  }

  return badges;
}
