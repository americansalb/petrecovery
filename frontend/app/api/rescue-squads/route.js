import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { getCitiesByZip, getCityByName } from '@/app/lib/cities';
import { getMexicanStateFromPostalCode } from '@/app/lib/states';
import { logEvent } from '@/lib/logging';

// GET /api/rescue-squads - Search for cities with rescue squads nearby
export async function GET(request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  // Debug logging
  console.log('[Squad Search] Session user ID:', userId);

  try {
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('search') || searchParams.get('zipCode') || searchParams.get('zip');
    const radius = parseInt(searchParams.get('radius')) || 25;
    const country = searchParams.get('country') || 'US';
    // For international cities, lat/lng can be passed directly
    const passedLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')) : null;
    const passedLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')) : null;
    const passedState = searchParams.get('state') || null;

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
          radius,
          country
        }
      });
      return NextResponse.json({ error: 'City name or postal code required' }, { status: 400 });
    }

    let searchLat, searchLng, userState, allCitiesInZip, zipCode;
    const isZipCode = /^\d{5}$/.test(searchTerm.trim());

    // Handle non-US cities with passed lat/lng (including MX, CA, CO, HT, etc.)
    if (country !== 'US' && passedLat !== null && passedLng !== null) {
      searchLat = passedLat;
      searchLng = passedLng;
      userState = passedState;
      allCitiesInZip = [searchTerm.trim()];
      zipCode = null; // International cities may not have ZIP codes
    }
    // Fallback: Handle Mexican locations via Nominatim if no lat/lng passed
    else if (country === 'MX') {
      const result = await searchMexicanLocation(searchTerm.trim(), isZipCode);
      if (!result.success) {
        await logEvent({
          event_type: 'squad.search_failed',
          resource_type: 'rescue_squad',
          action: 'read',
          result: 'failure',
          error_code: 'INVALID_LOCATION',
          error_message: result.error,
          actor_user_id: session?.user?.id || null,
          metadata: { search_term: searchTerm, country }
        });
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      searchLat = result.lat;
      searchLng = result.lng;
      userState = result.state;
      allCitiesInZip = [result.city];
      zipCode = result.postalCode;
    } else if (isZipCode) {
      // US ZIP code search - use cities library
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
      // US city name search - use cities library
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

    // Find all active squads with coordinates (filter by country)
    const squads = await prisma.rescueSquad.findMany({
      where: {
        isActive: true,
        centerLatitude: { not: null },
        centerLongitude: { not: null },
        country: country,
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

          // Check membership
          const isMember = userId ? squad.members.some(m => m.userId === userId) : false;

          // Debug logging
          if (userId) {
            console.log(`[Squad Search] Squad ${squad.name}: userId=${userId}, members count=${squad.members.length}, isMember=${isMember}`);
            if (squad.members.length > 0 && squad.members.length < 10) {
              console.log(`[Squad Search] Member userIds:`, squad.members.map(m => m.userId));
            }
          }

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
              totalMissionsAccepted: squad.totalMissionsAccepted,
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

    const { city, state, zipCode, country = 'US', lat: passedLat, lng: passedLng } = await request.json();

    // For international cities, lat/lng are required instead of zipCode
    const isInternational = country !== 'US' && country !== 'MX';
    if (!city || !state || (!zipCode && !isInternational) || (isInternational && (!passedLat || !passedLng))) {
      const errorMsg = isInternational
        ? 'City, state, and coordinates (lat/lng) required for international locations'
        : 'City, state, and postal code required';
      await logEvent({
        event_type: 'squad.create_failed',
        resource_type: 'rescue_squad',
        action: 'create',
        result: 'failure',
        error_code: 'VALIDATION_ERROR',
        error_message: errorMsg,
        actor_user_id: session.user.id,
        actor_role: null,
        metadata: { city, state, zipCode, country, lat: passedLat, lng: passedLng }
      });
      return NextResponse.json({ error: errorMsg }, { status: 400 });
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
        country,
        requestedRadiusMiles: 10
      }
    });

    // Verify legal acceptance (waiver required for squad participation)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        firstName: true,
        lastName: true,
        waiverAcceptedAt: true,
        waiverVersionAccepted: true
      }
    });

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

    // Geocode to get coordinates - try multiple methods
    let latitude, longitude;

    // International cities - use passed coordinates directly
    if (isInternational && passedLat && passedLng) {
      latitude = passedLat;
      longitude = passedLng;
      console.log(`[Squad Create] Using passed coords for ${country}: ${latitude}, ${longitude}`);
    }
    // Mexican locations - use Nominatim with postal code
    else if (country === 'MX') {
      // Mexican locations - use Nominatim with postal code
      try {
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/search?postalcode=${zipCode}&country=MX&format=json&limit=1`,
          { headers: { 'User-Agent': 'PetRecovery.org' } }
        );

        if (nomRes.ok) {
          const nomData = await nomRes.json();
          if (nomData.length > 0) {
            latitude = parseFloat(nomData[0].lat);
            longitude = parseFloat(nomData[0].lon);
            console.log(`[Squad Create] Geocoded MX via Nominatim postal: ${latitude}, ${longitude}`);
          }
        }
      } catch (err) {
        console.log('[Squad Create] Nominatim postal code failed, trying city name...');
      }

      // Fallback: try city name search
      if (!latitude || !longitude) {
        try {
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&country=MX&format=json&limit=1`,
            { headers: { 'User-Agent': 'PetRecovery.org' } }
          );

          if (nomRes.ok) {
            const nomData = await nomRes.json();
            if (nomData.length > 0) {
              latitude = parseFloat(nomData[0].lat);
              longitude = parseFloat(nomData[0].lon);
              console.log(`[Squad Create] Geocoded MX via Nominatim city: ${latitude}, ${longitude}`);
            }
          }
        } catch (err) {
          console.error('[Squad Create] Nominatim city geocoding failed:', err);
        }
      }
    } else {
      // US locations - try zippopotam.us first
      try {
        const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          const place = geoData.places[0];
          latitude = parseFloat(place['latitude']);
          longitude = parseFloat(place['longitude']);
          console.log(`[Squad Create] Geocoded via zippopotam: ${latitude}, ${longitude}`);
        }
      } catch (err) {
        console.log('[Squad Create] zippopotam.us failed, trying fallback...');
      }

      // Fallback to Nominatim (city, state lookup)
      if (!latitude || !longitude) {
        try {
          const query = encodeURIComponent(`${city}, ${state}, USA`);
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
            { headers: { 'User-Agent': 'PetRecovery-RescueSquad/1.0' } }
          );

          if (nomRes.ok) {
            const nomData = await nomRes.json();
            if (nomData.length > 0) {
              latitude = parseFloat(nomData[0].lat);
              longitude = parseFloat(nomData[0].lon);
              console.log(`[Squad Create] Geocoded via Nominatim: ${latitude}, ${longitude}`);
            }
          }
        } catch (err) {
          console.error('[Squad Create] Nominatim geocoding failed:', err);
        }
      }
    }

    // If geocoding failed, return error
    if (!latitude || !longitude) {
      await logEvent({
        event_type: 'squad.create_failed',
        resource_type: 'rescue_squad',
        action: 'create',
        result: 'failure',
        error_code: 'GEOCODING_FAILED',
        error_message: `Could not geocode ${city}, ${state} (Postal: ${zipCode}, Country: ${country})`,
        actor_user_id: session.user.id,
        actor_role: null,
        metadata: { city, state, zipCode, country }
      });
      return NextResponse.json({
        error: 'Could not determine location coordinates. Please try again or contact support.'
      }, { status: 400 });
    }

    const squadName = `${city} Rescue Squad`;

    // Check if squad already exists (active) - filter by country
    const existingActive = await prisma.rescueSquad.findFirst({
      where: { city, state, country, isDeleted: false }
    });

    if (existingActive) {
      await logEvent({
        event_type: 'squad.create_failed',
        resource_type: 'rescue_squad',
        action: 'create',
        result: 'failure',
        error_code: 'DUPLICATE_SQUAD',
        error_message: `Squad already exists for ${city}, ${state}, ${country}`,
        actor_user_id: session.user.id,
        actor_role: null,
        metadata: { city, state, zipCode, country, existingSquadId: existingActive.id, existingSquadName: existingActive.name }
      });
      return NextResponse.json({ error: 'Squad already exists for this city' }, { status: 400 });
    }

    // Check if there's a deleted squad we can reactivate
    const deletedSquad = await prisma.rescueSquad.findFirst({
      where: { city, state, country, isDeleted: true }
    });

    let squad;

    if (deletedSquad) {
      // Check if the user is already a member of this squad
      const existingMembership = await prisma.rescueSquadMember.findUnique({
        where: {
          rescueSquadId_userId: {
            rescueSquadId: deletedSquad.id,
            userId: session.user.id
          }
        }
      });

      // Reactivate the deleted squad
      squad = await prisma.rescueSquad.update({
        where: { id: deletedSquad.id },
        data: {
          isDeleted: false,
          deletedAt: null,
          isActive: true,
          isAcceptingCases: true,
          centerLatitude: latitude,
          centerLongitude: longitude,
          zipCodes: JSON.stringify(zipCode ? [zipCode] : []),
          country,
        },
      });

      // Either update existing membership to FOUNDER or create new one
      if (existingMembership) {
        await prisma.rescueSquadMember.update({
          where: { id: existingMembership.id },
          data: {
            role: 'FOUNDER',
            isActive: true,
            leftAt: null,
          }
        });
      } else {
        await prisma.rescueSquadMember.create({
          data: {
            rescueSquadId: deletedSquad.id,
            userId: session.user.id,
            role: 'FOUNDER',
            isActive: true,
          }
        });
      }

      await logEvent({
        event_type: 'squad.reactivated',
        resource_type: 'rescue_squad',
        resource_id: squad.id,
        action: 'update',
        result: 'success',
        actor_user_id: session.user.id,
        metadata: { city, state, zipCode, reactivated: true, existingMember: !!existingMembership }
      });
    } else {
      // Create new squad
      squad = await prisma.rescueSquad.create({
        data: {
          name: squadName,
          city,
          state,
          country,
          zipCodes: JSON.stringify(zipCode ? [zipCode] : []),
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

    // Auto-assign existing active cases within coverage area
    const COVERAGE_BUFFER = 1; // Same buffer as case creation
    let assignedCasesCount = 0;

    try {
      // Find all active cases (not resolved or closed)
      const activeMissions = await prisma.case.findMany({
        where: {
          status: { not: 'RESOLVED' },
          isDeleted: false,
          lastSeenLatitude: { not: null },
          lastSeenLongitude: { not: null },
        },
        select: {
          id: true,
          lastSeenLatitude: true,
          lastSeenLongitude: true,
          petName: true,
          caseNumber: true,
        },
      });

      console.log(`[Squad Create] Found ${activeMissions.length} active cases to check for auto-assignment`);

      // Calculate distances and filter cases within coverage
      const effectiveRadius = squad.radiusMiles + COVERAGE_BUFFER;
      const casesToAssign = activeMissions.filter(c => {
        const distance = calculateDistance(
          squad.centerLatitude,
          squad.centerLongitude,
          c.lastSeenLatitude,
          c.lastSeenLongitude
        );
        return distance <= effectiveRadius;
      });

      console.log(`[Squad Create] ${casesToAssign.length} cases within ${effectiveRadius} mile coverage area`);

      // Create assignments for qualifying cases
      for (const missionData of casesToAssign) {
        // Check if assignment already exists
        const existingAssignment = await prisma.caseAssignment.findFirst({
          where: {
            missionId: missionData.id,
            rescueSquadId: squad.id,
          },
        });

        if (!existingAssignment) {
          await prisma.caseAssignment.create({
            data: {
              missionId: missionData.id,
              rescueSquadId: squad.id,
              status: 'ACCEPTED',
              acceptedById: session.user.id,
            },
          });
          assignedCasesCount++;
          console.log(`[Squad Create] Auto-assigned case ${missionData.caseNumber} (${missionData.petName}) to new squad`);
        }
      }

      if (assignedCasesCount > 0) {
        await logEvent({
          event_type: 'squad.auto_assigned_cases',
          resource_type: 'rescue_squad',
          resource_id: squad.id,
          action: 'update',
          result: 'success',
          actor_user_id: session.user.id,
          metadata: {
            squadId: squad.id,
            squadName: squad.name,
            casesAssigned: assignedCasesCount,
            coverageRadius: effectiveRadius,
          },
        });
      }
    } catch (assignmentError) {
      // Non-fatal: log but continue - squad still created successfully
      console.error('[Squad Create] Auto-assignment error:', assignmentError);
      await logEvent({
        event_type: 'squad.auto_assignment_failed',
        resource_type: 'rescue_squad',
        resource_id: squad.id,
        action: 'update',
        result: 'failure',
        error_message: assignmentError.message,
      });
    }

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
        isActive: squad.isActive,
        casesAutoAssigned: assignedCasesCount,
      }
    });

    return NextResponse.json({ squad, casesAutoAssigned: assignedCasesCount }, { status: 201 });
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

// Search Mexican location via Nominatim
async function searchMexicanLocation(query, isPostalCode) {
  try {
    let nominatimUrl;

    if (isPostalCode) {
      nominatimUrl = `https://nominatim.openstreetmap.org/search?postalcode=${query}&country=MX&format=json&limit=1&addressdetails=1`;
    } else {
      nominatimUrl = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(query)}&country=MX&format=json&limit=1&addressdetails=1`;
    }

    const response = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'PetRecovery.org' }
    });

    if (!response.ok) {
      return { success: false, error: 'Location search failed' };
    }

    const data = await response.json();

    if (data.length === 0) {
      return { success: false, error: isPostalCode ? 'Invalid postal code' : 'Invalid city name' };
    }

    const place = data[0];
    const address = place.address || {};
    const city = address.city || address.town || address.village || address.municipality || address.county || query;
    const stateName = address.state || 'México';
    const postalCode = address.postcode || (isPostalCode ? query : null);

    // Map state name to code
    const stateCode = getMexicanStateCodeFromName(stateName);

    return {
      success: true,
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
      city: city,
      state: stateCode,
      stateName: stateName,
      postalCode: postalCode
    };
  } catch (error) {
    console.error('Mexican location search error:', error);
    return { success: false, error: 'Location search failed' };
  }
}

// Map Mexican state names to state codes
function getMexicanStateCodeFromName(stateName) {
  if (!stateName) return 'MX';

  const nameToCode = {
    'aguascalientes': 'AGS',
    'baja california': 'BC',
    'baja california sur': 'BCS',
    'campeche': 'CAM',
    'chiapas': 'CHIS',
    'chihuahua': 'CHIH',
    'ciudad de méxico': 'CDMX',
    'coahuila': 'COAH',
    'coahuila de zaragoza': 'COAH',
    'colima': 'COL',
    'durango': 'DGO',
    'guanajuato': 'GTO',
    'guerrero': 'GRO',
    'hidalgo': 'HGO',
    'jalisco': 'JAL',
    'méxico': 'MEX',
    'estado de méxico': 'MEX',
    'michoacán': 'MICH',
    'michoacán de ocampo': 'MICH',
    'morelos': 'MOR',
    'nayarit': 'NAY',
    'nuevo león': 'NL',
    'oaxaca': 'OAX',
    'puebla': 'PUE',
    'querétaro': 'QRO',
    'quintana roo': 'QROO',
    'san luis potosí': 'SLP',
    'sinaloa': 'SIN',
    'sonora': 'SON',
    'tabasco': 'TAB',
    'tamaulipas': 'TAMPS',
    'tlaxcala': 'TLAX',
    'veracruz': 'VER',
    'veracruz de ignacio de la llave': 'VER',
    'yucatán': 'YUC',
    'zacatecas': 'ZAC',
  };

  const normalized = stateName.toLowerCase().trim();
  return nameToCode[normalized] || 'MX';
}
