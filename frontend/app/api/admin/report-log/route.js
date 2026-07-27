import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rawLimit = parseInt(searchParams.get('limit') || '100', 10);
    const rawOffset = parseInt(searchParams.get('offset') || '0', 10);
    // Guard against NaN/negative query params (e.g. ?offset=abc) - unguarded these
    // reach Prisma as skip:NaN/take:NaN and throw a 500.
    const limit = Number.isNaN(rawLimit) ? 100 : Math.min(Math.max(rawLimit, 1), 500);
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

    const cases = await prisma.case.findMany({
      where: { reportType: 'LOST' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        caseNumber: true,
        petName: true,
        petSpecies: true,
        petColor: true,
        ownerName: true,
        ownerEmail: true,
        status: true,
        priority: true,
        lastSeenLatitude: true,
        lastSeenLongitude: true,
        lastSeenAddress: true,
        reporterLatitude: true,
        reporterLongitude: true,
        createdAt: true,
      },
    });

    const total = await prisma.case.count({ where: { reportType: 'LOST' } });

    const entries = cases.map(c => {
      let distanceMiles = null;
      // Use != null, not truthiness: a valid coordinate of exactly 0 (equator /
      // prime meridian) is falsy and would be wrongly treated as missing.
      if (c.reporterLatitude != null && c.reporterLongitude != null && c.lastSeenLatitude != null && c.lastSeenLongitude != null) {
        distanceMiles = parseFloat(
          calculateDistance(c.reporterLatitude, c.reporterLongitude, c.lastSeenLatitude, c.lastSeenLongitude).toFixed(2)
        );
      }

      return {
        id: c.id,
        caseNumber: c.caseNumber,
        petName: c.petName,
        petSpecies: c.petSpecies,
        petColor: c.petColor,
        ownerName: c.ownerName,
        ownerEmail: c.ownerEmail,
        status: c.status,
        priority: c.priority,
        lastSeen: {
          lat: c.lastSeenLatitude,
          lng: c.lastSeenLongitude,
          address: c.lastSeenAddress,
        },
        reporter: c.reporterLatitude != null && c.reporterLongitude != null
          ? { lat: c.reporterLatitude, lng: c.reporterLongitude }
          : null,
        distanceMiles,
        submittedAt: c.createdAt,
      };
    });

    return NextResponse.json({ entries, total, limit, offset });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch report log', details: error.message }, { status: 500 });
  }
}
