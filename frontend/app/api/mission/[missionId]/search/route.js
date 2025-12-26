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
import { getPointsService } from '@/lib/actions';

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
  // Urgency multipliers - reward searching sooner after pet goes missing
  URGENCY_MULTIPLIERS: {
    CRITICAL: { maxHours: 6, multiplier: 2.0, label: 'Critical (< 6h)' },
    URGENT: { maxHours: 12, multiplier: 1.75, label: 'Urgent (< 12h)' },
    HIGH: { maxHours: 24, multiplier: 1.5, label: 'High (< 24h)' },
    MODERATE: { maxHours: 48, multiplier: 1.25, label: 'Moderate (< 48h)' },
    STANDARD: { maxHours: 96, multiplier: 1.1, label: 'Standard (< 96h)' },
  },
  // Zone multipliers - reward searching in high probability areas
  ZONE_MULTIPLIERS: {
    HIGH: 4.0,      // 4x points in HIGH probability zone
    MEDIUM: 2.5,    // 2.5x in MEDIUM zone
    LOW: 1.5,       // 1.5x in LOW zone
    EXTENDED: 1.0,  // Base points in EXTENDED zone
    OUTSIDE: 0.5,   // Half points outside all zones
  },
  // Zone radii multipliers (relative to base)
  ZONE_RADIUS_MULTIPLIERS: { HIGH: 1, MEDIUM: 2, LOW: 4, EXTENDED: 8 },
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

/**
 * Get urgency multiplier based on hours since pet was lost
 */
function getUrgencyMultiplier(hoursAfterLost) {
  const { URGENCY_MULTIPLIERS } = CONFIG;

  if (hoursAfterLost < URGENCY_MULTIPLIERS.CRITICAL.maxHours) {
    return URGENCY_MULTIPLIERS.CRITICAL;
  } else if (hoursAfterLost < URGENCY_MULTIPLIERS.URGENT.maxHours) {
    return URGENCY_MULTIPLIERS.URGENT;
  } else if (hoursAfterLost < URGENCY_MULTIPLIERS.HIGH.maxHours) {
    return URGENCY_MULTIPLIERS.HIGH;
  } else if (hoursAfterLost < URGENCY_MULTIPLIERS.MODERATE.maxHours) {
    return URGENCY_MULTIPLIERS.MODERATE;
  } else if (hoursAfterLost < URGENCY_MULTIPLIERS.STANDARD.maxHours) {
    return URGENCY_MULTIPLIERS.STANDARD;
  }
  return { multiplier: 1.0, label: 'Base' };
}

function calculatePoints(stats, lastSeenAt, zoneMultiplier = 1.0) {
  const distancePoints = stats.validatedDistanceMiles * CONFIG.POINTS_PER_MILE;
  const gridPoints = stats.gridCellsCovered * CONFIG.POINTS_PER_GRID_CELL;
  const timePoints = Math.min(
    Math.floor(stats.durationMinutes / 15) * CONFIG.POINTS_PER_15_MIN,
    CONFIG.MAX_TIME_BONUS
  );

  // Base subtotal before multipliers
  let subtotal = distancePoints + gridPoints + timePoints;

  // Apply zone multiplier to distance points (the main reward for searching right areas)
  const zoneBonus = distancePoints * (zoneMultiplier - 1);
  subtotal += zoneBonus;

  // Urgency multiplier - based on how recently pet was lost
  const hoursAfterLost = lastSeenAt
    ? (Date.now() - new Date(lastSeenAt).getTime()) / 3600000
    : 999;
  const urgency = getUrgencyMultiplier(hoursAfterLost);

  return {
    distance: Math.round(distancePoints),
    zoneBonus: Math.round(zoneBonus),
    zoneMultiplier: Math.round(zoneMultiplier * 10) / 10,
    gridBonus: Math.round(gridPoints),
    timeBonus: Math.round(timePoints),
    urgencyMultiplier: urgency.multiplier,
    urgencyLabel: urgency.label,
    total: Math.round(subtotal * urgency.multiplier),
  };
}

/**
 * Calculate base search radius based on pet type and time elapsed
 * Returns radius in miles
 */
