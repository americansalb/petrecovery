/**
 * Points of Interest API for Mission Map
 *
 * GET /api/missions/[missionId]/pois
 * Returns shelters, vets, and animal control near the last seen location
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';

// Haversine distance calculation
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

export async function GET(request, { params }) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { missionId } = params;
    const { searchParams } = new URL(request.url);
    const radiusMiles = parseFloat(searchParams.get('radius') || '10');

    // Get mission with last seen location
    const mission = await prisma.case.findUnique({
      where: { id: missionId },
      select: {
        id: true,
        lastSeenLatitude: true,
        lastSeenLongitude: true,
      },
    });

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    const { lastSeenLatitude, lastSeenLongitude } = mission;

    if (!lastSeenLatitude || !lastSeenLongitude) {
      return NextResponse.json({
        pois: [],
        message: 'No last seen location set for this mission',
      });
    }

    // Search for shelters in the database near the location
    // Using a bounding box for initial filter, then calculate exact distance
    const latRange = radiusMiles / 69; // Rough conversion: 1 degree lat ≈ 69 miles
    const lngRange = radiusMiles / (69 * Math.cos(lastSeenLatitude * Math.PI / 180));

    const shelters = await prisma.shelter.findMany({
      where: {
        isActive: true,
        latitude: {
          gte: lastSeenLatitude - latRange,
          lte: lastSeenLatitude + latRange,
        },
        longitude: {
          gte: lastSeenLongitude - lngRange,
          lte: lastSeenLongitude + lngRange,
        },
      },
      select: {
        id: true,
        name: true,
        type: true,
        address: true,
        city: true,
        state: true,
        phone: true,
        website: true,
        hours: true,
        latitude: true,
        longitude: true,
      },
      take: 50,
    });

    // Calculate exact distances and filter
    const poisWithDistance = shelters
      .map(shelter => {
        const distance = calculateDistance(
          lastSeenLatitude,
          lastSeenLongitude,
          shelter.latitude,
          shelter.longitude
        );
        return {
          ...shelter,
          distance: Math.round(distance * 10) / 10, // Round to 1 decimal
          // Icon based on type
          icon: getPoiIcon(shelter.type),
        };
      })
      .filter(poi => poi.distance <= radiusMiles)
      .sort((a, b) => a.distance - b.distance);

    return NextResponse.json({
      pois: poisWithDistance,
      center: {
        lat: lastSeenLatitude,
        lng: lastSeenLongitude,
      },
      radiusMiles,
      total: poisWithDistance.length,
    });
  } catch (error) {
    console.error('POI API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getPoiIcon(type) {
  switch (type?.toUpperCase()) {
    case 'SHELTER':
      return '🏠';
    case 'RESCUE':
      return '🐾';
    case 'VET':
      return '🏥';
    case 'ANIMAL_CONTROL':
      return '🚔';
    default:
      return '📍';
  }
}
