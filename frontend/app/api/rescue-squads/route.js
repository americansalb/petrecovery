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

    // If zip code provided, find squads by city name
    let searchLat = lat;
    let searchLng = lng;

    if (zipCode && !lat) {
      // Look up city from zip code
      let zipInfo = getZipCodeInfo(zipCode);

      if (!zipInfo) {
        return NextResponse.json({ squads: [] });
      }

      // If not in local database, use external geocoding API
      if (zipInfo.needsGeocode) {
        try {
          const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
          if (!geoRes.ok) {
            return NextResponse.json({ squads: [] });
          }

          const geoData = await geoRes.json();
          const place = geoData.places[0];

          zipInfo = {
            zipCode: zipCode,
            city: place['place name'],
            state: place['state abbreviation'],
            metro: `${place['place name']}, ${place['state abbreviation']}`,
            metroValue: `${place['place name'].toUpperCase().replace(/\s+/g, '_')}_${place['state abbreviation']}`
          };
        } catch (error) {
          console.error('Geocoding error during search:', error);
          return NextResponse.json({ squads: [] });
        }
      }

      console.log('🔍 SEARCH REQUEST:', {
        zipCode,
        zipInfo,
        searchType: 'city-based'
      });

      // Find squads in this city (using the actual 'city' field from schema)
      const squads = await prisma.rescueSquad.findMany({
        where: {
          isActive: true,
          city: zipInfo.city  // Direct city match - simple and reliable
        },
        include: {
          community: {
            select: {
              id: true,
              name: true,
              geographicScope: true,
              type: true,
              parentCommunity: {
                select: {
                  id: true,
                  name: true
                }
              }
            },
          },
          members: {
            where: { isActive: true },
            select: {
              id: true,
              role: true,
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
        orderBy: {
          successfulReunions: 'desc',
        },
      });

      console.log(`✅ SEARCH RESULT: Found ${squads.length} squad(s) in ${zipInfo.city}`);
      if (squads.length > 0) {
        squads.forEach(s => {
          console.log(`  - ${s.name} (ID: ${s.id}, City: ${s.city}, Members: ${s._count.members})`);
        });
      } else {
        console.log(`  ⚠️ No squads found in ${zipInfo.city} - user should create one!`);
      }

      // Add member counts and format response
      const squadsWithCounts = squads.map(squad => ({
        ...squad,
        memberCount: squad._count.members,
        distance: 0 // Within same city
      }));

      return NextResponse.json({ squads: squadsWithCounts, zip: zipCode, searchCity: zipInfo.city });
    }

    // Search by radius using Haversine formula
    const squads = await prisma.rescueSquad.findMany({
      where: {
        isActive: true,
        isAcceptingCases: true,
        centerLatitude: { not: null },
        centerLongitude: { not: null },
      },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            geographicScope: true,
            type: true,
          },
        },
        members: {
          where: { isActive: true },
          select: {
            id: true,
            role: true,
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

    // Filter by distance
    const squadsWithDistance = squads
      .map((squad) => {
        const distance = calculateDistance(
          searchLat,
          searchLng,
          squad.centerLatitude,
          squad.centerLongitude
        );
        return { ...squad, distance };
      })
      .filter((squad) => squad.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    return NextResponse.json({ squads: squadsWithDistance });
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
    const zipInfo = getZipCodeInfo(zipCode);

    if (!zipInfo) {
      return NextResponse.json(
        { error: `Zip code ${zipCode} not found in our database. Please contact support to add this location.` },
        { status: 400 }
      );
    }

    console.log('📍 Zip lookup:', zipInfo);

    // Auto-create metro community if it doesn't exist
    let metroCommunity = await prisma.community.findFirst({
      where: {
        geographicScope: zipInfo.metroValue,
        type: 'METRO_AREA'
      }
    });

    if (!metroCommunity) {
      console.log('🏙️ Creating metro community:', zipInfo.metro);
      metroCommunity = await prisma.community.create({
        data: {
          name: zipInfo.metro,
          geographicScope: zipInfo.metroValue,
          type: 'METRO_AREA',
          isActive: true,
          createdById: session.user.id,
          approvedById: session.user.id,
          approvedAt: new Date()
        }
      });
    }

    // Auto-create city community if it doesn't exist
    let cityCommunity = await prisma.community.findFirst({
      where: {
        name: zipInfo.city,
        parentCommunityId: metroCommunity.id,
        type: 'SUBCOMMUNITY'
      }
    });

    if (!cityCommunity) {
      console.log('🏘️ Creating city community:', zipInfo.city);
      cityCommunity = await prisma.community.create({
        data: {
          name: zipInfo.city,
          geographicScope: zipInfo.city,
          type: 'SUBCOMMUNITY',
          parentCommunityId: metroCommunity.id,
          isActive: true,
          createdById: session.user.id,
          approvedById: session.user.id,
          approvedAt: new Date()
        }
      });
    }

    // Auto-approve user as community member if not already
    const existingMembership = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: cityCommunity.id,
          userId: session.user.id
        }
      }
    });

    if (!existingMembership) {
      console.log('✅ Auto-approving user as community member');
      await prisma.communityMember.create({
        data: {
          communityId: cityCommunity.id,
          userId: session.user.id,
          status: 'APPROVED',
          requestedAt: new Date(),
          approvedAt: new Date(),
          approvedById: session.user.id
        }
      });
    } else if (existingMembership.status === 'PENDING') {
      // Auto-approve if pending
      await prisma.communityMember.update({
        where: {
          communityId_userId: {
            communityId: cityCommunity.id,
            userId: session.user.id
          }
        },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedById: session.user.id
        }
      });
    }

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

    // Use community center or default coordinates (TODO: proper geocoding)
    const finalLat = cityCommunity.centerLatitude || metroCommunity.centerLatitude || 41.8781;
    const finalLng = cityCommunity.centerLongitude || metroCommunity.centerLongitude || -87.6298;

    console.log('🏗️ CREATING SQUAD:', {
      name,
      city: zipInfo.city,
      state: zipInfo.state,
      zipCode,
      communityId: cityCommunity.id
    });

    // Create squad and add creator as FOUNDER
    const squad = await prisma.rescueSquad.create({
      data: {
        name,
        description,
        city: zipInfo.city,           // ⭐ CRITICAL: Store city for search
        state: zipInfo.state,         // ⭐ CRITICAL: Store state
        zipCodes: JSON.stringify([zipCode]),  // Store as JSON array
        communityId: cityCommunity.id,
        centerLatitude: finalLat,
        centerLongitude: finalLng,
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
        community: {
          select: {
            id: true,
            name: true,
            geographicScope: true,
            parentCommunity: {
              select: {
                id: true,
                name: true
              }
            }
          },
        },
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
