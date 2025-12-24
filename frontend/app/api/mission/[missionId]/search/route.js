/**
 * GPS Search Session API - SIMPLIFIED
 *
 * POST /api/mission/[missionId]/search
 *   - action: 'start' | 'ping' | 'end'
 *
 * GET /api/mission/[missionId]/search
 *   - Returns active session or null
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
  MAX_SPEED_MPH: 5,
  SEARCH_RADIUS_MILES: 2,
  MIN_SESSION_MINUTES: 5,
  MIN_SESSION_MILES: 0.1,
  FIRST_24H_MULTIPLIER: 1.5,
  DAWN_DUSK_MULTIPLIER: 1.25,
  // Auto-cleanup any session older than 30 minutes
  MAX_SESSION_AGE_MINUTES: 30,
};

// =============================================================================
// HELPERS
// =============================================================================

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isDawnOrDusk(date) {
  const hour = date.getHours();
  return (hour >= 6 && hour <= 8) || (hour >= 17 && hour <= 19);
}

function calculatePoints(stats, caseCreatedAt) {
  const distancePoints = stats.validatedDistanceMiles * CONFIG.POINTS_PER_MILE;
  const gridPoints = stats.gridCellsCovered * CONFIG.POINTS_PER_GRID_CELL;
  const timePoints = Math.min(
    Math.floor(stats.durationMinutes / 15) * CONFIG.POINTS_PER_15_MIN,
    CONFIG.MAX_TIME_BONUS
  );

  let subtotal = distancePoints + gridPoints + timePoints;
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

/**
 * Auto-cleanup old sessions for a user/mission
 * Returns number of sessions cleaned
 */
async function cleanupOldSessions(userId, missionId) {
  const cutoffTime = new Date(Date.now() - CONFIG.MAX_SESSION_AGE_MINUTES * 60 * 1000);

  const result = await prisma.searchSession.updateMany({
    where: {
      userId,
      missionId,
      status: { in: ['READY', 'ACTIVE'] },
      startedAt: { lt: cutoffTime },
    },
    data: {
      status: 'COMPLETED',
      endedAt: new Date(),
      endReason: 'AUTO_CLEANUP',
    },
  });

  if (result.count > 0) {
    console.log(`[Search] Auto-cleaned ${result.count} stale sessions for user ${userId}`);
  }

  return result.count;
}

/**
 * Force-end ALL active sessions for a user/mission
 */
async function forceEndAllSessions(userId, missionId) {
  const result = await prisma.searchSession.updateMany({
    where: {
      userId,
      missionId,
      status: { in: ['READY', 'ACTIVE'] },
    },
    data: {
      status: 'COMPLETED',
      endedAt: new Date(),
      endReason: 'FORCE_ENDED',
    },
  });

  if (result.count > 0) {
    console.log(`[Search] Force-ended ${result.count} sessions for user ${userId}`);
  }

  return result.count;
}

// =============================================================================
// POST HANDLER
// =============================================================================

