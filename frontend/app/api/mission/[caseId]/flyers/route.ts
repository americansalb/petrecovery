/**
 * Flyer Tracking API Routes
 *
 * GET /api/mission/[caseId]/flyers - List flyer locations with cold spots
 * POST /api/mission/[caseId]/flyers - Mark a GPS-verified flyer location
 *
 * See docs/Actions_Guide.md for full specification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { getVerificationService, getCellId } from '@/lib/actions';

// =============================================================================
// CONSTANTS
// =============================================================================

// Grid cell size for cold spot detection (degrees)
// 0.0009° latitude ≈ 100m, 0.0012° longitude ≈ 100m at mid-latitudes
const LAT_CELL_SIZE = 0.0009;
const LNG_CELL_SIZE = 0.0012;

// Radius for cold spot detection (miles)
const COLD_SPOT_RADIUS_MILES = 0.5;

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /api/mission/[caseId]/flyers
 *
 * List all flyer locations for this case with cold spot suggestions
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

    // Verify case exists and get last seen location
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        lastSeenLatitude: true,
        lastSeenLongitude: true,
      },
    });

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Get all flyer postings
    const flyers = await prisma.flyerPosting.findMany({
      where: { caseId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
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
      postedBy: flyer.user,
    }));

    // Calculate cold spots (areas without flyers)
    let coldSpots: Array<{ lat: number; lng: number; priority: number }> = [];

    if (caseRecord.lastSeenLatitude && caseRecord.lastSeenLongitude) {
      coldSpots = calculateColdSpots(
        flyers.map((f) => ({ lat: f.latitude, lng: f.longitude })),
        caseRecord.lastSeenLatitude,
        caseRecord.lastSeenLongitude,
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
 * POST /api/mission/[caseId]/flyers
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
  { params }: { params: Promise<{ caseId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId } = await params;
    const body = await request.json();

    const { latitude, longitude, photoUrl, notes } = body;

    // Validate required fields
    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: latitude, longitude' },
        { status: 400 }
      );
    }

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

    // Use verification service to create flyer posting
    const verificationService = getVerificationService(prisma);
    const result = await verificationService.verifyFlyerPosting({
      userId: user.id,
      caseId,
      latitude,
      longitude,
      photoUrl,
      notes,
      caseCreatedAt: caseRecord.createdAt,
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
 * Calculate cold spots (100m grid cells without flyers)
 */
function calculateColdSpots(
  flyerLocations: Array<{ lat: number; lng: number }>,
  centerLat: number,
  centerLng: number,
  radiusMiles: number
): Array<{ lat: number; lng: number; priority: number }> {
  const coldSpots: Array<{ lat: number; lng: number; priority: number }> = [];

  // Convert radius to degrees (rough approximation)
  const latRadius = radiusMiles / 69; // ~69 miles per degree latitude
  const lngRadius = radiusMiles / (69 * Math.cos(centerLat * Math.PI / 180));

  // Create set of covered cells
  const coveredCells = new Set<string>();
  for (const loc of flyerLocations) {
    const cellId = getCellId(loc.lat, loc.lng, centerLat - latRadius, centerLng - lngRadius);
    coveredCells.add(cellId);
  }

  // Generate grid and find empty cells
  const gridRows = Math.ceil((2 * latRadius) / LAT_CELL_SIZE);
  const gridCols = Math.ceil((2 * lngRadius) / LNG_CELL_SIZE);

  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const cellId = `${row}_${col}`;
      if (!coveredCells.has(cellId)) {
        const lat = centerLat - latRadius + (row + 0.5) * LAT_CELL_SIZE;
        const lng = centerLng - lngRadius + (col + 0.5) * LNG_CELL_SIZE;

        // Calculate priority based on distance from center
        const distFromCenter = Math.sqrt(
          Math.pow((lat - centerLat) / latRadius, 2) +
          Math.pow((lng - centerLng) / lngRadius, 2)
        );

        // Higher priority for cells closer to center
        const priority = Math.round((1 - distFromCenter) * 100);

        if (priority > 0) {
          coldSpots.push({ lat, lng, priority });
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
