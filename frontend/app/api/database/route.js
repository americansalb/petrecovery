import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

// Force dynamic rendering since we use session/headers
export const dynamic = 'force-dynamic';

// This endpoint returns the WHOLE case table in one response. It used to attach
// the reporter's name, phone and email to every row for any signed-in caller,
// which made a single request a complete contact list of distressed pet owners
// (the SEC-3 class - see __tests__/api/reports-id-pii.test.js). Contact details
// now never leave this route: a neighbour who needs to reach one owner goes to
// that case's own page, which is per-case and rate limited. The result set is
// also capped so a browse endpoint cannot be used to mirror the database.
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

export async function GET(request) {
  try {
    // Get session (but don't require it)
    const session = await getServerSession(authOptions);

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('search') || '';
    const reportType = searchParams.get('type'); // LOST, FOUND, or null for all
    const species = searchParams.get('species'); // DOG, CAT, etc
    const status = searchParams.get('status') || 'ACTIVE';
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE
    );
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    // Build where clause
    const where = {
      status: status === 'ALL' ? undefined : status,
    };

    if (reportType && (reportType === 'LOST' || reportType === 'FOUND')) {
      where.reportType = reportType;
    }

    // Species and free-text search are part of the QUERY, not a pass over the
    // fetched rows. They used to filter in JS after findMany() pulled the whole
    // table into memory, which is fine at seed scale and falls over the moment
    // the board is real - this endpoint was observed against 87,000 rows.
    if (species) {
      where.petSpecies = species;
    }

    if (searchQuery) {
      const contains = { contains: searchQuery, mode: 'insensitive' };
      where.OR = [
        { petName: contains },
        { petBreed: contains },
        { petColor: contains },
        { lastSeenAddress: contains },
      ];
    }

    // Reporter contact is intentionally NOT selected - see the note above.
    const [cases, totalMatching] = await Promise.all([
      prisma.case.findMany({
        where,
        include: {
          reporter: {
            select: {
              firstName: true,
            }
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.case.count({ where }),
    ]);

    // Check if user is authenticated (owner or patrol member)
    const isAuthenticated = !!session?.user?.email;

    // Format response
    const formattedReports = cases.map(c => ({
      id: c.id,
      caseNumber: c.caseNumber,
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
      // A first name is all the board needs to say who reported it. Phone and
      // email are never included here - use the case's own page to make contact.
      reporterName: c.reporter?.firstName || String(c.ownerName || '').trim().split(/\s+/)[0] || null,
    }));

    return NextResponse.json({
      reports: formattedReports,
      total: totalMatching,
      count: formattedReports.length,
      limit,
      offset,
      hasMore: offset + formattedReports.length < totalMatching,
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
