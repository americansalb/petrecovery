/**
 * Public Reunions API
 * GET /api/public/reunions
 *
 * Returns recent pet reunions for the homepage ticker and success stories.
 * No authentication required.
 */

import { looksLikeCoordinates } from '@/app/lib/maps/reverseLabel';
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Cache reunions for 5 minutes (in memory)
let reunionsCache = null;
let reunionsCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request) {
  // Apply rate limiting for public reads
  const rateLimitResult = withRateLimit(request, RateLimitPresets.PUBLIC_READ, 'public:reunions');
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    // Check cache
    const now = Date.now();
    if (reunionsCache && (now - reunionsCacheTime) < CACHE_TTL) {
      const cachedData = reunionsCache.slice(0, limit);
      return NextResponse.json({
        reunions: cachedData,
        total: reunionsCache.length,
        cached: true,
        cache_age_seconds: Math.round((now - reunionsCacheTime) / 1000)
      });
    }

    // Fetch recent reunions from CaseOutcome joined with Case
    const recentReunions = await prisma.caseOutcome.findMany({
      where: {
        outcome: 'REUNITED'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50, // Cache more than we return for flexibility
      include: {
        case: {
          select: {
            petName: true,
            petSpecies: true,
            petBreed: true,
            petColor: true,
            petPhotoUrl: true,
            lastSeenAddress: true,
            createdAt: true,
          }
        }
      }
    });

    // Transform data for public consumption
    const transformedReunions = recentReunions.map((reunion) => {
      // Extract city from address
      let city = 'Unknown';
      let state = '';
      if (reunion.case?.lastSeenAddress && !looksLikeCoordinates(reunion.case.lastSeenAddress)) {
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
        petColor: reunion.case?.petColor || '',
        city,
        state,
        foundMethod: reunion.foundMethod,
        timeToReunionHours: reunion.timeToReunionHours,
        reunionDate: reunion.createdAt,
        // Don't expose photo URLs in ticker for privacy - only show name/breed/location
      };
    });

    // Update cache
    reunionsCache = transformedReunions;
    reunionsCacheTime = now;

    return NextResponse.json({
      reunions: transformedReunions.slice(0, limit),
      total: transformedReunions.length,
      cached: false
    });

  } catch (error) {
    console.error('Error fetching public reunions:', error);

    return NextResponse.json({
      reunions: [],
      total: 0,
      error: true,
      message: 'Unable to fetch reunions'
    });
  }
}
