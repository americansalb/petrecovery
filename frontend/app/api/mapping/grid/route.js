import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { generateSearchGrid, toGeoJSON } from '@/app/lib/mapping/heatmap';

/**
 * GET /api/mapping/grid
 * Get search grid for a case
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const cellSize = parseFloat(searchParams.get('cellSize') || '0.1'); // miles

    if (!caseId) {
      return NextResponse.json({ error: 'Case ID required' }, { status: 400 });
    }

    // Get case details
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        lastSeenLatitude: true,
        lastSeenLongitude: true,
        searchRadius: true,
      },
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Generate grid
    const grid = generateSearchGrid(
      { lat: caseData.lastSeenLatitude, lng: caseData.lastSeenLongitude },
      caseData.searchRadius || 5,
      cellSize
    );

    // Get searched cells
    const assignments = await prisma.caseAssignment.findMany({
      where: { caseId },
      select: { id: true },
    });

    const searchAreas = await prisma.searchArea.findMany({
      where: {
        assignmentId: { in: assignments.map(a => a.id) },
      },
      select: {
        geometry: true,
        markedBy: { select: { firstName: true } },
        markedAt: true,
        potentialSpotting: true,
      },
    });

    // Mark searched cells
    for (const area of searchAreas) {
      try {
        const geometry = typeof area.geometry === 'string'
          ? JSON.parse(area.geometry)
          : area.geometry;

        const centroid = calculatePolygonCentroid(geometry);

        // Find matching grid cell
        for (const cell of grid) {
          if (isPointInBounds(centroid, cell.bounds)) {
            cell.searched = true;
            cell.searchedBy = area.markedBy?.firstName;
            cell.searchedAt = area.markedAt;
            cell.potentialSpotting = cell.potentialSpotting || area.potentialSpotting;
          }
        }
      } catch (e) {
        // Skip invalid geometry
      }
    }

    // Calculate stats
    const searchedCount = grid.filter(c => c.searched).length;
    const highPrioritySearched = grid.filter(c => c.searched && c.priority === 'high').length;
    const totalHighPriority = grid.filter(c => c.priority === 'high').length;

    return NextResponse.json({
      grid,
      stats: {
        totalCells: grid.length,
        searchedCells: searchedCount,
        coveragePercent: Math.round((searchedCount / grid.length) * 100),
        highPriorityCoverage: totalHighPriority > 0
          ? Math.round((highPrioritySearched / totalHighPriority) * 100)
          : 0,
      },
      center: {
        lat: caseData.lastSeenLatitude,
        lng: caseData.lastSeenLongitude,
      },
      radius: caseData.searchRadius || 5,
    });
  } catch (error) {
    console.error('Grid error:', error);
    return NextResponse.json({ error: 'Failed to generate grid' }, { status: 500 });
  }
}

/**
 * POST /api/mapping/grid
 * Mark a grid cell as searched
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId, cellId, bounds, notes, potentialSpotting } = await request.json();

    if (!caseId || !cellId || !bounds) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get assignment for this case
    const assignment = await prisma.caseAssignment.findFirst({
      where: {
        caseId,
        participants: {
          some: { userId: session.user.id, isActive: true },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    // Create polygon from bounds
    const geometry = {
      type: 'Polygon',
      coordinates: [[
        [bounds.west, bounds.south],
        [bounds.east, bounds.south],
        [bounds.east, bounds.north],
        [bounds.west, bounds.north],
        [bounds.west, bounds.south], // Close polygon
      ]],
    };

    // Calculate acreage
    const width = (bounds.east - bounds.west) * 69 * Math.cos(((bounds.north + bounds.south) / 2) * Math.PI / 180);
    const height = (bounds.north - bounds.south) * 69;
    const acreage = width * height * 640; // Convert square miles to acres

    // Create search area
    const searchArea = await prisma.searchArea.create({
      data: {
        assignmentId: assignment.id,
        markedById: session.user.id,
        geometry: JSON.stringify(geometry),
        acreage,
        notes,
        potentialSpotting: potentialSpotting || false,
      },
    });

    // Update user stats
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        areasMarkedCount: { increment: 1 },
        totalAcreageSearched: { increment: acreage },
      },
    });

    return NextResponse.json({
      success: true,
      searchArea: {
        id: searchArea.id,
        cellId,
        acreage: Math.round(acreage * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Mark cell error:', error);
    return NextResponse.json({ error: 'Failed to mark cell' }, { status: 500 });
  }
}

function calculatePolygonCentroid(geometry) {
  const coords = geometry.coordinates?.[0] || geometry;
  let sumLat = 0, sumLng = 0;

  for (const coord of coords) {
    sumLng += coord[0];
    sumLat += coord[1];
  }

  return {
    lat: sumLat / coords.length,
    lng: sumLng / coords.length,
  };
}

function isPointInBounds(point, bounds) {
  return point.lat >= bounds.south &&
    point.lat <= bounds.north &&
    point.lng >= bounds.west &&
    point.lng <= bounds.east;
}
