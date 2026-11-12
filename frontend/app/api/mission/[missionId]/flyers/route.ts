/**
 * Flyer Tracking API Routes
 *
 * GET /api/mission/[missionId]/flyers - List flyer locations with cold spots
 * POST /api/mission/[missionId]/flyers - Mark a GPS-verified flyer location
 *
 * See docs/Actions_Guide.md for full specification.
 *
 * For the people a search's own lists are for (`mayKnowThePeople`,
 * app/lib/missionControl/guard.js): the owner, an active member of a force
 * looking for the pet, and staff. It used to answer any account, for any
 * pet: read where every flyer went up with its poster's account id and full
 * name, and add a marker with a note of any length and any address for a
 * picture. A poster is a first name here, and what is added is checked.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { getVerificationService, getCellId } from '@/lib/actions';
import { mayKnowThePeople, cleanPlace } from '@/app/lib/missionControl/guard';
import { onlyText, cut, firstWord } from '@/app/lib/searchText';
import { withRateLimitAsync, rateLimitResponse, RateLimitPresets } from '@/app/lib/rateLimit';

// =============================================================================
// CONSTANTS
// =============================================================================

// Grid cell size for cold spot detection (degrees)
// 0.0009° latitude ≈ 100m, 0.0012° longitude ≈ 100m at mid-latitudes
const LAT_CELL_SIZE = 0.0009;
const LNG_CELL_SIZE = 0.0012;

// Radius for cold spot detection (miles)
const COLD_SPOT_RADIUS_MILES = 0.5;

const NOTE_MAX = 300;
const PHOTO_URL_MAX = 500;
const WRITE_LIMIT = { windowMs: 60 * 1000, maxRequests: 10, blockDurationMs: 60 * 1000 };
const REFUSAL = { error: 'Only the owner and the forces looking for this pet can see this.', code: 'NOT_ALLOWED' };

/** An https address of a picture, or null. Anything else is not kept. */
function pictureAddress(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > PHOTO_URL_MAX) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /api/mission/[missionId]/flyers
 *
 * List all flyer locations for this case with cold spot suggestions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await withRateLimitAsync(request, RateLimitPresets.SEARCH_READ, 'case:flyers-read');
    if (!limited.success) return rateLimitResponse(limited) as NextResponse;

    const { missionId } = await params;

    // Verify case exists and get last seen location
    const missionRecord = await prisma.case.findUnique({
      where: { id: missionId },
      select: {
        id: true,
        lastSeenLatitude: true,
        lastSeenLongitude: true,
      },
    });

    if (!missionRecord) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    const who = await mayKnowThePeople(request, missionRecord.id);
    if (!who.allowed) return NextResponse.json(REFUSAL, { status: who.status });

    // Get all flyer postings. A poster is a first name.
    const flyers = await prisma.flyerPosting.findMany({
      where: { missionId },
      include: {
        user: {
          select: { firstName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Format flyer data
    const formattedFlyers = flyers.map((flyer) => ({
      id: flyer.id,
      location: {
        lat: flyer.latitude,
        lng: flyer.longitude,
      },
      photoUrl: flyer.photoUrl,
      notes: flyer.notes,
      pointsEarned: flyer.pointsEarned,
      createdAt: flyer.createdAt,
      postedBy: { firstName: firstWord(flyer.user?.firstName) || 'A helper' },
    }));

    // Calculate cold spots (areas without flyers)
    let coldSpots: ColdSpot[] = [];

    if (missionRecord.lastSeenLatitude && missionRecord.lastSeenLongitude) {
      coldSpots = calculateColdSpots(
        flyers.map((f) => ({ lat: f.latitude, lng: f.longitude })),
        missionRecord.lastSeenLatitude,
        missionRecord.lastSeenLongitude,
        COLD_SPOT_RADIUS_MILES
      );
    }

    return NextResponse.json({
      flyers: formattedFlyers,
      total: flyers.length,
      coldSpots,
      coverage: {
        totalFlyers: flyers.length,
        uniqueCells: getUniqueCells(flyers),
      },
    });
  } catch (error) {
    console.error('Flyers GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mission/[missionId]/flyers
 *
 * Mark a GPS-verified flyer location
 *
 * Body: {
 *   latitude: number,
 *   longitude: number,
 *   photoUrl?: string,
 *   notes?: string,
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await withRateLimitAsync(request, WRITE_LIMIT, 'case:flyers-write');
    if (!limited.success) return rateLimitResponse(limited) as NextResponse;

    const { missionId } = await params;
    const sent = await request.json().catch(() => null);
    const body = sent && typeof sent === 'object' && !Array.isArray(sent) ? sent : {};

    // Where the flyer went up: two real numbers on the globe. A note is text held to a length, and a picture
    // is an https address or nothing.
    const place = cleanPlace({ lat: body.latitude, lng: body.longitude });
    if (!place) {
      return NextResponse.json(
        { error: 'Missing required fields: latitude, longitude' },
        { status: 400 }
      );
    }
    const { lat: latitude, lng: longitude } = place;
    const photoUrl = pictureAddress(body.photoUrl) || undefined;
    const notes = typeof body.notes === 'string' ? cut(onlyText(body.notes).replace(/\s+/g, ' ').trim(), NOTE_MAX) || undefined : undefined;

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify case exists
    const missionRecord = await prisma.case.findUnique({
      where: { id: missionId },
      select: { id: true, createdAt: true },
    });

    if (!missionRecord) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    const who = await mayKnowThePeople(request, missionRecord.id);
    if (!who.allowed) return NextResponse.json(REFUSAL, { status: who.status });

    // Use verification service to create flyer posting
    const verificationService = getVerificationService(prisma);
    const result = await verificationService.verifyFlyerPosting({
      userId: user.id,
      missionId,
      latitude,
      longitude,
      photoUrl,
      notes,
      caseCreatedAt: missionRecord.createdAt,
    });

    return NextResponse.json({
      success: true,
      flyerId: result.flyerId,
      pointsEarned: result.pointsEarned,
      isVerified: result.isVerified,
    });
  } catch (error) {
    console.error('Flyers POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Cold spot type matching spec
 */
interface ColdSpot {
  center: { lat: number; lng: number };
  cellId: string;
  distanceFromLastSeen: number;
  priority: number;
}

/**
 * Calculate cold spots (100m grid cells without flyers)
 * Per Actions_Guide.md spec: returns center, cellId, distanceFromLastSeen
 */
function calculateColdSpots(
  flyerLocations: Array<{ lat: number; lng: number }>,
  centerLat: number,
  centerLng: number,
  radiusMiles: number
): ColdSpot[] {
  const coldSpots: ColdSpot[] = [];

  // Convert radius to degrees (rough approximation)
  const latRadius = radiusMiles / 69; // ~69 miles per degree latitude
  const lngRadius = radiusMiles / (69 * Math.cos(centerLat * Math.PI / 180));

  // Create set of covered cells
  const coveredCells = new Set<string>();
  const originLat = centerLat - latRadius;
  const originLng = centerLng - lngRadius;

  for (const loc of flyerLocations) {
    const cellId = getCellId(loc.lat, loc.lng, originLat, originLng);
    coveredCells.add(cellId);
  }

  // Generate grid and find empty cells
  const gridRows = Math.ceil((2 * latRadius) / LAT_CELL_SIZE);
  const gridCols = Math.ceil((2 * lngRadius) / LNG_CELL_SIZE);

  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      // Generate cellId per spec: letter + number format
      const colLetter = String.fromCharCode(65 + (col % 26)); // A-Z
      const rowNum = row + 1;
      const cellId = `${colLetter}${rowNum}`;
      const internalCellId = `${row}_${col}`;

      if (!coveredCells.has(internalCellId)) {
        const lat = centerLat - latRadius + (row + 0.5) * LAT_CELL_SIZE;
        const lng = centerLng - lngRadius + (col + 0.5) * LNG_CELL_SIZE;

        // Calculate distance from center in miles using Haversine formula
        const distanceFromLastSeen = haversineDistance(centerLat, centerLng, lat, lng);

        // Only include cells within the radius
        if (distanceFromLastSeen <= radiusMiles) {
          // Higher priority for cells closer to center
          const priority = Math.round((1 - (distanceFromLastSeen / radiusMiles)) * 100);

          if (priority > 0) {
            coldSpots.push({
              center: { lat, lng },
              cellId,
              distanceFromLastSeen: Math.round(distanceFromLastSeen * 100) / 100,
              priority,
            });
          }
        }
      }
    }
  }

  // Sort by priority and return top suggestions
  return coldSpots
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10);
}

/**
 * Calculate distance between two points in miles using Haversine formula
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get count of unique grid cells covered by flyers
 */
function getUniqueCells(flyers: Array<{ latitude: number; longitude: number }>): number {
  if (flyers.length === 0) return 0;

  // Use first flyer as origin
  const originLat = flyers[0].latitude;
  const originLng = flyers[0].longitude;

  const cells = new Set<string>();
  for (const flyer of flyers) {
    const cellId = getCellId(flyer.latitude, flyer.longitude, originLat, originLng);
    cells.add(cellId);
  }

  return cells.size;
}
