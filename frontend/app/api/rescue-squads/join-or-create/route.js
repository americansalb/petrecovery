import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { getZipCodeInfo } from '@/lib/zip-city-mapping';

// POST /api/rescue-squads/join-or-create - Join or auto-create city rescue squad
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the actual user from database to ensure the ID exists
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const body = await request.json();
    const { zipCode } = body;

    if (!zipCode) {
      return NextResponse.json(
        { error: 'Zip code is required' },
        { status: 400 }
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

    // If not in our database, use external geocoding API
    if (zipInfo.needsGeocode) {
      try {
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
          metroValue: `${place['place name'].toUpperCase().replace(/\s+/g, '_')}_${place['state abbreviation']}`
        };
      } catch (error) {
        console.error('Geocoding error:', error);
        return NextResponse.json(
          { error: `Unable to validate zip code ${zipCode}. Please try again.` },
          { status: 400 }
        );
      }
    }

    console.log('📍 Zip lookup:', zipInfo);

    // Find or create the city's rescue squad
    const squadName = `${zipInfo.city} Rescue Squad`;

    let squad = await prisma.rescueSquad.findFirst({
      where: {
        name: squadName,
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
            caseAssignments: true
          }
        }
      },
    });

    // Create squad if doesn't exist
    if (!squad) {
      console.log(`🚑 CREATING NEW SQUAD: ${squadName} in ${zipInfo.city}, ${zipInfo.state}`);

      squad = await prisma.rescueSquad.create({
        data: {
          name: squadName,
          description: `The official rescue squad for ${zipInfo.city}. Join us to help find lost pets in our community!`,
          city: zipInfo.city,          // ⭐ CRITICAL for search
          state: zipInfo.state || 'IL', // ⭐ CRITICAL for search
          zipCodes: JSON.stringify([zipCode]),
          centerLatitude: null, // TODO: geocode later
          centerLongitude: null,
          radiusMiles: 10, // Default city coverage
          coverageType: 'CITYWIDE',
          specializesInDogs: true,
          specializesInCats: true,
          specializesInBirds: true,
          specializesInOther: true,
          members: {
            create: {
              userId: dbUser.id,
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
                },
              },
            },
          },
          _count: {
            select: {
              members: true,
              caseAssignments: true
            }
          }
        },
      });

      console.log(`✅ SQUAD CREATED SUCCESSFULLY:`, {
        id: squad.id,
        name: squad.name,
        city: squad.city,
        state: squad.state,
        zipCodes: squad.zipCodes,
        members: squad.members.length
      });

      // Update user's squad count
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          squadsJoinedCount: { increment: 1 },
        },
      });
    } else {
      // Squad exists - check if user is already a member
      const existingSquadMember = await prisma.rescueSquadMember.findUnique({
        where: {
          rescueSquadId_userId: {
            rescueSquadId: squad.id,
            userId: dbUser.id
          }
        }
      });

      // ⭐ FIX OLD BROKEN SQUADS: Update NULL city fields
      if (!squad.city || !squad.state) {
        console.log(`🔧 FIXING OLD SQUAD: "${squad.name}" has NULL city/state, updating...`);
        squad = await prisma.rescueSquad.update({
          where: { id: squad.id },
          data: {
            city: zipInfo.city,
            state: zipInfo.state,
            zipCodes: JSON.stringify([zipCode])
          },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            _count: {
              select: {
                members: true,
                caseAssignments: true
              }
            }
          }
        });
        console.log(`✅ FIXED: "${squad.name}" now has city="${squad.city}", state="${squad.state}"`);
      }

      if (existingSquadMember) {
        // Already a member - just return the squad
        console.log('✅ User is already a member of', squadName);
      } else {
        // Add user as member
        console.log(`👥 Adding user to ${squadName}`);
        await prisma.rescueSquadMember.create({
          data: {
            rescueSquadId: squad.id,
            userId: dbUser.id,
            role: squad.members.length === 0 ? 'FOUNDER' : 'MEMBER',
            isActive: true,
          },
        });

        // Update user's squad count
        await prisma.user.update({
          where: { id: dbUser.id },
          data: {
            squadsJoinedCount: { increment: 1 },
          },
        });

        // Refresh squad data
        squad = await prisma.rescueSquad.findUnique({
          where: { id: squad.id },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            _count: {
              select: {
                members: true,
                caseAssignments: true
              }
            }
          },
        });
      }
    }

    return NextResponse.json({
      squad: {
        ...squad,
        memberCount: squad._count.members,
        casesCount: squad._count.caseAssignments
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error joining/creating rescue squad:', error);
    return NextResponse.json(
      { error: 'Failed to join rescue squad', details: error.message },
      { status: 500 }
    );
  }
}