export async function POST(request, { params }) {
  const { missionId } = params;

  try {
    const [session, body] = await Promise.all([
      getServerSession(),
      request.json(),
    ]);

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

    // Always cleanup old sessions first
    await cleanupOldSessions(user.id, missionId);

    const { action } = body;

    switch (action) {
      case 'start':
        return handleStart(user.id, missionId, body);
      case 'ping':
        return handlePing(body);
      case 'end':
        return handleEnd(user.id, missionId, body);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Search API] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// =============================================================================
// ACTION HANDLERS
// =============================================================================

async function handleStart(userId, missionId, body) {
  const { latitude, longitude } = body;

  // FORCE end any existing sessions first - no conflicts, no complexity
  await forceEndAllSessions(userId, missionId);

  // Get mission for reference
  const mission = await prisma.case.findUnique({
    where: { id: missionId },
    select: { lastSeenLatitude: true, lastSeenLongitude: true },
  });

  // Create new session
  const searchSession = await prisma.searchSession.create({
    data: {
      missionId,
      userId,
      status: 'ACTIVE',
      startedAt: new Date(),
      startLocation: JSON.stringify({ lat: latitude, lng: longitude }),
      currentLocation: JSON.stringify({ lat: latitude, lng: longitude }),
      lastLocationUpdate: new Date(),
      isVerified: true,
      totalDistanceMiles: 0,
      validatedDistanceMiles: 0,
      gridCellsCovered: 1,
      lastSeenLat: mission?.lastSeenLatitude,
      lastSeenLng: mission?.lastSeenLongitude,
    },
  });

  console.log(`[Search] Started session ${searchSession.id} for user ${userId}`);

  return NextResponse.json({
    success: true,
    sessionId: searchSession.id,
    startedAt: searchSession.startedAt,
  });
}

async function handlePing(body) {
  const { sessionId, latitude, longitude, accuracy, heading, speed, isValid } = body;

  if (!sessionId) {
    return NextResponse.json({ error: 'No session ID' }, { status: 400 });
  }

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
    return NextResponse.json({ error: 'Session not active', status: session.status }, { status: 400 });
  }

  // Calculate distance from previous ping
  let distanceFromPrev = 0;
  if (session.locationPings.length > 0) {
    const prev = session.locationPings[0];
    distanceFromPrev = calculateDistance(
      prev.latitude, prev.longitude,
      latitude, longitude
    );
  }

  // Check if in search zone
  let inSearchZone = true;
  if (session.lastSeenLat && session.lastSeenLng) {
    const distFromLastSeen = calculateDistance(
      latitude, longitude,
      session.lastSeenLat, session.lastSeenLng
    );
    inSearchZone = distFromLastSeen <= CONFIG.SEARCH_RADIUS_MILES;
  }

  // Validate speed
  const speedMph = speed ? speed * 2.237 : null;
  const validSpeed = !speedMph || speedMph <= CONFIG.MAX_SPEED_MPH;
  const pingIsValid = isValid !== false && inSearchZone && validSpeed;

  // Update session
  const updateData = {
    currentLocation: JSON.stringify({ lat: latitude, lng: longitude }),
    lastLocationUpdate: new Date(),
    totalDistanceMiles: { increment: distanceFromPrev },
  };

  if (pingIsValid) {
    updateData.validatedDistanceMiles = { increment: distanceFromPrev };
  }

  if (pingIsValid && distanceFromPrev > 0.01) {
    updateData.gridCellsCovered = { increment: 1 };
  }

  await prisma.searchSession.update({
    where: { id: sessionId },
    data: updateData,
  });

  // Store ping
  await prisma.locationPing.create({
    data: {
      session: { connect: { id: sessionId } },
      latitude,
      longitude,
      accuracy,
      heading,
      speed: speedMph,
      isValid: pingIsValid,
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

async function handleEnd(userId, missionId, body) {
  const { sessionId, reason } = body;

  // If no sessionId provided, end ALL active sessions for this user/mission
  if (!sessionId) {
    const ended = await forceEndAllSessions(userId, missionId);
    return NextResponse.json({ success: true, endedCount: ended });
  }

  const session = await prisma.searchSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      startedAt: true,
      totalDistanceMiles: true,
      validatedDistanceMiles: true,
      gridCellsCovered: true,
      mission: { select: { createdAt: true } },
    },
  });

  if (!session) {
    // Session not found - that's fine, just return success
    return NextResponse.json({ success: true, message: 'Session already ended' });
  }

  if (session.status === 'COMPLETED') {
    return NextResponse.json({ success: true, message: 'Session already ended' });
  }

  // Calculate stats
  const durationMinutes = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000);

  const stats = {
    durationMinutes,
    totalDistanceMiles: session.totalDistanceMiles || 0,
    validatedDistanceMiles: session.validatedDistanceMiles || 0,
    gridCellsCovered: session.gridCellsCovered || 0,
  };

  const meetsMinimum = durationMinutes >= CONFIG.MIN_SESSION_MINUTES &&
    stats.validatedDistanceMiles >= CONFIG.MIN_SESSION_MILES;

  const points = meetsMinimum
    ? calculatePoints(stats, session.mission?.createdAt || new Date())
    : { distance: 0, gridBonus: 0, timeBonus: 0, multiplier: 1, total: 0 };

  // Update session
  await prisma.searchSession.update({
    where: { id: sessionId },
    data: {
      status: 'COMPLETED',
      endedAt: new Date(),
      endReason: reason || 'USER_ENDED',
      distanceMiles: stats.validatedDistanceMiles,
      pointsEarned: points.total,
    },
  });

  console.log(`[Search] Ended session ${sessionId}, earned ${points.total} points`);

  return NextResponse.json({
    success: true,
    stats,
    points,
    meetsMinimum,
  });
}

// =============================================================================
// GET HANDLER
// =============================================================================

export async function GET(request, { params }) {
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

    // Auto-cleanup old sessions
    await cleanupOldSessions(user.id, missionId);

    // Get active session
    const activeSession = await prisma.searchSession.findFirst({
      where: {
        missionId,
        userId: user.id,
        status: 'ACTIVE',
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

    return NextResponse.json({
      activeSession: activeSession || null,
    });
  } catch (error) {
    console.error('[Search GET] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
