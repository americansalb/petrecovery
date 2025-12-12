/**
 * Case Search Areas API
 *
 * POST /api/missions/[id]/search-areas - Record a GPS-tracked search area
 * GET /api/missions/[id]/search-areas - Get all search areas for a case
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

// POST - Record a new GPS-tracked search area
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { path, method = 'GPS_AUTO', notes, startAddress } = body;

    if (!path || !Array.isArray(path) || path.length < 2) {
      return NextResponse.json(
        { error: 'Invalid GPS path. Need at least 2 points.' },
        { status: 400 }
      );
    }

    // Get the case and its assignment
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const missionData = await prisma.case.findFirst({
      where: isUuid ? { id } : { caseNumber: id },
      include: {
        assignments: {
          take: 1,
          where: {
            status: {
              in: ['ACCEPTED', 'ACTIVE']
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
      },
    });

    if (!missionData) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    const assignment = missionData.assignments[0];
    if (!assignment) {
      return NextResponse.json(
        { error: 'No active assignment for this case' },
        { status: 400 }
      );
    }

    // Convert GPS path to GeoJSON polygon
    // Close the polygon by adding first point at the end if not already closed
    const coordinates = path.map(p => [p.lng, p.lat]); // GeoJSON is [lng, lat]
    const firstPoint = coordinates[0];
    const lastPoint = coordinates[coordinates.length - 1];

    // Only close polygon if we have enough points and it's not already closed
    if (coordinates.length >= 3 &&
        (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1])) {
      coordinates.push(firstPoint);
    }

    const geometry = {
      type: 'Polygon',
      coordinates: [coordinates]
    };

    // Calculate approximate acreage using the shoelace formula
    // This is a rough approximation - more accurate calculation would use geodesic math
    const acreage = calculateAcreage(path);

    // Create the search area record
    const searchArea = await prisma.searchArea.create({
      data: {
        assignmentId: assignment.id,
        markedById: session.user.id,
        geometry: JSON.stringify(geometry),
        acreage,
        notes: notes || null,
        startAddress: startAddress || null,
        potentialSpotting: false,
      },
    });

    // Create activity log entry
    await prisma.caseUpdate.create({
      data: {
        missionId: missionData.id,
        authorId: session.user.id,
        content: `🗺️ Completed GPS-tracked search (${path.length} waypoints, ~${acreage.toFixed(2)} acres)`,
        isUpdate: true,
      },
    });

    // Update case assignment stats
    await prisma.caseAssignment.update({
      where: { id: assignment.id },
      data: {
        areasSearched: {
          increment: 1
        }
      }
    });

    return NextResponse.json({
      searchArea: {
        id: searchArea.id,
        acreage: searchArea.acreage,
        markedAt: searchArea.markedAt,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating search area:', error);
    return NextResponse.json(
      { error: 'Failed to save search area' },
      { status: 500 }
    );
  }
}

// GET - Retrieve all search areas for a case
export async function GET(request, { params }) {
  try {
    const { id } = params;

    // Support both UUID and case number
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const missionData = await prisma.case.findFirst({
      where: isUuid ? { id } : { caseNumber: id },
      include: {
        assignments: {
          include: {
            searchAreas: {
              include: {
                markedBy: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  }
                }
              },
              orderBy: {
                markedAt: 'desc'
              }
            }
          }
        }
      }
    });

    if (!missionData) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Flatten search areas from all assignments
    const searchAreas = missionData.assignments.flatMap(a =>
      a.searchAreas.map(sa => ({
        id: sa.id,
        geometry: JSON.parse(sa.geometry),
        acreage: sa.acreage,
        notes: sa.notes,
        startAddress: sa.startAddress,
        potentialSpotting: sa.potentialSpotting,
        markedAt: sa.markedAt,
        markedBy: {
          id: sa.markedBy.id,
          name: `${sa.markedBy.firstName} ${sa.markedBy.lastName || ''}`.trim()
        }
      }))
    );

    return NextResponse.json({ searchAreas });
  } catch (error) {
    console.error('Error fetching search areas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch search areas' },
      { status: 500 }
    );
  }
}

/**
 * Calculate approximate acreage from GPS points
 * Uses simple planar approximation - good enough for small areas
 * @param {Array} points - Array of {lat, lng} objects
 * @returns {number} - Approximate acreage
 */
function calculateAcreage(points) {
  if (points.length < 3) {
    // For a line/path with less than 3 points, estimate as a narrow corridor
    // Assume 10 meter wide corridor
    const distanceMeters = calculatePathDistance(points);
    const squareMeters = distanceMeters * 10; // 10m wide
    return squareMeters * 0.000247105; // Convert to acres
  }

  // Use shoelace formula for polygon area
  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].lng * points[j].lat;
    area -= points[j].lng * points[i].lat;
  }

  area = Math.abs(area) / 2;

  // Convert from square degrees to square meters (approximate)
  // At mid-latitudes, 1 degree ≈ 111km
  const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / n;
  const metersPerDegreeLat = 111320; // meters
  const metersPerDegreeLng = 111320 * Math.cos(avgLat * Math.PI / 180);

  const squareMeters = area * metersPerDegreeLat * metersPerDegreeLng;

  // Convert square meters to acres (1 acre = 4046.86 square meters)
  return squareMeters * 0.000247105;
}

/**
 * Calculate total path distance in meters
 */
function calculatePathDistance(points) {
  let totalDistance = 0;

  for (let i = 0; i < points.length - 1; i++) {
    totalDistance += haversineDistance(points[i], points[i + 1]);
  }

  return totalDistance;
}

/**
 * Calculate distance between two lat/lng points using Haversine formula
 * @returns {number} - Distance in meters
 */
function haversineDistance(point1, point2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = point1.lat * Math.PI / 180;
  const φ2 = point2.lat * Math.PI / 180;
  const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
  const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}
