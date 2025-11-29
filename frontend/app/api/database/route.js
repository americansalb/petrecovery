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

    // Fetch all cases
    const cases = await prisma.case.findMany({
      where,
      include: {
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
    let filteredCases = cases;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredCases = filteredCases.filter(c =>
        c.petName.toLowerCase().includes(query) ||
        (c.petBreed && c.petBreed.toLowerCase().includes(query)) ||
        c.petColor.toLowerCase().includes(query) ||
        c.lastSeenAddress.toLowerCase().includes(query)
      );
    }

    if (species) {
      filteredCases = filteredCases.filter(c =>
        c.petSpecies === species
      );
    }

    // Check if user is authenticated (owner or patrol member)
    const isAuthenticated = !!session?.user?.email;

    // Format response
    const formattedReports = filteredCases.map(c => ({
      id: c.id,
      reportType: c.reportType,
      status: c.status,
      petName: c.petName,
      species: c.petSpecies,
      breed: c.petBreed,
      color: c.petColor,
      size: c.petSize,
      distinctiveMarks: c.petDescription,
      primaryPhotoUrl: c.petPhotoUrl,
      lastSeenAt: c.lastSeenAt,
      lastSeenAddress: c.lastSeenAddress,
      createdAt: c.createdAt,
      // Only include contact info if authenticated
      ...(isAuthenticated ? {
        reporterName: c.reporter?.firstName || c.ownerName,
        reporterPhone: c.reporter?.phone || c.ownerPhone,
        reporterEmail: c.reporter?.email || c.ownerEmail,
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
