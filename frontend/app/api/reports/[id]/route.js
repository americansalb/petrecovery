import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getServerSession } from 'next-auth';

export async function GET(request, { params }) {
  try {
    const { id } = params;

    const report = await prisma.lostReport.findUnique({
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

    // Parse photos from JSON string
    let photos = [];
    try {
      photos = JSON.parse(report.pet.photos || '[]');
    } catch (e) {
      photos = [];
    }

    // If this is a FOUND pet, find potential matches (nearby LOST pets)
    let potentialMatches = [];
    if (report.reportType === 'FOUND') {
      const lostReports = await prisma.lostReport.findMany({
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
      potentialMatches = lostReports
        .filter(lostReport => lostReport.pet.species === report.pet.species)
        .map(lostReport => {
          const distance = calculateDistance(
            report.lastSeenLatitude,
            report.lastSeenLongitude,
            lostReport.lastSeenLatitude,
            lostReport.lastSeenLongitude
          );
          return { ...lostReport, distance };
        })
        .filter(lostReport => lostReport.distance <= 10) // Within 10 miles
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5)
        .map(lostReport => ({
          id: lostReport.id,
          petName: lostReport.pet.name,
          species: lostReport.pet.species,
          breed: lostReport.pet.breed,
          color: lostReport.pet.color,
          size: lostReport.pet.size,
          primaryPhotoUrl: lostReport.pet.primaryPhotoUrl,
          lastSeenAddress: lostReport.lastSeenAddress,
          distance: lostReport.distance.toFixed(1),
          reporterName: lostReport.reporter.firstName,
          reporterPhone: lostReport.reporter.phone,
        }));
    }

    return NextResponse.json({
      report: {
        id: report.id,
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
      },
      pet: {
        id: report.pet.id,
        name: report.pet.name,
        species: report.pet.species,
        breed: report.pet.breed,
        color: report.pet.color,
        size: report.pet.size,
        distinctiveMarks: report.pet.distinctiveMarks,
        photos: photos,
        primaryPhotoUrl: report.pet.primaryPhotoUrl,
      },
      reporter: isOwner ? {
        firstName: report.reporter.firstName,
        email: report.reporter.email,
        phone: report.reporter.phone,
      } : {
        firstName: report.reporter.firstName,
        // Don't expose full contact info to non-owners
      },
      sightings: report.sightings.map(s => ({
        id: s.id,
        sightedAt: s.sightedAt,
        address: s.address,
        description: s.description,
        certaintyLevel: s.certaintyLevel,
        reportedBy: s.reportedBy.firstName,
      })),
      potentialMatches, // Empty array for LOST pets, populated for FOUND pets
      isOwner,
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
