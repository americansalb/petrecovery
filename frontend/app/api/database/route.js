import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';

// Force dynamic rendering since we use session/headers
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Get session (but don't require it)
    const session = await getServerSession();

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

    // Check if user is authenticated (owner or patrol member)
    const isAuthenticated = !!session?.user?.email;

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
      // Only include contact info if authenticated
      ...(isAuthenticated ? {
        reporterName: report.reporter.firstName,
        reporterPhone: report.reporter.phone,
        reporterEmail: report.reporter.email,
      } : {}),
    }));

    return NextResponse.json({
      reports: formattedReports,
      total: formattedReports.length,
      isAuthenticated,
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching database:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
