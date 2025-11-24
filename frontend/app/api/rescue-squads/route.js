import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { getCitiesByZip, getCityByName } from '@/app/lib/cities';
import { logEvent } from '@/lib/logging';

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
    allCitiesInZip.forEach(cityName => {
      const cityKey = userState ? `${cityName}-${userState}` : cityName;
      if (!nearbyCities.has(cityKey)) {
        nearbyCities.set(cityKey, {
          city: cityName,
          state: userState,
          distance: 0,
          exists: false,
          squad: null,
          divisions: []
        });
      }
    });

    // Convert to array and sort by distance
    const cities = Array.from(nearbyCities.values()).sort((a, b) => a.distance - b.distance);

    console.log(`[RESCUE SQUAD SEARCH] Returning ${cities.length} cities:`, cities.map(c => `${c.city} (${c.distance.toFixed(1)}mi, exists: ${c.exists})`));

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
    console.error('Error creating rescue squad:', error);
    await logEvent({
      event_type: 'squad.create_failed',
      resource_type: 'rescue_squad',
      action: 'create',
      result: 'failure',
      error_code: 'DB_WRITE_FAILED',
      error_message: error.message,
      metadata: { error_stack: error.stack?.substring(0, 500) }
    });
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
