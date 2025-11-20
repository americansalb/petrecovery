import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { getZipCodeInfo } from '@/lib/zip-city-mapping';

// GET /api/rescue-squads - Search for rescue squads by location
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const zipCode = searchParams.get('zipCode') || searchParams.get('zip');
    const lat = parseFloat(searchParams.get('lat'));
    const lng = parseFloat(searchParams.get('lng'));
    const radius = parseInt(searchParams.get('radius')) || 25; // miles

    if (!zipCode && (!lat || !lng)) {
      return NextResponse.json(
        { error: 'Either zip code or lat/lng required' },
        { status: 400 }
      );
    }

    // If zip code provided, geocode it to get coordinates
    let searchLat = lat;
    let searchLng = lng;
    let zipInfo = null;

    if (zipCode && !lat) {
      // Look up city from zip code (for city name info)
      zipInfo = getZipCodeInfo(zipCode);

      if (!zipInfo) {
        return NextResponse.json({ squads: [], cityInfo: null });
      }

      // ALWAYS use external geocoding API to get precise lat/lng for radius search
      // (Local database has city names but not coordinates)
      try {
        const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
        if (!geoRes.ok) {
          return NextResponse.json({
            squads: [],
            cityInfo: zipInfo.city ? {
              city: zipInfo.city,
              state: zipInfo.state,
              metro: zipInfo.metro
            } : null
          });
        }

        const geoData = await geoRes.json();
        const place = geoData.places[0];

        // Update zipInfo with geocoded data including coordinates
        zipInfo = {
          zipCode: zipCode,
          city: place['place name'],
          state: place['state abbreviation'],
          metro: `${place['place name']}, ${place['state abbreviation']}`,
          metroValue: `${place['place name'].toUpperCase().replace(/\s+/g, '_')}_${place['state abbreviation']}`,
          // ⭐ CRITICAL: Get lat/lng for radius search
          latitude: parseFloat(place['latitude']),
          longitude: parseFloat(place['longitude'])
        };

        // Set search coordinates
        searchLat = zipInfo.latitude;
        searchLng = zipInfo.longitude;
      } catch (error) {
        console.error('Geocoding error during search:', error);
        return NextResponse.json({
          squads: [],
          cityInfo: zipInfo.city ? {
            city: zipInfo.city,
            state: zipInfo.state,
            metro: zipInfo.metro
          } : null
        });
      }

      console.log('🔍 SEARCH REQUEST:', {
        zipCode,
        city: zipInfo.city,
        searchLat,
        searchLng,
        radius,
        searchType: 'radius-based'
      });
    }

    // If we still don't have coordinates, can't search
    if (!searchLat || !searchLng) {
      return NextResponse.json({
        squads: [],
        cityInfo: zipInfo ? {
          city: zipInfo.city,
          state: zipInfo.state,
          metro: zipInfo.metro
        } : null
      });
    }

    // Get current user's session to check membership
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Search by radius using Haversine formula
    const squads = await prisma.rescueSquad.findMany({
      where: {
        isActive: true,
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
            members: true,
            caseAssignments: true,
          },
        },
      },
    });

    // Filter by distance and add isMember flag
    const squadsWithDistance = squads
      .map((squad) => {
        const distance = calculateDistance(
          searchLat,
          searchLng,
          squad.centerLatitude,
          squad.centerLongitude
        );
        const isMember = userId ? squad.members.some(m => m.userId === userId) : false;
        return {
          ...squad,
          distance,
          memberCount: squad._count.members,
          isMember
        };
      })
      .filter((squad) => squad.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    // Return squads with cityInfo when zipCode was provided
    return NextResponse.json({
      squads: squadsWithDistance,
      ...(zipInfo && {
        zipCode: zipCode,
        cityInfo: {
          city: zipInfo.city,
          state: zipInfo.state,
          metro: zipInfo.metro
        }
      })
    });
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
      zipCode,
      radiusMiles = 5,
      specializesInDogs = true,
      specializesInCats = true,
      specializesInBirds = false,
      specializesInOther = false,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Squad name is required' },
        { status: 400 }
      );
    }

    if (!zipCode) {
      return NextResponse.json(
        { error: 'Zip code is required' },
        { status: 400 }
      );
    }

    // Validate user has verified email
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true }
    });

    if (!user || !user.emailVerified) {
      return NextResponse.json(
        { error: 'Email verification required to create a rescue squad' },
        { status: 403 }
      );
    }

    // Look up city and metro from zip code
    let zipInfo = getZipCodeInfo(zipCode);

    if (!zipInfo) {
      return NextResponse.json(
        { error: `Invalid zip code format.` },
        { status: 400 }
      );
    }

    // ⭐ CRITICAL FIX: Handle external geocoding like join-or-create does
    if (zipInfo.needsGeocode) {
      try {
        console.log(`🌐 ZIP ${zipCode} not in local DB, calling external geocoding API...`);
        const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
        if (!geoRes.ok) {
          return NextResponse.json(
            { error: `Zip code ${zipCode} not found. Please verify it's a valid US zip code.` },
            { status: 400 }
          );
        }

        const geoData = await geoRes.json();
        const place = geoData.places[0];

        zipInfo = {
          zipCode: zipCode,
          city: place['place name'],
          state: place['state abbreviation'],
          metro: `${place['place name']}, ${place['state abbreviation']}`,
          metroValue: `${place['place name'].toUpperCase().replace(/\s+/g, '_')}_${place['state abbreviation']}`,
          // ⭐ NEW: Extract latitude and longitude from API
          latitude: parseFloat(place['latitude']),
          longitude: parseFloat(place['longitude'])
        };
        console.log(`✅ External geocoding success:`, zipInfo);
      } catch (error) {
        console.error('❌ Geocoding error:', error);
        return NextResponse.json(
          { error: `Unable to validate zip code ${zipCode}. Please try again.` },
          { status: 400 }
        );
      }
    }

    // Validate we have city and state before proceeding
    if (!zipInfo.city || !zipInfo.state) {
      return NextResponse.json(
        { error: `Unable to determine location for zip code ${zipCode}.` },
        { status: 400 }
      );
    }

    console.log('📍 Zip lookup:', zipInfo);

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

    console.log('🏗️ CREATING SQUAD:', {
      name,
      city: zipInfo.city,
      state: zipInfo.state,
      zipCode
    });

    // Create squad and add creator as FOUNDER
    const squad = await prisma.rescueSquad.create({
      data: {
        name,
        description,
        city: zipInfo.city,           // ⭐ CRITICAL: Store city for search
        state: zipInfo.state,         // ⭐ CRITICAL: Store state
        zipCodes: JSON.stringify([zipCode]),  // Store as JSON array
        centerLatitude: zipInfo.latitude || null,  // ⭐ NEW: Store geocoded coordinates
        centerLongitude: zipInfo.longitude || null, // ⭐ NEW: Store geocoded coordinates
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

    console.log('✅ SQUAD CREATED SUCCESSFULLY:', {
      id: squad.id,
      name: squad.name,
      city: squad.city,
      state: squad.state,
      zipCodes: squad.zipCodes,
      memberCount: squad.members.length
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
