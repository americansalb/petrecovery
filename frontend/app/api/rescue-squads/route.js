import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// GET /api/rescue-squads - Search for rescue squads by location
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const zip = searchParams.get('zip');
    const lat = parseFloat(searchParams.get('lat'));
    const lng = parseFloat(searchParams.get('lng'));
    const radius = parseInt(searchParams.get('radius')) || 25; // miles

    if (!zip && (!lat || !lng)) {
      return NextResponse.json(
        { error: 'Either zip code or lat/lng required' },
        { status: 400 }
      );
    }

    // If zip code provided, convert to lat/lng using geocoding API
    let searchLat = lat;
    let searchLng = lng;

    if (zip && !lat) {
      // Call geocoding API to convert ZIP to lat/lng
      try {
        const geocodeRes = await fetch(`${request.nextUrl.origin}/api/geocode/zip/${zip}`);
        if (geocodeRes.ok) {
          const geocodeData = await geocodeRes.json();
          searchLat = geocodeData.latitude;
          searchLng = geocodeData.longitude;
        } else {
          // If geocoding fails, return empty array
          return NextResponse.json({ squads: [], zip, error: 'Invalid ZIP code' });
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        return NextResponse.json({ squads: [], zip, error: 'Failed to geocode ZIP' });
      }
    }

    // Search by radius using Haversine formula
    const squads = await prisma.rescueSquad.findMany({
      where: {
        isActive: true,
        isAcceptingCases: true,
        centerLatitude: { not: null },
        centerLongitude: { not: null },
      },
      include: {
        members: {
          where: { isActive: true },
          select: {
            id: true,
            role: true,
            userId: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: { where: { isActive: true } },
            caseAssignments: true,
          },
        },
      },
    });

    // Filter by distance
    const squadsWithDistance = squads
      .map((squad) => {
        const distance = calculateDistance(
          searchLat,
          searchLng,
          squad.centerLatitude,
          squad.centerLongitude
        );
        return { ...squad, distance };
      })
      .filter((squad) => squad.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    return NextResponse.json({ squads: squadsWithDistance });
  } catch (error) {
    console.error('Error searching rescue squads:', error);
    return NextResponse.json(
      { error: 'Failed to search rescue squads' },
      { status: 500 }
    );
  }
}

// POST /api/rescue-squads - Create a new rescue squad
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      centerLatitude,
      centerLongitude,
      radiusMiles = 5,
      specializesInDogs = true,
      specializesInCats = true,
      specializesInBirds = false,
      specializesInOther = false,
    } = body;

    if (!name || !centerLatitude || !centerLongitude) {
      return NextResponse.json(
        { error: 'Name and location required' },
        { status: 400 }
      );
    }

    // Check if squad name already exists
    const existingSquad = await prisma.rescueSquad.findUnique({
      where: { name },
    });

    if (existingSquad) {
      return NextResponse.json(
        { error: 'A rescue squad with this name already exists' },
        { status: 400 }
      );
    }

    // Create squad and add creator as FOUNDER
    const squad = await prisma.rescueSquad.create({
      data: {
        name,
        description,
        centerLatitude,
        centerLongitude,
        radiusMiles,
        specializesInDogs,
        specializesInCats,
        specializesInBirds,
        specializesInOther,
        members: {
          create: {
            userId: session.user.id,
            role: 'FOUNDER',
            isActive: true,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Update user's squad count
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        squadsJoinedCount: { increment: 1 },
        rescueLevel: 'SCOUT', // Level up to SCOUT when joining first squad
      },
    });

    return NextResponse.json({ squad }, { status: 201 });
  } catch (error) {
    console.error('Error creating rescue squad:', error);
    return NextResponse.json(
      { error: 'Failed to create rescue squad' },
      { status: 500 }
    );
  }
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}
