import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { getZipCodeInfo } from '@/lib/zip-city-mapping';

// GET /api/rescue-squads - Search for rescue squads by location
export async function GET(request) {
  const timestamp = new Date().toISOString();
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 [${timestamp}] SEARCH SQUADS REQUEST`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const { searchParams } = new URL(request.url);
    const zipCode = searchParams.get('zipCode') || searchParams.get('zip');
    const lat = parseFloat(searchParams.get('lat'));
    const lng = parseFloat(searchParams.get('lng'));
    const radius = parseInt(searchParams.get('radius')) || 25;

    console.log('📋 Search parameters:');
    console.log(`   ZIP: ${zipCode || 'none'}`);
    console.log(`   Lat: ${lat || 'none'}`);
    console.log(`   Lng: ${lng || 'none'}`);
    console.log(`   Radius: ${radius} miles`);

    if (!zipCode && (!lat || !lng)) {
      console.log('❌ Missing required parameters');
      return NextResponse.json(
        { error: 'Either zip code or lat/lng required' },
        { status: 400 }
      );
    }

    let searchLat = lat;
    let searchLng = lng;
    let zipInfo = null;

    if (zipCode && !lat) {
      console.log(`\n📍 Step 1: Geocoding search ZIP ${zipCode}...`);

      zipInfo = getZipCodeInfo(zipCode);

      if (!zipInfo) {
        console.log('❌ ZIP not found');
        return NextResponse.json({ squads: [], cityInfo: null });
      }

      console.log('📊 Local ZIP result:', {
        city: zipInfo.city,
        state: zipInfo.state,
        needsGeocode: zipInfo.needsGeocode
      });

      console.log('🌐 Calling external geocoding API...');
      try {
        const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
        if (!geoRes.ok) {
          console.log(`❌ External API returned ${geoRes.status}`);
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

        console.log('📥 External API response:', {
          city: place['place name'],
          state: place['state abbreviation'],
          lat: place['latitude'],
          lng: place['longitude']
        });

        zipInfo = {
          zipCode: zipCode,
          city: place['place name'],
          state: place['state abbreviation'],
          metro: `${place['place name']}, ${place['state abbreviation']}`,
          metroValue: `${place['place name'].toUpperCase().replace(/\s+/g, '_')}_${place['state abbreviation']}`,
          latitude: parseFloat(place['latitude']),
          longitude: parseFloat(place['longitude'])
        };

        searchLat = zipInfo.latitude;
        searchLng = zipInfo.longitude;

        console.log(`✅ Search center: (${searchLat}, ${searchLng})`);
      } catch (error) {
        console.error('❌ Geocoding error:', error);
        return NextResponse.json({
          squads: [],
          cityInfo: zipInfo.city ? {
            city: zipInfo.city,
            state: zipInfo.state,
            metro: zipInfo.metro
          } : null
        });
      }
    }

    if (!searchLat || !searchLng) {
      console.log('❌ No search coordinates');
      return NextResponse.json({
        squads: [],
        cityInfo: zipInfo ? {
          city: zipInfo.city,
          state: zipInfo.state,
          metro: zipInfo.metro
        } : null
      });
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    console.log(`\n👤 User: ${userId || 'anonymous'}`);

    console.log(`\n🔍 Step 2: Querying database...`);
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

    console.log(`📊 Found ${squads.length} squads with coordinates:`);
    squads.forEach(s => {
      console.log(`   - ${s.name}: (${s.centerLatitude}, ${s.centerLongitude})`);
    });

    console.log(`\n📏 Step 3: Calculating distances from (${searchLat}, ${searchLng})...`);
    const squadsWithDistance = squads
      .map((squad) => {
        const distance = calculateDistance(
          searchLat,
          searchLng,
          squad.centerLatitude,
          squad.centerLongitude
        );
        console.log(`   ${squad.name}: ${distance.toFixed(1)} miles`);
        const isMember = userId ? squad.members.some(m => m.userId === userId) : false;
        return {
          ...squad,
          distance,
          memberCount: squad._count.members,
          isMember
        };
      })
      .filter((squad) => {
        const withinRadius = squad.distance <= radius;
        if (!withinRadius) {
          console.log(`   ❌ ${squad.name} EXCLUDED (${squad.distance.toFixed(1)} > ${radius})`);
        }
        return withinRadius;
      })
      .sort((a, b) => a.distance - b.distance);

    console.log(`\n✅ ${squadsWithDistance.length} squad(s) within ${radius} miles:`);
    squadsWithDistance.forEach(s => {
      console.log(`   ✓ ${s.name}: ${s.distance.toFixed(1)} mi, ${s.memberCount} members`);
    });
    console.log(`${'='.repeat(80)}\n`);

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