function calculateBaseRadius(petSpecies, petSize, lastSeenAt) {
  // Base radius by species
  const speciesBase = {
    DOG: { TINY: 0.3, SMALL: 0.5, MEDIUM: 1.0, LARGE: 1.5, GIANT: 2.5 },
    CAT: 0.25,
    BIRD: 2.0,
    OTHER: 0.5,
  };

  let baseRadius;
  if (petSpecies === 'DOG' && petSize && speciesBase.DOG[petSize]) {
    baseRadius = speciesBase.DOG[petSize];
  } else if (petSpecies === 'CAT') {
    baseRadius = speciesBase.CAT;
  } else if (petSpecies === 'BIRD') {
    baseRadius = speciesBase.BIRD;
  } else {
    baseRadius = speciesBase.OTHER;
  }

  // Time multiplier - radius expands over time
  if (lastSeenAt) {
    const hoursAgo = (Date.now() - new Date(lastSeenAt).getTime()) / 3600000;
    if (hoursAgo < 1) baseRadius *= 1.0;
    else if (hoursAgo < 6) baseRadius *= 1.3;
    else if (hoursAgo < 24) baseRadius *= 1.8;
    else if (hoursAgo < 72) baseRadius *= 2.5;
    else if (hoursAgo < 168) baseRadius *= 3.5;
    else baseRadius *= 4.5;
  }

  return baseRadius;
}

/**
 * Calculate average zone multiplier from location pings
 */
function calculateZoneMultiplier(pings, lastSeenLat, lastSeenLng, baseRadius) {
  if (!pings?.length || !lastSeenLat || !lastSeenLng || !baseRadius) {
    return 1.0;
  }

  const validPings = pings.filter(p => p.isValid);
  if (!validPings.length) return 1.0;

  let totalMultiplier = 0;

  validPings.forEach(ping => {
    const distance = calculateDistance(ping.latitude, ping.longitude, lastSeenLat, lastSeenLng);

    // Determine which zone this ping falls into
    if (distance <= baseRadius * CONFIG.ZONE_RADIUS_MULTIPLIERS.HIGH) {
      totalMultiplier += CONFIG.ZONE_MULTIPLIERS.HIGH;
    } else if (distance <= baseRadius * CONFIG.ZONE_RADIUS_MULTIPLIERS.MEDIUM) {
      totalMultiplier += CONFIG.ZONE_MULTIPLIERS.MEDIUM;
    } else if (distance <= baseRadius * CONFIG.ZONE_RADIUS_MULTIPLIERS.LOW) {
      totalMultiplier += CONFIG.ZONE_MULTIPLIERS.LOW;
    } else if (distance <= baseRadius * CONFIG.ZONE_RADIUS_MULTIPLIERS.EXTENDED) {
      totalMultiplier += CONFIG.ZONE_MULTIPLIERS.EXTENDED;
    } else {
      totalMultiplier += CONFIG.ZONE_MULTIPLIERS.OUTSIDE;
    }
  });

  return totalMultiplier / validPings.length;
}

/**
 * Calculate total distance from all location pings
 * This gives accurate distance even if accumulated values were missed
 */
