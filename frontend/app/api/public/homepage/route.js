/**
 * Public Homepage API
 * GET /api/public/homepage
 *
 * Returns all data needed for the homepage in a single efficient request:
 * - Platform metrics (pets reunited, users, squads, etc.)
 * - Recent reunions for ticker
 * - Active cases needing help
 * - Recent activity feed
 *
 * No authentication required.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { normalizePhotoUrl } from '@/app/lib/utils';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Cache homepage data for 3 minutes
let homepageCache = null;
let homepageCacheTime = 0;
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

export async function GET(request) {
  const startTime = Date.now();

  // Apply rate limiting for public reads
  const rateLimitResult = withRateLimit(request, RateLimitPresets.PUBLIC_READ, 'public:homepage');
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    // Check cache
    const now = Date.now();
    if (homepageCache && (now - homepageCacheTime) < CACHE_TTL) {
      return NextResponse.json({
        ...homepageCache,
        cached: true,
        cache_age_seconds: Math.round((now - homepageCacheTime) / 1000)
      });
    }

    // Fetch all data in parallel for optimal performance
    const [
      // Core metrics
      reunitedCount,
      totalUsers,
      activeSquads,
      totalVolunteers,
      openCases,
      citiesWithSquads,
      // Average reunion time
      avgReunionTime,
      // Recent reunions for ticker
      recentReunions,
      // Active cases for preview
      activeCases,
      // Recent sightings count (last 24h)
      recentSightingsCount,
      // This week's reunions
      weeklyReunions,
      // Featured squads
      featuredSquads,
    ] = await Promise.all([
      // Pets reunited total
      prisma.case.count({ where: { status: 'REUNITED' } }),

      // Total users
      prisma.user.count(),

      // Active rescue forces
      prisma.rescueSquad.count({ where: { isActive: true } }),

      // Total active squad members
      prisma.rescueSquadMember.count({ where: { isActive: true } }),

      // Open/active cases
      prisma.case.count({
        where: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } }
      }),

      // Unique cities with squads
      prisma.rescueSquad.groupBy({
        by: ['city', 'state'],
        where: { isActive: true },
        _count: true
      }),

      // Average time to reunion
      prisma.caseOutcome.aggregate({
        where: { outcome: 'REUNITED' },
        _avg: { timeToReunionHours: true }
      }),

      // Recent reunions for ticker (last 10)
      prisma.caseOutcome.findMany({
        where: { outcome: 'REUNITED' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          case: {
            select: {
              petName: true,
              petSpecies: true,
              petBreed: true,
              lastSeenAddress: true,
            }
          }
        }
      }),

      // Active cases with photos (for "pets needing help" section)
      prisma.case.findMany({
        where: {
          status: { in: ['ACTIVE', 'IN_PROGRESS'] },
          reportType: 'LOST'
        },
        orderBy: [
          { priority: 'asc' }, // URGENT first
          { createdAt: 'desc' }
        ],
        take: 6,
        select: {
          id: true,
          caseNumber: true,
          petName: true,
          petSpecies: true,
          petBreed: true,
          petPhotoUrl: true,
          lastSeenAddress: true,
          lastSeenAt: true,
          priority: true,
          createdAt: true,
        }
      }),

      // Recent sightings in last 24h
      prisma.caseSighting.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      }),

      // This week's reunions
      prisma.caseOutcome.count({
        where: {
          outcome: 'REUNITED',
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      }),

      // Featured/active squads with member counts
      prisma.rescueSquad.findMany({
        where: { isActive: true },
        orderBy: [
          { members: { _count: 'desc' } },
        ],
        take: 6,
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          logoUrl: true,
          photoUrl: true,
          _count: {
            select: { members: true }
          }
        }
      }),
    ]);

    // Transform reunions for ticker
    const tickerReunions = recentReunions.map((reunion) => {
      let city = 'Unknown';
      let state = '';
      if (reunion.case?.lastSeenAddress) {
        const parts = reunion.case.lastSeenAddress.split(',');
        if (parts.length >= 2) {
          city = parts[parts.length - 2]?.trim() || 'Unknown';
          const stateZip = parts[parts.length - 1]?.trim() || '';
          state = stateZip.split(' ')[0] || '';
        }
      }

      return {
        id: reunion.id,
        petName: reunion.case?.petName || 'Unknown',
        petSpecies: reunion.case?.petSpecies || 'DOG',
        petBreed: reunion.case?.petBreed || '',
        city,
        state,
        timeToReunionHours: reunion.timeToReunionHours,
        foundMethod: reunion.foundMethod,
        reunionDate: reunion.createdAt,
      };
    });

    // Transform active cases for display
    const casesNeedingHelp = activeCases.map((caseItem) => {
      let city = 'Unknown';
      let state = '';
      if (caseItem.lastSeenAddress) {
        const parts = caseItem.lastSeenAddress.split(',');
        if (parts.length >= 2) {
          city = parts[parts.length - 2]?.trim() || 'Unknown';
          const stateZip = parts[parts.length - 1]?.trim() || '';
          state = stateZip.split(' ')[0] || '';
        }
      }

      // Calculate hours since lost
      const hoursLost = Math.round(
        (Date.now() - new Date(caseItem.lastSeenAt).getTime()) / (1000 * 60 * 60)
      );

      return {
        id: caseItem.id,
        caseNumber: caseItem.caseNumber,
        petName: caseItem.petName,
        petSpecies: caseItem.petSpecies,
        petBreed: caseItem.petBreed,
        petPhotoUrl: normalizePhotoUrl(caseItem.petPhotoUrl),
        city,
        state,
        hoursLost,
        isUrgent: caseItem.priority === 'URGENT',
      };
    });

    // Calculate reunion rate
    const totalCases = reunitedCount + openCases;
    const reunionRate = totalCases > 0 ? Math.round((reunitedCount / totalCases) * 100) : 0;

    // Format avg reunion time
    const avgHours = avgReunionTime._avg?.timeToReunionHours || 0;

    // Transform featured squads
    const squadsForDisplay = featuredSquads.map((squad) => ({
      id: squad.id,
      name: squad.name,
      city: squad.city,
      state: squad.state,
      logoUrl: squad.logoUrl ? normalizePhotoUrl(squad.logoUrl) : null,
      photoUrl: squad.photoUrl ? normalizePhotoUrl(squad.photoUrl) : null,
      memberCount: squad._count.members,
    }));

    // Build response
    const homepageData = {
      metrics: {
        petsReunited: reunitedCount,
        totalUsers: totalUsers,
        activeSquads: activeSquads,
        totalVolunteers: totalVolunteers,
        openCases: openCases,
        citiesCovered: citiesWithSquads.length,
        avgReunionTimeHours: Math.round(avgHours),
        reunionRate: reunionRate,
        recentSightings24h: recentSightingsCount,
        weeklyReunions: weeklyReunions,
      },
      ticker: tickerReunions,
      casesNeedingHelp: casesNeedingHelp,
      featuredSquads: squadsForDisplay,
      timestamp: new Date().toISOString(),
    };

    // Update cache
    homepageCache = homepageData;
    homepageCacheTime = now;

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      ...homepageData,
      cached: false,
      response_time_ms: responseTime
    });

  } catch (error) {
    console.error('Error fetching homepage data:', error);

    // Return fallback data on error
    return NextResponse.json({
      metrics: {
        petsReunited: 0,
        totalUsers: 0,
        activeSquads: 0,
        totalVolunteers: 0,
        openCases: 0,
        citiesCovered: 0,
        avgReunionTimeHours: 0,
        reunionRate: 0,
        recentSightings24h: 0,
        weeklyReunions: 0,
      },
      ticker: [],
      casesNeedingHelp: [],
      featuredSquads: [],
      timestamp: new Date().toISOString(),
      error: true,
      message: 'Unable to fetch homepage data'
    });
  }
}
