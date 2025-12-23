/**
 * Search Session API Routes
 *
 * POST /api/mission/[missionId]/search - Start, ping, end, cancel, or log search
 * GET /api/mission/[missionId]/search - Get active session
 *
 * See docs/GPS_Search_Feature_Spec.md for full specification.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  POINTS_PER_MILE: 100,
  POINTS_PER_GRID_CELL: 5,
  POINTS_PER_15_MIN: 10,
  MAX_TIME_BONUS: 40,
  MAX_SPEED_MPH: 5, // Above this = driving
  SEARCH_RADIUS_MILES: 2,
  MIN_SESSION_MINUTES: 5,
  MIN_SESSION_MILES: 0.1,
  FIRST_24H_MULTIPLIER: 1.5,
  DAWN_DUSK_MULTIPLIER: 1.25,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate distance between two points in miles using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if a time is during dawn (6-8 AM) or dusk (5-7 PM)
 */
function isDawnOrDusk(date) {
  const hour = date.getHours();
  return (hour >= 6 && hour <= 8) || (hour >= 17 && hour <= 19);
}

/**
 * Calculate points with multipliers
 */
function calculatePoints(stats, caseCreatedAt) {
  // Base points
  const distancePoints = stats.validatedDistanceMiles * CONFIG.POINTS_PER_MILE;
  const gridPoints = stats.gridCellsCovered * CONFIG.POINTS_PER_GRID_CELL;
  const timePoints = Math.min(
    Math.floor(stats.durationMinutes / 15) * CONFIG.POINTS_PER_15_MIN,
    CONFIG.MAX_TIME_BONUS
  );

  let subtotal = distancePoints + gridPoints + timePoints;

  // Multipliers
  let multiplier = 1.0;
  const now = new Date();
  const hoursAfterLost = (now - new Date(caseCreatedAt)) / 3600000;

  if (hoursAfterLost < 24) {
    multiplier *= CONFIG.FIRST_24H_MULTIPLIER;
  }

  if (isDawnOrDusk(now)) {
    multiplier *= CONFIG.DAWN_DUSK_MULTIPLIER;
  }

  return {
    distance: Math.round(distancePoints),
    gridBonus: Math.round(gridPoints),
    timeBonus: Math.round(timePoints),
    multiplier,
    total: Math.round(subtotal * multiplier),
  };
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * POST /api/mission/[missionId]/search
 */
export async function POST(request, { params }) {
  const startTime = Date.now();
  const { missionId } = params;

  try {
    // Parse body in parallel with auth
    const [session, body] = await Promise.all([
      getServerSession(),
      request.json(),
    ]);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Search API] Auth: ${Date.now() - startTime}ms, action: ${body.action}`);

    // Get user and mission in parallel
    const [user, missionRecord] = await Promise.all([
      prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      }),
      prisma.case.findUnique({
        where: { id: missionId },
        select: {
          id: true,
          createdAt: true,
          lastSeenLatitude: true,
          lastSeenLongitude: true,
        },
      }),
    ]);

    console.log(`[Search API] DB lookups: ${Date.now() - startTime}ms`);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!missionRecord) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    switch (body.action) {
      case 'start':
        return handleSearchStart(user.id, missionId, body, missionRecord);

      case 'ping':
        return handleSearchPing(body, missionRecord);

      case 'end':
        return handleSearchEnd(user.id, missionId, body, missionRecord);

      case 'cancel':
        return handleSearchCancel(body);

      case 'log':
        return handleSearchLog(user.id, missionId, body);

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, ping, end, cancel, or log' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// ACTION HANDLERS
// =============================================================================

/**
 * Start a GPS-tracked search session
 */
async function handleSearchStart(userId, missionId, body, missionRecord) {
  const startTime = Date.now();
  const { latitude, longitude, lastSeenLat, lastSeenLng } = body;

  // Check for existing active session
  const existingSession = await prisma.searchSession.findFirst({
    where: {
      missionId,
      userId,
      status: { in: ['READY', 'ACTIVE'] },
    },
    select: { id: true },
  });

  console.log(`[Search Start] Check existing: ${Date.now() - startTime}ms`);

  if (existingSession) {
    return NextResponse.json(
      { error: 'Active session already exists', sessionId: existingSession.id },
      { status: 409 }
    );
  }

  // Calculate distance from last seen
  const lastSeenLatitude = lastSeenLat || missionRecord.lastSeenLatitude;
  const lastSeenLongitude = lastSeenLng || missionRecord.lastSeenLongitude;

  let distanceFromLastSeen = null;
  if (lastSeenLatitude && lastSeenLongitude) {
    distanceFromLastSeen = calculateDistance(
      latitude, longitude,
      lastSeenLatitude, lastSeenLongitude
    );
  }

  const createStart = Date.now();

  // Create search session with new fields
  const searchSession = await prisma.searchSession.create({
    data: {
      missionId,
      userId,
      status: 'ACTIVE',
      startedAt: new Date(),
      startLocation: JSON.stringify({ lat: latitude, lng: longitude }),
      currentLocation: JSON.stringify({
        lat: latitude,
        lng: longitude,
        accuracy: null,
        heading: null,
      }),
      lastLocationUpdate: new Date(),
      isVerified: true,
      // New fields for validation
      totalDistanceMiles: 0,
      validatedDistanceMiles: 0,
      gridCellsCovered: 1, // Start with current cell
      lastSeenLat: lastSeenLatitude,
      lastSeenLng: lastSeenLongitude,
    },
  });

  console.log(`[Search Start] Session created: ${Date.now() - createStart}ms`);

  // Create initial location ping (fire and forget to speed up response)
  prisma.locationPing.create({
    data: {
      session: { connect: { id: searchSession.id } },
      latitude,
      longitude,
      isValid: distanceFromLastSeen ? distanceFromLastSeen <= CONFIG.SEARCH_RADIUS_MILES : true,
    },
  }).catch(err => console.error('Failed to create initial ping:', err));

  console.log(`[Search Start] Total: ${Date.now() - startTime}ms`);

  return NextResponse.json({
    success: true,
    sessionId: searchSession.id,
    startedAt: searchSession.startedAt,
    distanceFromLastSeen: distanceFromLastSeen ? Math.round(distanceFromLastSeen * 100) / 100 : null,
    inSearchZone: distanceFromLastSeen ? distanceFromLastSeen <= CONFIG.SEARCH_RADIUS_MILES : true,
  });
}

/**
 * Update location during active search
 */
async function handleSearchPing(body, missionRecord) {
  const {
    sessionId,
    latitude,
    longitude,
    accuracy,
    heading,
    speed,
    isValid,
    invalidReason,
    gridCellId,
  } = body;

  // Verify session exists and is active
  const session = await prisma.searchSession.findUnique({
    where: { id: sessionId },
    include: {
      locationPings: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.status !== 'ACTIVE') {
    return NextResponse.json(
      { error: 'Session is not active', status: session.status },
      { status: 400 }
    );
  }

  // Calculate distance from previous ping
  let distanceFromPrev = 0;
  if (session.locationPings.length > 0) {
    const prevPing = session.locationPings[0];
    distanceFromPrev = calculateDistance(
      prevPing.latitude, prevPing.longitude,
      latitude, longitude
    );
  }

  // Check if within search zone
  let inSearchZone = true;
  if (session.lastSeenLat && session.lastSeenLng) {
    const distanceFromLastSeen = calculateDistance(
      latitude, longitude,
      session.lastSeenLat, session.lastSeenLng
    );
    inSearchZone = distanceFromLastSeen <= CONFIG.SEARCH_RADIUS_MILES;
  }

  // Validate speed (if speed provided in m/s, convert to mph)
  const speedMph = speed ? speed * 2.237 : null;
  const validSpeed = !speedMph || speedMph <= CONFIG.MAX_SPEED_MPH;

  // Determine if this ping counts
  const pingIsValid = isValid !== false && inSearchZone && validSpeed;

  // Update session with new totals
  const updateData = {
    currentLocation: JSON.stringify({ lat: latitude, lng: longitude, accuracy, heading }),
    lastLocationUpdate: new Date(),
    totalDistanceMiles: { increment: distanceFromPrev },
  };

  // Only add to validated distance if valid
  if (pingIsValid) {
    updateData.validatedDistanceMiles = { increment: distanceFromPrev };
  }

  // Update grid cells if new cell
  if (gridCellId && inSearchZone) {
    // Check if this is a new grid cell (simplified - in production use a Set stored in session)
    // For now, just increment if the ping is valid
    if (pingIsValid && distanceFromPrev > 0.01) { // Only if actually moved
      updateData.gridCellsCovered = { increment: 1 };
    }
  }

  await prisma.searchSession.update({
    where: { id: sessionId },
    data: updateData,
  });

  // Create location ping record
  await prisma.locationPing.create({
    data: {
      session: { connect: { id: sessionId } },
      latitude,
      longitude,
      accuracy,
      heading,
      speed: speedMph,
      isValid: pingIsValid,
      invalidReason: !pingIsValid ? (invalidReason || (!inSearchZone ? 'OUTSIDE_ZONE' : !validSpeed ? 'DRIVING' : null)) : null,
      gridCellId,
    },
  });

  return NextResponse.json({
    success: true,
    distanceAdded: pingIsValid ? distanceFromPrev : 0,
    inSearchZone,
    validSpeed,
    isValid: pingIsValid,
  });
}

/**
 * End search session and calculate points
 */
async function handleSearchEnd(userId, missionId, body, missionRecord) {
  const { sessionId } = body;
  const startTime = Date.now();

  // Get session WITHOUT loading all pings (stats are already on session)
  const session = await prisma.searchSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      startedAt: true,
      totalDistanceMiles: true,
      validatedDistanceMiles: true,
      gridCellsCovered: true,
    },
  });

  console.log(`[Search End] Session fetch: ${Date.now() - startTime}ms`);

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.status === 'COMPLETED') {
    return NextResponse.json(
      { error: 'Session already completed' },
      { status: 400 }
    );
  }

  // Calculate final stats
  const durationMinutes = (Date.now() - new Date(session.startedAt).getTime()) / 60000;

  const stats = {
    durationMinutes: Math.round(durationMinutes),
    totalDistanceMiles: session.totalDistanceMiles || 0,
    validatedDistanceMiles: session.validatedDistanceMiles || 0,
    gridCellsCovered: session.gridCellsCovered || 0,
  };

  // Check minimum requirements
  const meetsMinimum = durationMinutes >= CONFIG.MIN_SESSION_MINUTES &&
    stats.validatedDistanceMiles >= CONFIG.MIN_SESSION_MILES;

  // Calculate points
  const points = meetsMinimum
    ? calculatePoints(stats, missionRecord.createdAt)
    : { distance: 0, gridBonus: 0, timeBonus: 0, multiplier: 1, total: 0 };

  const updateStart = Date.now();

  // Update session
  await prisma.searchSession.update({
    where: { id: sessionId },
    data: {
      status: 'COMPLETED',
      endedAt: new Date(),
      distanceMiles: stats.validatedDistanceMiles,
      pointsEarned: points.total,
    },
  });

  console.log(`[Search End] Session update: ${Date.now() - updateStart}ms`);

  // Create verified action record if points earned (don't await - fire and forget)
  if (points.total > 0) {
    prisma.verifiedAction.create({
      data: {
        missionId,
        userId,
        actionType: 'search_area',
        verificationMethod: 'GPS',
        basePoints: points.distance + points.gridBonus + points.timeBonus,
        bonusPoints: Math.round((points.total - (points.distance + points.gridBonus + points.timeBonus))),
        totalPoints: points.total,
        multipliers: points.multiplier > 1 ? JSON.stringify([{ type: 'time_bonus', value: points.multiplier }]) : null,
        metadata: JSON.stringify({
          searchSessionId: sessionId,
          distanceMiles: stats.validatedDistanceMiles,
          gridCellsCovered: stats.gridCellsCovered,
          durationMinutes: stats.durationMinutes,
          multiplier: points.multiplier,
        }),
      },
    }).catch(err => console.log('VerifiedAction not created:', err.message));
  }

  console.log(`[Search End] Total: ${Date.now() - startTime}ms`);

  return NextResponse.json({
    success: true,
    sessionId,
    meetsMinimum,
    stats: {
      durationMinutes: stats.durationMinutes,
      totalDistanceMiles: Math.round(stats.totalDistanceMiles * 100) / 100,
      validatedDistanceMiles: Math.round(stats.validatedDistanceMiles * 100) / 100,
      gridCellsCovered: stats.gridCellsCovered,
    },
    points,
    isVerified: true,
  });
}

/**
 * Cancel a search session (no points awarded)
 */
async function handleSearchCancel(body) {
  const { sessionId } = body;

  const session = await prisma.searchSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  await prisma.searchSession.update({
    where: { id: sessionId },
    data: {
      status: 'CANCELLED',
      endedAt: new Date(),
      pointsEarned: 0,
    },
  });

  return NextResponse.json({ success: true, cancelled: true });
}

/**
 * Log a manual search (self-reported, no GPS)
 */
async function handleSearchLog(userId, missionId, body) {
  const { note, location, durationMinutes } = body;

  // Award 5 points for manual log (self-reported, capped)
  const pointsEarned = 5;

  // Create a completed session record for manual log
  await prisma.searchSession.create({
    data: {
      missionId,
      userId,
      status: 'COMPLETED',
      startedAt: new Date(),
      endedAt: new Date(),
      isVerified: false,
      pointsEarned,
      notes: note,
      startLocation: location ? JSON.stringify(location) : null,
    },
  });

  return NextResponse.json({
    success: true,
    pointsEarned,
    isVerified: false,
    note: note || null,
  });
}

// =============================================================================
// GET HANDLER
// =============================================================================

/**
 * GET /api/mission/[missionId]/search
 *
 * Get active search session for current user
 */
export async function GET(request, { params }) {
  const startTime = Date.now();
  const { missionId } = params;

  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get active session WITHOUT loading all pings (they're tracked client-side)
    const activeSession = await prisma.searchSession.findFirst({
      where: {
        missionId,
        userId: user.id,
        status: { in: ['READY', 'ACTIVE'] },
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
        totalDistanceMiles: true,
        validatedDistanceMiles: true,
        gridCellsCovered: true,
      },
    });

    console.log(`[Search GET] Total: ${Date.now() - startTime}ms`);

    if (!activeSession) {
      return NextResponse.json({ activeSession: null });
    }

    return NextResponse.json({
      activeSession: {
        id: activeSession.id,
        status: activeSession.status,
        startedAt: activeSession.startedAt,
        totalDistanceMiles: activeSession.totalDistanceMiles || 0,
        validatedDistanceMiles: activeSession.validatedDistanceMiles || 0,
        gridCellsCovered: activeSession.gridCellsCovered || 0,
        path: [], // Path is tracked client-side now
      },
    });
  } catch (error) {
    console.error('Search GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
