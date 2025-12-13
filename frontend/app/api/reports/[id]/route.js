import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';

export async function GET(request, { params }) {
  try {
    const { id } = params;

    const report = await prisma.case.findUnique({
      where: { id },
      include: {
        pet: true,
        reporter: {
          select: {
            id: true,
            firstName: true,
            email: true,
            phone: true,
          }
        },
        sightings: {
          include: {
            reportedBy: {
              select: {
                firstName: true,
              }
            }
          },
          orderBy: {
            sightedAt: 'desc',
          }
        },
        missionControl: true,
        caseAssignments: {
          where: {
            status: { in: ['ACCEPTED', 'ACTIVE'] }
          },
          include: {
            rescueSquad: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              }
            }
          }
        }
      }
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const session = await getServerSession();
    const isOwner = session?.user?.email === report.reporter.email;

    // Parse photos from pet if available, or use denormalized petPhotoUrl
    let photos = [];
    if (report.pet?.photos) {
      try {
        photos = JSON.parse(report.pet.photos || '[]');
      } catch (e) {
        photos = [];
      }
    }
    if (photos.length === 0 && report.petPhotoUrl) {
      photos = [report.petPhotoUrl];
    }

    // If this is a FOUND pet, find potential matches (nearby LOST pets)
    let potentialMatches = [];
    if (report.reportType === 'FOUND') {
      const lostCases = await prisma.case.findMany({
        where: {
          status: 'ACTIVE',
          reportType: 'LOST',
        },
        include: {
          pet: true,
          reporter: {
            select: {
              firstName: true,
              phone: true,
            }
          }
        }
      });

      // Filter by species match and distance
      potentialMatches = lostCases
        .filter(lostCase => lostCase.petSpecies === report.petSpecies)
        .map(lostCase => {
          const distance = calculateDistance(
            report.lastSeenLatitude,
            report.lastSeenLongitude,
            lostCase.lastSeenLatitude,
            lostCase.lastSeenLongitude
          );
          return { ...lostCase, distance };
        })
        .filter(lostCase => lostCase.distance <= 10) // Within 10 miles
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5)
        .map(lostCase => ({
          id: lostCase.id,
          petName: lostCase.petName,
          species: lostCase.petSpecies,
          breed: lostCase.petBreed,
          color: lostCase.petColor,
          size: lostCase.petSize,
          primaryPhotoUrl: lostCase.petPhotoUrl,
          lastSeenAddress: lostCase.lastSeenAddress,
          distance: lostCase.distance.toFixed(1),
          reporterName: lostCase.reporter.firstName,
          reporterPhone: lostCase.reporter.phone,
        }));
    }

    return NextResponse.json({
      report: {
        id: report.id,
        caseNumber: report.caseNumber,
        reportType: report.reportType,
        status: report.status,
        lastSeenAt: report.lastSeenAt,
        lastSeenAddress: report.lastSeenAddress,
        lastSeenLatitude: report.lastSeenLatitude,
        lastSeenLongitude: report.lastSeenLongitude,
        searchRadius: report.searchRadius,
        hasReward: report.hasReward,
        rewardAmount: report.rewardAmount,
        createdAt: report.createdAt,
        escapeScenario: report.escapeScenario,
        escapeDetails: report.escapeDetails,
      },
      pet: {
        id: report.pet?.id || report.id,
        name: report.petName,
        species: report.petSpecies,
        breed: report.petBreed,
        color: report.petColor,
        size: report.petSize,
        distinctiveMarks: report.pet?.distinctiveMarks || null,
        description: report.petDescription,
        photos: photos,
        primaryPhotoUrl: report.petPhotoUrl,
      },
      reporter: isOwner ? {
        firstName: report.ownerName || report.reporter.firstName,
        email: report.ownerEmail || report.reporter.email,
        phone: report.ownerPhone || report.reporter.phone,
      } : {
        firstName: report.ownerName || report.reporter.firstName,
        // Don't expose full contact info to non-owners
      },
      sightings: report.sightings.map(s => ({
        id: s.id,
        sightedAt: s.sightedAt,
        address: s.address,
        description: s.description,
        certaintyLevel: s.certaintyLevel,
        reportedBy: s.reportedBy.firstName,
        latitude: s.latitude,
        longitude: s.longitude,
        isVerified: s.isVerified,
      })),
      potentialMatches, // Empty array for LOST pets, populated for FOUND pets
      isOwner,
      missionControl: report.missionControl,
      rescueSquads: report.caseAssignments?.map(a => ({
        id: a.rescueSquad.id,
        name: a.rescueSquad.name,
        avatarUrl: a.rescueSquad.avatarUrl,
        status: a.status,
      })) || [],
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
