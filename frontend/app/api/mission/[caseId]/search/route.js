/**
 * Search Session API Routes
 *
 * POST /api/mission/[caseId]/search - Start, ping, end, or log search
 *
 * See docs/Actions_Guide.md for full specification.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * POST /api/mission/[caseId]/search
 *
 * Unified search endpoint with action-based routing:
 * - action: 'start' - Start GPS-tracked session
 * - action: 'ping' - Update location during search
 * - action: 'end' - End search session and calculate points
 * - action: 'log' - Manual search log (self-reported)
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId } = await params;
    const body = await request.json();

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify case exists
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, createdAt: true },
    });

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    switch (body.action) {
      case 'start':
        return handleSearchStart(user.id, caseId, body);

      case 'ping':
        return handleSearchPing(body);

      case 'end':
        return handleSearchEnd(user.id, caseId, body, caseRecord.createdAt);

      case 'log':
        return handleSearchLog(user.id, body);

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, ping, end, or log' },
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
async function handleSearchStart(userId, caseId, body) {
  const { latitude, longitude } = body;

  // Check for existing active session
  const existingSession = await prisma.searchSession.findFirst({
    where: {
      caseId,
      userId,
      status: { in: ['READY', 'ACTIVE'] },
    },
  });

  if (existingSession) {
    return NextResponse.json(
      { error: 'Active session already exists', sessionId: existingSession.id },
      { status: 409 }
    );
  }

  // Create search session
  const searchSession = await prisma.searchSession.create({
    data: {
      case: { connect: { id: caseId } },
      user: { connect: { id: userId } },
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
    },
  });

  // Create initial location ping
  await prisma.locationPing.create({
    data: {
      session: { connect: { id: searchSession.id } },
      latitude,
      longitude,
    },
  });

  return NextResponse.json({
    success: true,
    sessionId: searchSession.id,
    startedAt: searchSession.startedAt,
  });
}

/**
 * Update location during active search
 */
async function handleSearchPing(body) {
  const { sessionId, latitude, longitude, accuracy, heading } = body;

  // Verify session exists and is active
  const session = await prisma.searchSession.findUnique({
    where: { id: sessionId },
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

  // Update session location
  await prisma.searchSession.update({
    where: { id: sessionId },
    data: {
      currentLocation: JSON.stringify({ lat: latitude, lng: longitude, accuracy, heading }),
      lastLocationUpdate: new Date(),
    },
  });

  // Create location ping
  await prisma.locationPing.create({
    data: {
      session: { connect: { id: sessionId } },
      latitude,
      longitude,
      accuracy,
      heading,
    },
  });

  return NextResponse.json({ success: true });
}

/**
 * End search session and calculate points
 */
async function handleSearchEnd(userId, caseId, body, caseCreatedAt) {
  const { sessionId } = body;

  // Get session with location pings
  const session = await prisma.searchSession.findUnique({
    where: { id: sessionId },
    include: {
      locationPings: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.status === 'COMPLETED') {
    return NextResponse.json(
      { error: 'Session already completed' },
      { status: 400 }
    );
  }

  // Calculate distance from location pings
  const pings = session.locationPings;
  let distanceMiles = 0;

  for (let i = 1; i < pings.length; i++) {
    distanceMiles += calculateDistance(
      pings[i - 1].latitude,
      pings[i - 1].longitude,
      pings[i].latitude,
      pings[i].longitude
    );
  }

  // Calculate points (10 pts per mile, max 100 per session)
  const pointsEarned = Math.min(Math.round(distanceMiles * 10), 100);

  // Update session
  await prisma.searchSession.update({
    where: { id: sessionId },
    data: {
      status: 'COMPLETED',
      endedAt: new Date(),
      distanceMiles,
      pointsEarned,
    },
  });

  return NextResponse.json({
    success: true,
    sessionId,
    distanceMiles: Math.round(distanceMiles * 100) / 100,
    pointsEarned,
    isVerified: true,
  });
}

/**
 * Log a manual search (self-reported, no GPS)
 */
async function handleSearchLog(userId, body) {
  const { note, approximateLocation } = body;

  // Award 5 points for manual log
  const pointsEarned = 5;

  return NextResponse.json({
    success: true,
    pointsEarned,
    note: note || null,
    location: approximateLocation || null,
  });
}

/**
 * GET /api/mission/[caseId]/search
 *
 * Get active search session for current user
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId } = await params;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get active session
    const activeSession = await prisma.searchSession.findFirst({
      where: {
        caseId,
        userId: user.id,
        status: { in: ['READY', 'ACTIVE'] },
      },
      include: {
        locationPings: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!activeSession) {
      return NextResponse.json({ activeSession: null });
    }

    return NextResponse.json({
      activeSession: {
        id: activeSession.id,
        status: activeSession.status,
        startedAt: activeSession.startedAt,
        lastLocation: activeSession.locationPings[0] || null,
        distanceMiles: activeSession.distanceMiles,
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
