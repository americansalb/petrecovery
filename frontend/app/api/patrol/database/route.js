import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a patrol member
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        patrolProfile: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.patrolProfile) {
      return NextResponse.json(
        { error: 'This feature is only available to patrol members' },
        { status: 403 }
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('search') || '';
    const reportType = searchParams.get('type'); // LOST, FOUND, or null for all
    const species = searchParams.get('species'); // DOG, CAT, etc
    const status = searchParams.get('status') || 'ACTIVE';

    // Build where clause
    const where = {
      status: status === 'ALL' ? undefined : status,
    };

    if (reportType && (reportType === 'LOST' || reportType === 'FOUND')) {
      where.reportType = reportType;
    }

    // Fetch all reports
    const reports = await prisma.lostReport.findMany({
      where,
      include: {
        pet: true,
        reporter: {
          select: {
            firstName: true,
            phone: true,
            email: true,
          }
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filter by search query and species
    let filteredReports = reports;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredReports = filteredReports.filter(report =>
        report.pet.name.toLowerCase().includes(query) ||
        (report.pet.breed && report.pet.breed.toLowerCase().includes(query)) ||
        report.pet.color.toLowerCase().includes(query) ||
        report.lastSeenAddress.toLowerCase().includes(query)
      );
    }

    if (species) {
      filteredReports = filteredReports.filter(report =>
        report.pet.species === species
      );
    }

    // Format response
    const formattedReports = filteredReports.map(report => ({
      id: report.id,
      reportType: report.reportType,
      status: report.status,
      petName: report.pet.name,
      species: report.pet.species,
      breed: report.pet.breed,
      color: report.pet.color,
      size: report.pet.size,
      distinctiveMarks: report.pet.distinctiveMarks,
      primaryPhotoUrl: report.pet.primaryPhotoUrl,
      lastSeenAt: report.lastSeenAt,
      lastSeenAddress: report.lastSeenAddress,
      createdAt: report.createdAt,
      reporterName: report.reporter.firstName,
      reporterPhone: report.reporter.phone,
      reporterEmail: report.reporter.email,
    }));

    return NextResponse.json({
      reports: formattedReports,
      total: formattedReports.length,
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching patrol database:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
