import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { getCitiesByZip, getCityByName } from '@/app/lib/cities';
import { logEvent } from '@/lib/logging';

// GET /api/rescue-squads - Search for cities with rescue squads nearby
export async function GET(request) {
  const session = await getServerSession(authOptions);

  try {
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('search') || searchParams.get('zipCode') || searchParams.get('zip');
    const radius = parseInt(searchParams.get('radius')) || 25;

    if (!searchTerm) {
      await logEvent({
        event_type: 'squad.search_failed',
        resource_type: 'rescue_squad',
        action: 'read',
        result: 'failure',
        error_code: 'VALIDATION_ERROR',
        error_message: 'Search term is required',
        actor_user_id: session?.user?.id || null,
        actor_role: null,
        metadata: {
          search_term: searchTerm,
          radius
        }
      });
      return NextResponse.json({ error: 'City name or ZIP code required' }, { status: 400 });
    }

    let searchLat, searchLng, userState, allCitiesInZip, zipCode;
    const isZipCode = /^\d{5}$/.test(searchTerm.trim());

    if (isZipCode) {
      // Search by ZIP code - use cities library
      zipCode = searchTerm.trim();
      const citiesForZip = getCitiesByZip(zipCode);

      if (citiesForZip.length === 0) {
        await logEvent({
          event_type: 'squad.search_failed',
          resource_type: 'rescue_squad',
          action: 'read',
          result: 'failure',
          error_code: 'INVALID_ZIP',
          error_message: `Invalid ZIP code: ${zipCode}`,
          actor_user_id: session?.user?.id || null,
          actor_role: null,
          metadata: {
            search_term: searchTerm,
            zip_code: zipCode
          }
        });
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
        await logEvent({
          event_type: 'squad.search_failed',
          resource_type: 'rescue_squad',
          action: 'read',
          result: 'failure',
          error_code: 'INVALID_CITY',
          error_message: `Invalid city name: ${cityName}`,
          actor_user_id: session?.user?.id || null,
          actor_role: null,
          metadata: {
            search_term: searchTerm,
            city_name: cityName
          }
        });
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

    // If we have coordinates, find nearby squads
    if (searchLat !== null && searchLng !== null) {
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

    // Log successful search
    await logEvent({
      event_type: 'squad.search_completed',
      resource_type: 'rescue_squad',
      action: 'read',
      result: 'success',
      actor_user_id: session?.user?.id || null,
      actor_role: null,
      metadata: {
        search_term: searchTerm,
        search_type: isZipCode ? 'zip' : 'city',
        radius_miles: radius,
        results_count: cities.length,
        squads_found: cities.filter(c => c.exists).length,
        cities_searched: allCitiesInZip,
        search_state: userState,
        search_coordinates: searchLat !== null ? { lat: searchLat, lng: searchLng } : null
      }
    });

    return NextResponse.json({
      cities,
      searchLocation: {
        cities: allCitiesInZip,
        state: userState,
        zipCode
      },
    });
  } catch (error) {
    // Log search failure - use console.error to avoid recursive failures
    console.error('Squad search failed:', error.message);
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
        actor_role: null,
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
      actor_role: null,
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
        actor_role: null,
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
        actor_role: null,
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
        actor_role: null,
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
        actor_role: null,
        metadata: { city, state, zipCode, geoStatus: geoRes.status }
      });
      return NextResponse.json({ error: 'Invalid zip code' }, { status: 400 });
    }

    const geoData = await geoRes.json();
    const place = geoData.places[0];
    const latitude = parseFloat(place['latitude']);
    const longitude = parseFloat(place['longitude']);

    const squadName = `${city} Rescue Squad`;

    // Check if squad already exists (active)
    const existingActive = await prisma.rescueSquad.findFirst({
      where: { city, state, isDeleted: false }
    });

    if (existingActive) {
      await logEvent({
        event_type: 'squad.create_failed',
        resource_type: 'rescue_squad',
        action: 'create',
        result: 'failure',
        error_code: 'DUPLICATE_SQUAD',
        error_message: `Squad already exists for ${city}, ${state}`,
        actor_user_id: session.user.id,
        actor_role: null,
        metadata: { city, state, zipCode, existingSquadId: existingActive.id, existingSquadName: existingActive.name }
      });
      return NextResponse.json({ error: 'Squad already exists for this city' }, { status: 400 });
    }

    // Check if there's a deleted squad we can reactivate
    const deletedSquad = await prisma.rescueSquad.findFirst({
      where: { city, state, isDeleted: true }
    });

    let squad;

    if (deletedSquad) {
      // Reactivate the deleted squad with new founder
      squad = await prisma.rescueSquad.update({
        where: { id: deletedSquad.id },
        data: {
          isDeleted: false,
          deletedAt: null,
          isActive: true,
          isAcceptingCases: true,
          centerLatitude: latitude,
          centerLongitude: longitude,
          zipCodes: JSON.stringify([zipCode]),
          members: {
            create: {
              userId: session.user.id,
              role: 'FOUNDER',
              isActive: true,
            },
          },
        },
      });

      await logEvent({
        event_type: 'squad.reactivated',
        resource_type: 'rescue_squad',
        resource_id: squad.id,
        action: 'update',
        result: 'success',
        actor_user_id: session.user.id,
        metadata: { city, state, zipCode, reactivated: true }
      });
    } else {
      // Create new squad
      squad = await prisma.rescueSquad.create({
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
    }

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
      actor_role: null,
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
    await logEvent({
      event_type: 'squad.create_failed',
      resource_type: 'rescue_squad',
      action: 'create',
      result: 'failure',
      error_code: 'DB_WRITE_FAILED',
      error_message: error.message,
      metadata: {
        error_name: error.name,
        error_stack: error.stack?.substring(0, 500)
      }
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
