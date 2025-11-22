import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// GET /api/rescue-squads - Search for cities with rescue squads nearby
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const zipCode = searchParams.get('zipCode') || searchParams.get('zip');
    const radius = parseInt(searchParams.get('radius')) || 25;

    if (!zipCode) {
      return NextResponse.json({ error: 'Zip code required' }, { status: 400 });
    }

    // Geocode the ZIP code
    const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
    if (!geoRes.ok) {
      return NextResponse.json({ error: 'Invalid zip code' }, { status: 400 });
    }

    const geoData = await geoRes.json();
    const place = geoData.places[0];
    const searchLat = parseFloat(place['latitude']);
    const searchLng = parseFloat(place['longitude']);
    const userCity = place['place name'];
    const userState = place['state abbreviation'];

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Find all active squads with coordinates
    const squads = await prisma.rescueSquad.findMany({
      where: {
        isActive: true,
        centerLatitude: { not: null },
        centerLongitude: { not: null },
      },
      include: {
        members: {
          where: { isActive: true },
          select: { userId: true, role: true, divisionId: true },
        },
        _count: { select: { members: true } },
        divisions: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            centerLatitude: true,
            centerLongitude: true,
            totalMembers: true,
            _count: { select: { members: true } },
            members: userId ? {
              where: { userId, isActive: true },
              select: { userId: true }
            } : false
          }
        }
      },
    });

    // Calculate distances and filter by radius
    const nearbyCities = new Map(); // city-state -> squad info

    squads.forEach(squad => {
      const distance = calculateDistance(searchLat, searchLng, squad.centerLatitude, squad.centerLongitude);
      if (distance <= radius && squad.city && squad.state) {
        const key = `${squad.city}-${squad.state}`;
        if (!nearbyCities.has(key) || nearbyCities.get(key).distance > distance) {
          // Calculate division distances and membership
          const divisionsWithDistance = squad.divisions
            .map(div => {
              const divDistance = div.centerLatitude && div.centerLongitude
                ? calculateDistance(searchLat, searchLng, div.centerLatitude, div.centerLongitude)
                : null;
              return {
                id: div.id,
                name: div.name,
                distance: divDistance,
                totalMembers: div.totalMembers || div._count.members,
                isMember: userId ? div.members.some(m => m.userId === userId) : false
              };
            })
            .filter(div => div.distance !== null) // Only include divisions with coordinates
            .sort((a, b) => a.distance - b.distance); // Sort by distance

          nearbyCities.set(key, {
            city: squad.city,
            state: squad.state,
            distance,
            exists: true,
            squad: {
              id: squad.id,
              name: squad.name,
              memberCount: squad._count.members,
              isMember: userId ? squad.members.some(m => m.userId === userId) : false,
              totalCasesAccepted: squad.totalCasesAccepted,
              successfulReunions: squad.successfulReunions,
            },
            divisions: divisionsWithDistance
          });
        }
      }
    });

    // Always include user's city
    const userKey = `${userCity}-${userState}`;
    if (!nearbyCities.has(userKey)) {
      nearbyCities.set(userKey, {
        city: userCity,
        state: userState,
        distance: 0,
        exists: false,
        squad: null,
        divisions: []
      });
    }

    // Convert to array and sort by distance
    const cities = Array.from(nearbyCities.values()).sort((a, b) => a.distance - b.distance);

    return NextResponse.json({
      cities,
      searchLocation: { city: userCity, state: userState, zipCode },
    });
  } catch (error) {
    console.error('Error searching rescue squads:', error);
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
}

// POST /api/rescue-squads - Create a new city rescue squad
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { city, state, zipCode } = await request.json();

    if (!city || !state || !zipCode) {
      return NextResponse.json({ error: 'City, state, and zipCode required' }, { status: 400 });
    }

    // Verify email
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true }
    });

    if (!user?.emailVerified) {
      return NextResponse.json({ error: 'Email verification required' }, { status: 403 });
    }

    // Geocode to get coordinates
    const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
    if (!geoRes.ok) {
      return NextResponse.json({ error: 'Invalid zip code' }, { status: 400 });
    }

    const geoData = await geoRes.json();
    const place = geoData.places[0];
    const latitude = parseFloat(place['latitude']);
    const longitude = parseFloat(place['longitude']);

    const squadName = `${city} Rescue Squad`;

    // Check if squad already exists
    const existing = await prisma.rescueSquad.findFirst({
      where: { city, state }
    });

    if (existing) {
      return NextResponse.json({ error: 'Squad already exists for this city' }, { status: 400 });
    }

    // Create squad
    const squad = await prisma.rescueSquad.create({
      data: {
        name: squadName,
        city,
        state,
        zipCodes: JSON.stringify([zipCode]),
        centerLatitude: latitude,
        centerLongitude: longitude,
        radiusMiles: 10,
        specializesInDogs: true,
        specializesInCats: true,
        members: {
          create: {
            userId: session.user.id,
            role: 'ADMINISTRATOR',
            isActive: true,
          },
        },
      },
    });

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        squadsJoinedCount: { increment: 1 },
        squadsFoundedCount: { increment: 1 },
        rescueLevel: 'SCOUT',
      },
    });

    return NextResponse.json({ squad }, { status: 201 });
  } catch (error) {
    console.error('Error creating rescue squad:', error);
    return NextResponse.json({ error: 'Failed to create squad' }, { status: 500 });
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}
