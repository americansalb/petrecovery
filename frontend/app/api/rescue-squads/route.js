import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// GET /api/rescue-squads - Search for cities with rescue squads nearby
export async function GET(request) {
  const timestamp = new Date().toISOString();
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 [${timestamp}] SEARCH SQUADS REQUEST`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const { searchParams } = new URL(request.url);
    const zipCode = searchParams.get('zipCode') || searchParams.get('zip');
    const radius = parseInt(searchParams.get('radius')) || 25;

    console.log('📋 Search parameters:');
    console.log(`   ZIP: ${zipCode || 'none'}`);
    console.log(`   Radius: ${radius} miles`);

    if (!zipCode) {
      console.log('❌ Missing required parameter: zipCode');
      return NextResponse.json({ error: 'Zip code required' }, { status: 400 });
    }

    // Geocode the ZIP code
    console.log(`\n📍 Step 1: Geocoding search ZIP ${zipCode}...`);
    const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
    if (!geoRes.ok) {
      console.log(`❌ External API returned ${geoRes.status}`);
      return NextResponse.json({ error: 'Invalid zip code' }, { status: 400 });
    }

    const geoData = await geoRes.json();
    const place = geoData.places[0];
    const searchLat = parseFloat(place['latitude']);
    const searchLng = parseFloat(place['longitude']);
    const userCity = place['place name'];
    const userState = place['state abbreviation'];

    console.log('📥 Geocoding result:', {
      city: userCity,
      state: userState,
      lat: searchLat,
      lng: searchLng
    });

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    console.log(`👤 User: ${userId || 'anonymous'}`);

    // Find all active squads with coordinates
    console.log(`\n🔍 Step 2: Querying database for active squads...`);
    const squads = await prisma.rescueSquad.findMany({
      where: {
        isActive: true,
        centerLatitude: { not: null },
        centerLongitude: { not: null },
      },
      include: {
        members: {
          where: { isActive: true },
          select: { userId: true, role: true },
        },
        _count: { select: { members: true } },
      },
    });

    console.log(`📊 Found ${squads.length} active squads with coordinates`);
    if (squads.length > 0) {
      squads.forEach(s => {
        console.log(`   - ${s.name} (${s.city}, ${s.state}): (${s.centerLatitude}, ${s.centerLongitude})`);
      });
    }

    // Calculate distances and filter by radius
    console.log(`\n📏 Step 3: Calculating distances from (${searchLat}, ${searchLng})...`);
    const nearbyCities = new Map(); // city-state -> squad info

    squads.forEach(squad => {
      const distance = calculateDistance(searchLat, searchLng, squad.centerLatitude, squad.centerLongitude);
      console.log(`   ${squad.name}: ${distance.toFixed(1)} miles`);

      if (distance <= radius && squad.city && squad.state) {
        const key = `${squad.city}-${squad.state}`;
        if (!nearbyCities.has(key) || nearbyCities.get(key).distance > distance) {
          console.log(`   ✅ ${squad.name} INCLUDED (${distance.toFixed(1)} ≤ ${radius} miles)`);
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
            }
          });
        }
      } else if (distance > radius) {
        console.log(`   ❌ ${squad.name} EXCLUDED (${distance.toFixed(1)} > ${radius} miles)`);
      }
    });

    // Always include user's city
    const userKey = `${userCity}-${userState}`;
    if (!nearbyCities.has(userKey)) {
      console.log(`\n📍 Adding user's city (${userCity}, ${userState}) to results`);
      nearbyCities.set(userKey, {
        city: userCity,
        state: userState,
        distance: 0,
        exists: false,
        squad: null,
      });
    }

    // Convert to array and sort by distance
    const cities = Array.from(nearbyCities.values()).sort((a, b) => a.distance - b.distance);

    console.log(`\n✅ Returning ${cities.length} cities within ${radius} miles:`);
    cities.forEach(c => {
      if (c.exists) {
        console.log(`   ✓ ${c.city}, ${c.state}: ${c.distance.toFixed(1)} mi (Squad exists, ${c.squad.memberCount} members)`);
      } else {
        console.log(`   ○ ${c.city}, ${c.state}: ${c.distance.toFixed(1)} mi (No squad yet)`);
      }
    });
    console.log(`${'='.repeat(80)}\n`);

    return NextResponse.json({
      cities,
      searchLocation: { city: userCity, state: userState, zipCode },
    });
  } catch (error) {
    console.error('❌ Error searching rescue squads:', error);
    console.log(`${'='.repeat(80)}\n`);
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
}

// POST /api/rescue-squads - Create a new city rescue squad
export async function POST(request) {
  const timestamp = new Date().toISOString();
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🏗️ [${timestamp}] CREATE SQUAD REQUEST`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      console.log('❌ Unauthorized: No session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { city, state, zipCode } = await request.json();

    console.log('📋 Create squad parameters:', {
      city,
      state,
      zipCode,
      userId: session.user.id
    });

    if (!city || !state || !zipCode) {
      console.log('❌ Missing required parameters');
      return NextResponse.json({ error: 'City, state, and zipCode required' }, { status: 400 });
    }

    // Verify email
    console.log('\n🔐 Step 1: Verifying user email...');
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true, firstName: true, lastName: true }
    });

    if (!user?.emailVerified) {
      console.log('❌ Email not verified');
      return NextResponse.json({ error: 'Email verification required' }, { status: 403 });
    }
    console.log(`✅ User ${user.firstName} ${user.lastName} is verified`);

    // Geocode to get coordinates
    console.log(`\n📍 Step 2: Geocoding ZIP ${zipCode}...`);
    const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
    if (!geoRes.ok) {
      console.log(`❌ Geocoding failed: ${geoRes.status}`);
      return NextResponse.json({ error: 'Invalid zip code' }, { status: 400 });
    }

    const geoData = await geoRes.json();
    const place = geoData.places[0];
    const latitude = parseFloat(place['latitude']);
    const longitude = parseFloat(place['longitude']);

    console.log('📥 Geocoding result:', {
      lat: latitude,
      lng: longitude,
      city: place['place name'],
      state: place['state abbreviation']
    });

    const squadName = `${city} Rescue Squad`;

    // Check if squad already exists
    console.log(`\n🔍 Step 3: Checking if ${squadName} already exists...`);
    const existing = await prisma.rescueSquad.findFirst({
      where: { city, state }
    });

    if (existing) {
      console.log(`❌ Squad already exists: ${existing.name} (ID: ${existing.id})`);
      return NextResponse.json({ error: 'Squad already exists for this city' }, { status: 400 });
    }
    console.log('✅ No existing squad found');

    // Create squad
    console.log(`\n🏗️ Step 4: Creating ${squadName}...`);
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
            role: 'FOUNDER',
            isActive: true,
          },
        },
      },
    });

    console.log('✅ Squad created successfully:', {
      id: squad.id,
      name: squad.name,
      city: squad.city,
      state: squad.state,
      center: `(${squad.centerLatitude}, ${squad.centerLongitude})`
    });

    console.log('\n👤 Step 5: Updating user stats...');
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        squadsJoinedCount: { increment: 1 },
        rescueLevel: 'SCOUT',
      },
    });

    console.log('✅ User updated successfully');
    console.log(`${'='.repeat(80)}\n`);

    return NextResponse.json({ squad }, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating rescue squad:', error);
    console.log(`${'='.repeat(80)}\n`);
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
