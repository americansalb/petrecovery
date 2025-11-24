import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

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
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      await logEvent({
        event_type: 'squad.create_failed',
        resource_type: 'rescue_squad',
        action: 'create',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'Attempted to create squad without authentication',
        metadata: {}
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { city, state, zipCode } = await request.json();

    if (!city || !state || !zipCode) {
      await logEvent({
        event_type: 'squad.create_failed',
        resource_type: 'rescue_squad',
        action: 'create',
        result: 'failure',
        error_code: 'VALIDATION_ERROR',
        error_message: 'Missing required parameters: city, state, or zipCode',
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { city, state, zipCode }
      });
      return NextResponse.json({ error: 'City, state, and zipCode required' }, { status: 400 });
    }

    // Emit squad.create_attempted event
    await logEvent({
      event_type: 'squad.create_attempted',
      resource_type: 'rescue_squad',
      action: 'create',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: session.user.role || 'USER',
      metadata: {
        city,
        state,
        zipCode,
        requestedRadiusMiles: 10
      }
    });

    // Verify email and legal acceptance
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        emailVerified: true,
        firstName: true,
        lastName: true,
        waiverAcceptedAt: true,
        waiverVersionAccepted: true
      }
    });

    if (!user?.emailVerified) {
      await logEvent({
        event_type: 'squad.create_failed',
        resource_type: 'rescue_squad',
        action: 'create',
        result: 'failure',
        error_code: 'EMAIL_NOT_VERIFIED',
        error_message: 'User attempted to create squad without verified email',
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { city, state, zipCode }
      });
      return NextResponse.json({ error: 'Email verification required' }, { status: 403 });
    }

    // Check waiver acceptance (Phase 0: Legal Baseline)
    if (!user.waiverAcceptedAt) {
      // Emit both legal.blocked_action AND squad.create_failed for admin visibility
      await logEvent({
        event_type: 'legal.blocked_action',
        resource_type: 'squad',
        action: 'create',
        result: 'failure',
        error_code: 'WAIVER_NOT_ACCEPTED',
        error_message: 'User attempted to create squad without accepting liability waiver',
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: {
          blocked_action: 'squad_create',
          city,
          state,
          zipCode
        }
      });

      await logEvent({
        event_type: 'squad.create_failed',
        resource_type: 'rescue_squad',
        action: 'create',
        result: 'failure',
        error_code: 'WAIVER_NOT_ACCEPTED',
        error_message: 'Squad creation blocked - liability waiver not accepted',
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { city, state, zipCode }
      });

      return NextResponse.json({
        error: 'Liability waiver required',
        code: 'WAIVER_NOT_ACCEPTED',
        message: 'You must accept the liability waiver before creating a rescue squad. Rescue squad participation involves physical risks.',
        redirectTo: `/legal/consent?returnUrl=${encodeURIComponent('/rescue-squads/search')}`
      }, { status: 403 });
    }

    // Geocode to get coordinates
    const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
    if (!geoRes.ok) {
      await logEvent({
        event_type: 'squad.create_failed',
        resource_type: 'rescue_squad',
        action: 'create',
        result: 'failure',
        error_code: 'GEOCODING_FAILED',
        error_message: `Geocoding API returned ${geoRes.status} for ZIP ${zipCode}`,
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { city, state, zipCode, geoStatus: geoRes.status }
      });
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
      await logEvent({
        event_type: 'squad.create_failed',
        resource_type: 'rescue_squad',
        action: 'create',
        result: 'failure',
        error_code: 'DUPLICATE_SQUAD',
        error_message: `Squad already exists for ${city}, ${state}`,
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { city, state, zipCode, existingSquadId: existing.id, existingSquadName: existing.name }
      });
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
            role: 'FOUNDER',
            isActive: true,
          },
        },
      },
    });

    // Update user stats
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        squadsJoinedCount: { increment: 1 },
        rescueLevel: 'SCOUT',
      },
    });

    // Emit squad.created success event
    await logEvent({
      event_type: 'squad.created',
      resource_type: 'rescue_squad',
      resource_id: squad.id,
      action: 'create',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: session.user.role || 'USER',
      metadata: {
        squadId: squad.id,
        squadName: squad.name,
        city: squad.city,
        state: squad.state,
        zipCode,
        centerLatitude: squad.centerLatitude,
        centerLongitude: squad.centerLongitude,
        radiusMiles: squad.radiusMiles,
        founderRole: 'FOUNDER',
        isActive: squad.isActive
      }
    });

    return NextResponse.json({ squad }, { status: 201 });
  } catch (error) {
    // Try to log the failure event (best effort - don't re-throw if logging fails)
    try {
      await logEvent({
        event_type: 'squad.create_failed',
        resource_type: 'rescue_squad',
        action: 'create',
        result: 'failure',
        error_code: 'DB_WRITE_FAILED',
        error_message: error.message || 'Unknown error during squad creation',
        metadata: {
          errorName: error.name,
          errorStack: error.stack?.split('\n')[0] // First line of stack trace
        }
      });
    } catch (logError) {
      console.error('Failed to log squad.create_failed event:', logError);
    }

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