function calculateDistanceFromPings(pings) {
  if (!pings || pings.length < 2) {
    return { total: 0, validated: 0 };
  }

  let totalDistance = 0;
  let validatedDistance = 0;

  for (let i = 1; i < pings.length; i++) {
    const prev = pings[i - 1];
    const curr = pings[i];

    const dist = calculateDistance(
      prev.latitude, prev.longitude,
      curr.latitude, curr.longitude
    );

    // Skip obvious GPS glitches (jumps > 0.5 miles between pings)
    if (dist > 0.5) continue;

    totalDistance += dist;

    // Only count validated distance if both points are valid
    if (prev.isValid && curr.isValid) {
      validatedDistance += dist;
    }
  }

  return { total: totalDistance, validated: validatedDistance };
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
      gridCellsCovered: 0, // Start at 0 - earn grid cells by moving
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
      lastSeenLat: true,
      lastSeenLng: true,
      locationPings: {
        select: { latitude: true, longitude: true, isValid: true, createdAt: true },
        orderBy: { createdAt: 'asc' }, // Order by time to calculate distance correctly
      },
      mission: {
        select: {
          createdAt: true,
          petSpecies: true,
          petSize: true,
          lastSeenAt: true,
        },
      },
    },
  });

  if (!session) {
    // Session not found - that's fine, just return success
    return NextResponse.json({ success: true, message: 'Session already ended' });
  }

  if (session.status === 'COMPLETED') {
    return NextResponse.json({ success: true, message: 'Session already ended' });
  }

  // Calculate stats - RECALCULATE distance from pings for accuracy
  // This ensures we get correct distance even if some pings were missed during accumulation
  const durationMinutes = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000);
  const recalculatedDistance = calculateDistanceFromPings(session.locationPings);

  // Use the GREATER of accumulated or recalculated distance
  // (in case recalculation missed some valid segments due to glitch filtering)
  const finalValidatedDistance = Math.max(
    session.validatedDistanceMiles || 0,
    recalculatedDistance.validated
  );
  const finalTotalDistance = Math.max(
    session.totalDistanceMiles || 0,
    recalculatedDistance.total
  );

  console.log(`[Search] Distance calculation: accumulated=${session.validatedDistanceMiles?.toFixed(3)}, recalculated=${recalculatedDistance.validated.toFixed(3)}, final=${finalValidatedDistance.toFixed(3)}, pings=${session.locationPings.length}`);

  const stats = {
    durationMinutes,
    totalDistanceMiles: finalTotalDistance,
    validatedDistanceMiles: finalValidatedDistance,
    gridCellsCovered: session.gridCellsCovered || 0,
  };

  const meetsMinimum = durationMinutes >= CONFIG.MIN_SESSION_MINUTES &&
    stats.validatedDistanceMiles >= CONFIG.MIN_SESSION_MILES;

  // Calculate zone multiplier based on where the user searched
  let zoneMultiplier = 1.0;
  if (meetsMinimum && session.lastSeenLat && session.lastSeenLng) {
    // Calculate base radius based on pet species/size and time elapsed
    const baseRadius = calculateBaseRadius(
      session.mission?.petSpecies,
      session.mission?.petSize,
      session.mission?.lastSeenAt
    );
    zoneMultiplier = calculateZoneMultiplier(
      session.locationPings,
      session.lastSeenLat,
      session.lastSeenLng,
      baseRadius
    );
  }

  const points = meetsMinimum
    ? calculatePoints(stats, session.mission?.lastSeenAt, zoneMultiplier)
    : { distance: 0, zoneBonus: 0, zoneMultiplier: 1, gridBonus: 0, timeBonus: 0, urgencyMultiplier: 1, urgencyLabel: 'None', total: 0 };

  // Create VerifiedAction to track points in gamification system
  let verifiedActionId = null;
  if (meetsMinimum && points.total > 0) {
    try {
      const pointsService = getPointsService(prisma);
      const awardResult = await pointsService.awardVerifiedPoints({
        userId,
        missionId,
        actionType: 'search_area',
        verificationMethod: 'GPS',
        basePoints: points.distance,
        metadata: {
          sessionId,
          durationMinutes: stats.durationMinutes,
          distanceMiles: stats.validatedDistanceMiles,
          gridCellsCovered: stats.gridCellsCovered,
          zoneMultiplier: points.zoneMultiplier,
          zoneBonus: points.zoneBonus,
          gridBonus: points.gridBonus,
          timeBonus: points.timeBonus,
          urgencyMultiplier: points.urgencyMultiplier,
          urgencyLabel: points.urgencyLabel,
        },
        caseCreatedAt: session.mission?.createdAt,
        caseLostAt: session.mission?.lastSeenAt,
      });
      verifiedActionId = awardResult.verifiedActionId;
      console.log(`[Search] Created VerifiedAction ${verifiedActionId} with ${awardResult.awardedPoints} points`);
    } catch (err) {
      console.error('[Search] Failed to create VerifiedAction:', err);
      // Continue - points are still stored on session even if VerifiedAction fails
    }
  }

  // Update session
  await prisma.searchSession.update({
    where: { id: sessionId },
    data: {
      status: 'COMPLETED',
      endedAt: new Date(),
      endReason: reason || 'USER_ENDED',
      distanceMiles: stats.validatedDistanceMiles,
      pointsEarned: points.total,
      verifiedActionId,
    },
  });

  console.log(`[Search] Ended session ${sessionId}, earned ${points.total} points (zone multiplier: ${zoneMultiplier.toFixed(1)}x)`);

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
