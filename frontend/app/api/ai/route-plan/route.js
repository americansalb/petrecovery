import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import {
  optimizeSearchRoute,
  calculateProbabilityZones,
  generateSearchGrid,
  suggestNextSearchAreas,
  distributeSearchers,
  generateDirections,
} from '@/app/lib/ai/routePlanning';
import prisma from '@/app/lib/prisma';

// POST - Generate optimized search plan
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      missionNumber,
      startLocation,
      searcherCount = 1,
      includeGrid = false,
    } = await request.json();

    if (!missionNumber) {
      return NextResponse.json({ error: 'Mission number required' }, { status: 400 });
    }

    // Get case and sightings
    const missionData = await prisma.case.findUnique({
      where: { missionNumber },
      include: {
        sightings: {
          orderBy: { sightedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!missionData) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    const lastSeenLocation = {
      lat: missionData.lastSeenLatitude,
      lng: missionData.lastSeenLongitude,
    };

    const hoursElapsed = (Date.now() - new Date(missionData.lastSeenAt).getTime()) / 3600000;

    // Calculate probability zones
    const zones = calculateProbabilityZones(
      missionData.sightings.map((s) => ({
        latitude: s.latitude,
        longitude: s.longitude,
        spottedAt: s.sightedAt,
      })),
      lastSeenLocation,
      hoursElapsed
    );

    // Build waypoints from sightings and POIs
    const waypoints = missionData.sightings.map((s) => ({
      lat: s.latitude,
      lng: s.longitude,
      address: s.address,
      type: 'sighting',
      date: s.sightedAt,
      confidence: s.certaintyLevel,
    }));

    // Add last seen location as first waypoint
    waypoints.unshift({
      lat: lastSeenLocation.lat,
      lng: lastSeenLocation.lng,
      address: missionData.lastSeenAddress,
      type: 'last_seen',
      date: missionData.lastSeenAt,
    });

    // Optimize route
    const start = startLocation || lastSeenLocation;
    const optimizedRoute = optimizeSearchRoute(waypoints, start);
    const directions = generateDirections(optimizedRoute);

    // Generate search grid if requested
    let grid = null;
    let suggestions = null;
    if (includeGrid) {
      const searchRadius = zones[1]?.radiusMiles || 2;
      grid = generateSearchGrid(lastSeenLocation, searchRadius, 0.1);

      // Get previously searched areas
      const assignment = await prisma.caseAssignment.findFirst({
        where: { missionId: missionData.id },
        include: { searchAreas: true },
      });

      const searchedAreas = (assignment?.searchAreas || []).map((a) => {
        const geo = JSON.parse(a.geometry);
        const center = geo.coordinates?.[0]?.[0] || [0, 0];
        return {
          cellId: a.id,
          lat: center[1],
          lng: center[0],
        };
      });

      suggestions = suggestNextSearchAreas(grid, searchedAreas).slice(0, 10);
    }

    // Distribute searchers if multiple
    let distribution = null;
    if (searcherCount > 1) {
      const searchers = Array.from({ length: searcherCount }, (_, i) => ({
        id: `searcher-${i + 1}`,
        name: `Searcher ${i + 1}`,
      }));
      distribution = distributeSearchers(searchers, zones);
    }

    return NextResponse.json({
      missionNumber,
      petName: missionData.petName,
      lastSeen: {
        location: lastSeenLocation,
        address: missionData.lastSeenAddress,
        hoursAgo: Math.round(hoursElapsed),
      },
      zones,
      route: optimizedRoute,
      directions,
      grid: includeGrid ? grid : undefined,
      suggestions,
      distribution,
      stats: {
        totalWaypoints: waypoints.length,
        totalSightings: missionData.sightings.length,
        estimatedSearchAreaSqMiles: Math.PI * Math.pow(zones[1]?.radiusMiles || 2, 2),
      },
    });
  } catch (error) {
    console.error('Route planning error:', error);
    return NextResponse.json({ error: 'Route planning failed' }, { status: 500 });
  }
}
