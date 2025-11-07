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
