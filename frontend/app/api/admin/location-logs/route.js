import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/admin/location-logs
 *
 * Fetch all location detection logs for the admin dashboard.
 * Supports pagination and filtering.
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const filter = searchParams.get('filter') || 'all'; // all, submitted, not_submitted
    const search = searchParams.get('search') || '';

    const where = {};

    if (filter === 'submitted') where.submitted = true;
    if (filter === 'not_submitted') where.submitted = false;

    if (search) {
      where.OR = [
        { address: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { caseNumber: { contains: search, mode: 'insensitive' } },
        { sessionId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.locationDetectionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.locationDetectionLog.count({ where }),
    ]);

    // Get stats
    const [totalAll, totalSubmitted, totalNotSubmitted, todayCount] = await Promise.all([
      prisma.locationDetectionLog.count(),
      prisma.locationDetectionLog.count({ where: { submitted: true } }),
      prisma.locationDetectionLog.count({ where: { submitted: false } }),
      prisma.locationDetectionLog.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total: totalAll,
        submitted: totalSubmitted,
        notSubmitted: totalNotSubmitted,
        today: todayCount,
      },
    });
  } catch (error) {
    console.error('[AdminLocationLogs] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch location logs' },
      { status: 500 }
    );
  }
}
