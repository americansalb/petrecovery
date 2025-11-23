import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { getCitiesByZip, getCityByName } from '@/app/lib/cities';

// GET /api/rescue-squads - Search for cities with rescue squads nearby
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('search') || searchParams.get('zipCode') || searchParams.get('zip');
    const radius = parseInt(searchParams.get('radius')) || 25;

    if (!searchTerm) {
      return NextResponse.json({ error: 'City name or ZIP code required' }, { status: 400 });
    }

    let searchLat, searchLng, userState, allCitiesInZip, zipCode;
    const isZipCode = /^\d{5}$/.test(searchTerm.trim());

    if (isZipCode) {
      // Search by ZIP code - use cities library
      zipCode = searchTerm.trim();
      const citiesForZip = getCitiesByZip(zipCode);

      console.log(`🔍 [ZIP SEARCH] ZIP: ${zipCode}`);
      console.log(`📊 [ZIP SEARCH] getCitiesByZip returned ${citiesForZip.length} cities:`);
      citiesForZip.forEach((c, i) => console.log(`   ${i + 1}. ${c.city}, ${c.state_id}`));

      if (citiesForZip.length === 0) {
        return NextResponse.json({ error: 'Invalid ZIP code' }, { status: 400 });
      }

      // Use the first city's data for coordinates (will use zippopotam for coordinates)
      const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const place = geoData.places[0];
        searchLat = parseFloat(place['latitude']);
        searchLng = parseFloat(place['longitude']);
      } else {
        // Fallback if geo API fails - use approximate coordinates from database search
        searchLat = null;
        searchLng = null;
      }

      userState = citiesForZip[0].state_id;
      allCitiesInZip = citiesForZip.map(c => c.city);

      console.log(`✅ [ZIP SEARCH] allCitiesInZip array has ${allCitiesInZip.length} cities:`, allCitiesInZip);
    } else {
      // Search by city name - use cities library
      const cityName = searchTerm.trim();
      const cityData = getCityByName(cityName);

      if (!cityData) {
        return NextResponse.json({ error: 'Invalid city name' }, { status: 400 });
      }

      // Check if a squad exists for this city
      const existingSquad = await prisma.rescueSquad.findFirst({
        where: {
          city: { equals: cityName, mode: 'insensitive' },
          isActive: true
        }
      });

      if (existingSquad) {
        // Use the existing squad's coordinates
        searchLat = existingSquad.centerLatitude;
        searchLng = existingSquad.centerLongitude;
      } else {
        // Try to get coordinates from zippopotam using first ZIP
        const firstZip = cityData.zips.length > 0 ? cityData.zips[0] : null;
        if (firstZip) {
          const geoRes = await fetch(`https://api.zippopotam.us/us/${firstZip}`);
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const place = geoData.places[0];
            searchLat = parseFloat(place['latitude']);
            searchLng = parseFloat(place['longitude']);
          } else {
            searchLat = null;
            searchLng = null;
          }
        } else {
          searchLat = null;
          searchLng = null;
        }
      }

      userState = cityData.state_id;
      allCitiesInZip = [cityData.city];
      zipCode = cityData.zips.length > 0 ? cityData.zips[0] : null;
    }

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

    console.log(`[RESCUE SQUAD SEARCH] Found ${squads.length} total squads`);
    console.log(`[RESCUE SQUAD SEARCH] Searching from ${allCitiesInZip.join(', ')}, ${userState || 'unknown state'} (${searchLat}, ${searchLng}) within ${radius} miles`);

    // If we have coordinates, find nearby squads
    if (searchLat !== null && searchLng !== null) {
      squads.forEach(squad => {
        const distance = calculateDistance(searchLat, searchLng, squad.centerLatitude, squad.centerLongitude);
        console.log(`[RESCUE SQUAD SEARCH] ${squad.city}, ${squad.state}: ${distance.toFixed(1)} miles away`);

        if (distance <= radius && squad.city && squad.state) {
        const key = `${squad.city}-${squad.state}`;
        console.log(`[RESCUE SQUAD SEARCH] ✓ Adding ${squad.city} to results`);
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
    }

    // Always include ALL cities from the search
    console.log(`📍 [ZIP SEARCH] Adding ALL ${allCitiesInZip.length} cities to results...`);
    console.log(`   BEFORE: nearbyCities has ${nearbyCities.size} entries`);

    allCitiesInZip.forEach((cityName, index) => {
      const cityKey = userState ? `${cityName}-${userState}` : cityName;
      console.log(`   [${index + 1}/${allCitiesInZip.length}] Processing: ${cityName}, ${userState} (key: ${cityKey})`);

      if (!nearbyCities.has(cityKey)) {
        nearbyCities.set(cityKey, {
          city: cityName,
          state: userState,
          distance: 0,
          exists: false,
          squad: null,
          divisions: []
        });
        console.log(`      ➕ ADDED to nearbyCities`);
      } else {
        console.log(`      ✓ Already in nearbyCities (has squad)`);
      }
    });

    console.log(`   AFTER: nearbyCities has ${nearbyCities.size} entries`);

    // Convert to array and sort by distance
    const cities = Array.from(nearbyCities.values()).sort((a, b) => a.distance - b.distance);

    console.log(`🎯 [ZIP SEARCH] FINAL RESULTS - Returning ${cities.length} cities:`);
    cities.forEach((c, i) => console.log(`   ${i + 1}. ${c.city}, ${c.state} (${c.distance.toFixed(1)}mi, ${c.exists ? 'HAS SQUAD' : 'NO SQUAD'})`));

    return NextResponse.json({
      cities,
      searchLocation: {
        cities: allCitiesInZip,
        state: userState,
        zipCode
      },
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

    console.log('🏗️ [CREATE SQUAD] Received request:', { city, state, zipCode });

    if (!city || !state || !zipCode) {
      return NextResponse.json({ error: 'City, state, and zipCode required' }, { status: 400 });
    }

    // Validate city exists in our database
    const cityData = getCityByName(city, state);
    if (!cityData) {
      console.error(`❌ [CREATE SQUAD] City not found in database: ${city}, ${state}`);
      return NextResponse.json({
        error: `City "${city}, ${state}" not found in our database. Please use the city search to select a valid city.`
      }, { status: 400 });
    }

    console.log('✓ [CREATE SQUAD] City validated:', cityData.city, cityData.state_id, cityData.state_name);

    // Verify ZIP code belongs to this city
    if (!cityData.zips.includes(zipCode)) {
      console.error(`❌ [CREATE SQUAD] ZIP ${zipCode} doesn't belong to ${city}, ${state}`);
      return NextResponse.json({
        error: `ZIP code ${zipCode} doesn't belong to ${city}, ${state}. Valid ZIPs: ${cityData.zips.slice(0, 3).join(', ')}`
      }, { status: 400 });
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
