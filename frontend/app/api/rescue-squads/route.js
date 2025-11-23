import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { searchCityOrZip } from '@/app/lib/cities';

// GET /api/rescue-squads - Search for cities with rescue squads nearby
export async function GET(request) {
  try {
    console.log('🔍 [API] Rescue squad search request received');
    const { searchParams } = new URL(request.url);
    const searchInput = searchParams.get('search') || searchParams.get('zipCode') || searchParams.get('zip');
    const radius = parseInt(searchParams.get('radius')) || 25;

    console.log('📥 [API] Search params:', { searchInput, radius });

    if (!searchInput) {
      console.error('❌ [API] No search input provided');
      return NextResponse.json({ error: 'City name or ZIP code required' }, { status: 400 });
    }

    // Use cities.js to search - returns ALL cities for a ZIP code or matching city names
    console.log('🔍 [API] Searching cities database for:', searchInput);
    const searchedCities = searchCityOrZip(searchInput.trim());
    console.log('📊 [API] Found', searchedCities.length, 'matching cities in OUR database');

    // Log all cities found
    if (searchedCities.length > 0) {
      console.log('📋 [API] Cities from OUR database:');
      searchedCities.forEach(c => console.log(`   - ${c.city}, ${c.state_id}`));
    }

    if (!searchedCities || searchedCities.length === 0) {
      console.error('❌ [API] No cities found for:', searchInput);
      return NextResponse.json({
        error: 'City or ZIP code not found. Please enter a valid US city name or 5-digit ZIP code.'
      }, { status: 400 });
    }

    // Use first city from OUR database for center coordinates
    const firstCity = searchedCities[0];
    const zipCode = firstCity.zips[0];

    console.log('🎯 [API] Using city from OUR database for center:', {
      city: firstCity.city,
      state: firstCity.state_id,
      zipCode,
      totalCitiesFound: searchedCities.length
    });

    // Geocode ONLY for coordinates (we ignore the city name from geocoding API)
    const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
    if (!geoRes.ok) {
      console.error('❌ [API] Failed to geocode ZIP:', zipCode);
      return NextResponse.json({ error: 'Failed to geocode location' }, { status: 500 });
    }

    const geoData = await geoRes.json();
    const place = geoData.places[0];
    const searchLat = parseFloat(place['latitude']);
    const searchLng = parseFloat(place['longitude']);

    console.log('✅ [API] Coordinates from geocoding (city name IGNORED):', {
      lat: searchLat,
      lng: searchLng,
      geocodingApiSaid: place['place name'],
      weAreUsing: firstCity.city
    });

    console.log('👤 [API] Getting session...');
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    console.log('👤 [API] User ID:', userId || 'Not logged in');

    // Find all active squads with coordinates
    console.log('🔍 [API] Querying database for active rescue squads...');
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
        divisions: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            centerLatitude: true,
            centerLongitude: true,
            totalMembers: true,
            activeCases: true,
            successfulReunions: true,
          },
        },
        _count: { select: { members: true } },
      },
    });

    console.log('📊 [API] Found', squads.length, 'active rescue squads in database');

    // Calculate distances and filter by radius
    const nearbyCities = new Map(); // city-state -> squad info
    const nearbyDivisions = []; // array of divisions with distance

    console.log('📏 [API] Calculating distances from search location...');
    squads.forEach(squad => {
      const distance = calculateDistance(searchLat, searchLng, squad.centerLatitude, squad.centerLongitude);
      if (distance <= radius && squad.city && squad.state) {
        const key = `${squad.city}-${squad.state}`;
        const isMember = userId ? squad.members.some(m => m.userId === userId) : false;

        if (!nearbyCities.has(key) || nearbyCities.get(key).distance > distance) {
          nearbyCities.set(key, {
            city: squad.city,
            state: squad.state,
            distance,
            exists: true,
            squad: {
              id: squad.id,
              name: squad.name,
              memberCount: squad._count.members,
              isMember,
              totalCasesAccepted: squad.totalCasesAccepted,
              successfulReunions: squad.successfulReunions,
            }
          });
        }

        // Process divisions for this squad
        if (squad.divisions && squad.divisions.length > 0) {
          squad.divisions.forEach(division => {
            if (division.centerLatitude && division.centerLongitude) {
              const divDistance = calculateDistance(searchLat, searchLng, division.centerLatitude, division.centerLongitude);
              if (divDistance <= radius) {
                const isDivisionMember = userId ? squad.members.some(m =>
                  m.userId === userId && m.divisionId === division.id
                ) : false;

                nearbyDivisions.push({
                  id: division.id,
                  name: division.name,
                  description: division.description,
                  distance: divDistance,
                  squadId: squad.id,
                  squadName: squad.name,
                  squadCity: squad.city,
                  squadState: squad.state,
                  memberCount: division.totalMembers,
                  activeCases: division.activeCases,
                  successfulReunions: division.successfulReunions,
                  isMember: isDivisionMember,
                  isSquadMember: isMember,
                });
              }
            }
          });
        }
      }
    });

    // Add ALL searched cities to results (so if ZIP has 3 cities, all 3 show up)
    console.log('📍 [API] Adding all searched cities to results...');
    searchedCities.forEach(cityData => {
      const key = `${cityData.city}-${cityData.state_id}`;
      if (!nearbyCities.has(key)) {
        // City doesn't have a squad yet - add it with exists: false
        nearbyCities.set(key, {
          city: cityData.city,
          state: cityData.state_id,
          distance: 0, // Distance from search center (which is based on this ZIP)
          exists: false,
          squad: null,
        });
        console.log('  ➕ Added city without squad:', cityData.city, cityData.state_id);
      } else {
        console.log('  ✓ City already has squad:', cityData.city, cityData.state_id);
      }
    });

    // Convert cities to array and sort by distance
    const cities = Array.from(nearbyCities.values()).sort((a, b) => a.distance - b.distance);

    // Sort divisions by distance
    const divisions = nearbyDivisions.sort((a, b) => a.distance - b.distance);

    console.log('✅ [API] Search complete:', {
      citiesFound: cities.length,
      divisionsFound: divisions.length,
      searchedCitiesCount: searchedCities.length,
      searchLocation: {
        city: firstCity.city,
        state: firstCity.state_id,
        zipCode
      }
    });

    return NextResponse.json({
      cities,
      divisions,
      searchLocation: {
        city: firstCity.city,
        state: firstCity.state_id,
        zipCode
      },
    });
  } catch (error) {
    console.error('❌ [API] Error searching rescue squads:', error);
    console.error('Stack trace:', error.stack);
    return NextResponse.json({
      error: 'Failed to search: ' + error.message
    }, { status: 500 });
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
