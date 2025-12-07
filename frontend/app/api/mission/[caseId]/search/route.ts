/**
 * Search Session API Routes
 *
 * POST /api/mission/[caseId]/search - Start, ping, end, or log search
 *
 * See docs/Actions_Guide.md for full specification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { getVerificationService, getPointsService } from '@/lib/actions';

// =============================================================================
// TYPES
// =============================================================================

interface SearchStartBody {
  action: 'start';
  latitude: number;
  longitude: number;
}

interface SearchPingBody {
  action: 'ping';
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
}

interface SearchEndBody {
  action: 'end';
  sessionId: string;
}

interface SearchLogBody {
  action: 'log';
  note?: string;
  approximateLocation?: {
    lat: number;
    lng: number;
  };
}

type SearchRequestBody = SearchStartBody | SearchPingBody | SearchEndBody | SearchLogBody;

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
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId } = await params;
    const body: SearchRequestBody = await request.json();

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
async function handleSearchStart(
  userId: string,
  caseId: string,
  body: SearchStartBody
): Promise<NextResponse> {
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

  // Get or create case participant
  let participant = await prisma.caseParticipant.findFirst({
    where: { caseId, odId: userId },
  });

  if (!participant) {
    participant = await prisma.caseParticipant.create({
      data: {
        caseId,
        odId: userId,
        userId,
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });
  }

  // Create search session
  const searchSession = await prisma.searchSession.create({
    data: {
      participantId: participant.id,
      caseId,
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
    },
  });

  // Create initial location ping
  await prisma.locationPing.create({
    data: {
      sessionId: searchSession.id,
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
async function handleSearchPing(body: SearchPingBody): Promise<NextResponse> {
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
      sessionId,
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
async function handleSearchEnd(
  userId: string,
  caseId: string,
  body: SearchEndBody,
  caseCreatedAt: Date
): Promise<NextResponse> {
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

  // Convert location pings to path
  const path = session.locationPings.map((ping) => ({
    lat: ping.latitude,
    lng: ping.longitude,
    timestamp: ping.createdAt.toISOString(),
  }));

  // Use verification service to complete session
  const verificationService = getVerificationService(prisma);
  const result = await verificationService.completeSearchSession({
    sessionId,
    userId,
    caseId,
    path,
    caseCreatedAt,
  });

  return NextResponse.json({
    success: true,
    sessionId: result.sessionId,
    distanceMiles: result.distanceMiles,
    pointsEarned: result.pointsEarned,
    isVerified: result.isVerified,
    error: result.error,
  });
}

/**
 * Log a manual search (self-reported, no GPS)
 */
async function handleSearchLog(
  userId: string,
  body: SearchLogBody
): Promise<NextResponse> {
  const { note, approximateLocation } = body;

  // Award self-reported points (5 pts per log, subject to cap)
  const pointsService = getPointsService(prisma);
  const result = await pointsService.awardSelfReportedPoints({
    userId,
    points: 5, // Manual search log = 5 pts
  });

  return NextResponse.json({
    success: true,
    pointsEarned: result.awardedPoints,
    remainingDaily: result.dailyTotals.remaining,
    note: note || null,
    location: approximateLocation || null,
  });
}

/**
 * GET /api/mission/[caseId]/search
 *
 * Get active search session for current user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
): Promise<NextResponse> {
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
